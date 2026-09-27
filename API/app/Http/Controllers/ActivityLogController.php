<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Recycle;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    private const COLUMNS = [
        'id', 'actor', 'action', 'subject', 'subject_type', 'subject_id', 'details', 'ip_address', 'created_at',
        'restored_at', 'restored_by', 'purged_at', 'purged_by',
    ];

    public function index(Request $request): JsonResponse
    {
        abort_unless(
            Modules::canAccess($request->user(), 'activity_logs'),
            403,
            'Huna ruhusa ya kuona kumbukumbu za shughuli.',
        );

        // Also scheduled daily; running it here keeps the 30-day rule exact without cron.
        Recycle::purgeExpired();

        $afterId = $request->integer('after_id');
        $deletedOnly = $request->boolean('deleted');

        $logs = ActivityLog::query()
            ->when($afterId > 0, fn ($query) => $query->where('id', '>', $afterId))
            ->when($deletedOnly, fn ($query) => $query
                ->where('action', 'deleted')
                ->whereNotNull('subject_id'))
            ->orderByDesc('id')
            ->limit($deletedOnly ? 500 : 200)
            ->get(self::COLUMNS);

        return response()->json($logs->map(fn (ActivityLog $log) => $this->present($log)));
    }

    public function restore(Request $request, ActivityLog $log): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->deletedModel($log);

        if ($blocker = Recycle::restoreBlocker($model)) {
            abort(422, $blocker);
        }

        DB::transaction(function () use ($model, $log, $request) {
            $model->restore();
            $log->update(['restored_at' => now(), 'restored_by' => $request->user()->name]);
        });

        app(ActivityLogger::class)->record(
            $request->user(),
            'restored',
            $log->subject,
            $log->subject_type,
            $request,
            $model,
            ['restored_from_log' => $log->id],
        );

        return response()->json($this->present($log));
    }

    /** Removes a deleted record for good; the snapshot in the log is kept. */
    public function purge(Request $request, ActivityLog $log): JsonResponse
    {
        $this->ensureAdmin($request);
        $model = $this->deletedModel($log);

        try {
            DB::transaction(function () use ($model, $log, $request) {
                $model->forceDelete();
                $log->update(['purged_at' => now(), 'purged_by' => $request->user()->name]);
            });
        } catch (QueryException) {
            abort(422, 'Haiwezi kufutwa kabisa kwa sababu bado kuna kumbukumbu zinazoitegemea (mf. watumiaji waliofutwa wenye wadhifa huu).');
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'purged',
            $log->subject,
            $log->subject_type,
            $request,
            null,
            ['purged_from_log' => $log->id],
        );

        return response()->json($this->present($log));
    }

    /** @return array<string, mixed> */
    private function present(ActivityLog $log): array
    {
        $isDeletion = $log->action === 'deleted' && $log->subject_id;

        return [
            ...$log->only(self::COLUMNS),
            'restore_deadline' => $isDeletion ? Recycle::restoreDeadline($log)->toIso8601String() : null,
        ];
    }

    private function deletedModel(ActivityLog $log): Model
    {
        abort_unless($log->action === 'deleted' && $log->subject_id, 422, 'Kumbukumbu hii si ya kitu kilichofutwa.');
        abort_if($log->restored_at !== null, 422, 'Kitu hiki tayari kimerejeshwa.');
        abort_if($log->purged_at !== null, 422, 'Kitu hiki kilishafutwa kabisa.');
        abort_if(
            Recycle::isExpired($log),
            422,
            'Siku '.Recycle::RETENTION_DAYS.' za kurejesha zimepita. Kitu hiki kinaweza kuangaliwa tu, si kurejeshwa.',
        );

        $model = Recycle::find((string) $log->subject_type, (int) $log->subject_id);

        abort_if($model === null, 422, 'Kitu hiki hakipo tena kwenye mfumo.');
        abort_unless($model->trashed(), 422, 'Kitu hiki tayari kimerejeshwa.');

        return $model;
    }

    /**
     * Records actions that happen entirely in the browser (file imports and downloads),
     * so they appear in the audit trail next to server-side changes.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', Rule::in(['imported', 'exported'])],
            'subject' => ['required', 'string', 'max:255'],
            'subject_type' => ['nullable', 'string', Rule::in(['kanda', 'jumuiya', 'jumuiya_member', 'offering'])],
        ]);

        $log = app(ActivityLogger::class)->record(
            $request->user(),
            $data['action'],
            $data['subject'],
            $data['subject_type'] ?? null,
            $request,
        );

        return response()->json($this->present($log), 201);
    }
}
