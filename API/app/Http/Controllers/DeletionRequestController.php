<?php

namespace App\Http\Controllers;

use App\Models\DeletionRequest;
use App\Support\ActivityLogger;
use App\Support\DeletionApprovals;
use App\Support\RecordDeletion;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DeletionRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $status = $request->query('status', DeletionRequest::STATUS_PENDING);

        $items = DeletionRequest::query()
            ->with(['requester:id,name,username', 'reviewer:id,name,username'])
            ->when(
                $status !== 'all',
                fn ($query) => $query->where('status', $status),
            )
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', 'string', Rule::in(RecordDeletion::TYPES)],
            'subject_id' => ['required', 'integer'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'move_to_kanda_id' => ['nullable', 'integer'],
            'jumuiya_id' => ['nullable', 'integer'],
        ]);

        abort_if(
            $request->user()?->role === Roles::ADMIN,
            422,
            'Msimamizi anaweza kufuta moja kwa moja bila kuomba idhini.',
        );

        $type = $data['subject_type'];
        $this->ensureCan($request, RecordDeletion::moduleFor($type), 'delete');

        $prepared = RecordDeletion::prepare($type, (int) $data['subject_id'], $request->user(), [
            'move_to_kanda_id' => $data['move_to_kanda_id'] ?? null,
            'jumuiya_id' => $data['jumuiya_id'] ?? null,
        ]);

        $existing = DeletionRequest::query()
            ->where('subject_type', $type)
            ->where('subject_id', $data['subject_id'])
            ->where('status', DeletionRequest::STATUS_PENDING)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'subject_id' => ['Tayari kuna ombi linalosubiri idhini ya kufuta kitu hiki.'],
            ]);
        }

        $deletionRequest = DeletionRequest::query()->create([
            'requester_id' => $request->user()->id,
            'subject_type' => $type,
            'subject_id' => $data['subject_id'],
            'subject_label' => $prepared['label'],
            'payload' => $prepared['payload'],
            'reason' => $data['reason'] ?? null,
            'status' => DeletionRequest::STATUS_PENDING,
        ]);

        $deletionRequest->load(['requester:id,name,username']);
        DeletionApprovals::notifyAdmins($deletionRequest);

        app(ActivityLogger::class)->record(
            $request->user(),
            'delete_requested',
            $prepared['label'],
            $type,
            $request,
            null,
            [
                'request_id' => $deletionRequest->id,
                'payload' => $prepared['payload'],
                'reason' => $deletionRequest->reason,
            ],
        );

        return response()->json([
            'message' => 'Ombi la kufuta limetumwa kwa msimamizi.',
            'pending' => true,
            'request' => $deletionRequest,
        ], 202);
    }

    public function approve(Request $request, DeletionRequest $deletionRequest): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_unless($deletionRequest->isPending(), 422, 'Ombi hili limeshahukumiwa.');

        $data = $request->validate([
            'review_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = DB::transaction(function () use ($request, $deletionRequest, $data) {
            $locked = DeletionRequest::query()->lockForUpdate()->findOrFail($deletionRequest->id);
            abort_unless($locked->isPending(), 422, 'Ombi hili limeshahukumiwa.');

            $outcome = RecordDeletion::run(
                $request->user(),
                $locked->subject_type,
                (int) $locked->subject_id,
                $request,
                $locked->payload,
                [
                    'approved_request_id' => $locked->id,
                    'requested_by' => $locked->requester?->name,
                    'requester_id' => $locked->requester_id,
                ],
            );

            $locked->update([
                'status' => DeletionRequest::STATUS_APPROVED,
                'reviewer_id' => $request->user()->id,
                'reviewed_at' => now(),
                'review_note' => $data['review_note'] ?? null,
            ]);

            return [
                'moved' => $outcome['moved'] ?? 0,
                'request' => $locked->fresh()->load(['requester:id,name,username', 'reviewer:id,name,username']),
            ];
        });

        DeletionApprovals::notifyRequester($result['request'], true);

        return response()->json([
            'message' => 'Ombi limeidhinishwa na kitu kimefutwa.',
            'moved' => $result['moved'],
            'request' => $result['request'],
        ]);
    }

    public function reject(Request $request, DeletionRequest $deletionRequest): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_unless($deletionRequest->isPending(), 422, 'Ombi hili limeshahukumiwa.');

        $data = $request->validate([
            'review_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $deletionRequest->update([
            'status' => DeletionRequest::STATUS_REJECTED,
            'reviewer_id' => $request->user()->id,
            'reviewed_at' => now(),
            'review_note' => $data['review_note'] ?? null,
        ]);

        $fresh = $deletionRequest->fresh()->load(['requester:id,name,username', 'reviewer:id,name,username']);
        DeletionApprovals::notifyRequester($fresh, false);

        app(ActivityLogger::class)->record(
            $request->user(),
            'delete_rejected',
            $fresh->subject_label,
            $fresh->subject_type,
            $request,
            null,
            [
                'request_id' => $fresh->id,
                'requested_by' => $fresh->requester?->name,
                'review_note' => $fresh->review_note,
            ],
        );

        return response()->json([
            'message' => 'Ombi limekataliwa.',
            'request' => $fresh,
        ]);
    }
}
