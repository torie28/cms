<?php

namespace App\Http\Controllers;

use App\Models\DeletionRequest;
use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Support\ActivityLogger;
use App\Support\RecordDeletion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class JumuiyaMemberController extends Controller
{
    /** Swahili labels for the five posts, used in clash messages. */
    private const ROLE_LABELS = [
        'chair' => 'Mwenyekiti',
        'vice_chair' => 'M/Mwenyekiti',
        'secretary' => 'Katibu',
        'vice_secretary' => 'M/Katibu',
        'treasurer' => 'Mweka Hazina',
    ];

    public function index(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureAnyModule($request, 'jumuiya', 'kanda');

        return response()->json($this->ordered($jumuiya)->get());
    }

    /** Every person in the parish with their community and zone, for the dashboard search and lists. */
    public function directory(Request $request): JsonResponse
    {
        $this->ensureAnyModule($request, 'jumuiya', 'kanda');

        return response()->json(
            JumuiyaMember::query()
                ->whereHas('jumuiya')
                ->with(['jumuiya:id,name,kanda_id', 'jumuiya.kanda:id,name'])
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get()
        );
    }

    public function store(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'create');

        if ($request->exists('members')) {
            return $this->storeMany($request, $jumuiya);
        }

        $member = $jumuiya->members()->create($this->validated($request, $jumuiya));

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $member->name.' in '.$jumuiya->name,
            'jumuiya_member',
            $request,
        );

        return response()->json([
            'member' => $member,
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ], 201);
    }

    public function update(Request $request, Jumuiya $jumuiya, JumuiyaMember $member): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'update');
        $this->ensureMember($jumuiya, $member);
        $member->update($this->validated($request, $jumuiya, $member));
        $changes = ActivityLogger::changes($member, [
            'first_name' => 'Jina',
            'middle_name' => 'Jina la kati',
            'last_name' => 'Jina la ukoo',
            'phone' => 'Simu',
            'gender' => 'Jinsia',
            'community_role' => 'Wadhifa wa jumuiya',
            'zone_role' => 'Wadhifa wa kanda',
        ]);

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $member->name.' in '.$jumuiya->name,
            'jumuiya_member',
            $request,
            $member,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json([
            'member' => $member,
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ]);
    }

    public function destroy(Request $request, Jumuiya $jumuiya, JumuiyaMember $member): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'delete');
        $this->ensureImmediateDeleteAllowed($request);
        $this->ensureMember($jumuiya, $member);

        RecordDeletion::run(
            $request->user(),
            'jumuiya_member',
            $member->id,
            $request,
            ['jumuiya_id' => $jumuiya->id],
        );
        DeletionRequest::cancelPending(
            DeletionRequest::TYPE_JUMUIYA_MEMBER,
            $member->id,
            $request->user(),
            'Mwanajumuiya amefutwa moja kwa moja na msimamizi.',
        );

        return response()->json([
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ]);
    }

    private function storeMany(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $data = $request->validate([
            'members' => ['required', 'array', 'min:1'],
            'members.*.first_name' => ['required', 'string', 'max:255'],
            'members.*.middle_name' => ['nullable', 'string', 'max:255'],
            'members.*.last_name' => ['required', 'string', 'max:255'],
            'members.*.phone' => ['nullable', 'string', 'max:40'],
            'members.*.gender' => ['nullable', 'string', 'in:male,female'],
            'members.*.community_role' => ['nullable', 'string', Rule::in(JumuiyaMember::ROLES)],
            'members.*.zone_role' => ['nullable', 'string', Rule::in(JumuiyaMember::ROLES)],
        ]);

        DB::transaction(function () use ($jumuiya, $data) {
            $jumuiya->members()->createMany($data['members']);
        });

        $count = count($data['members']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $count.' members in '.$jumuiya->name,
            'jumuiya_member',
            $request,
        );

        return response()->json([
            'members' => $this->ordered($jumuiya)->get(),
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, Jumuiya $jumuiya, ?JumuiyaMember $member = null): array
    {
        return $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'gender' => ['nullable', 'string', 'in:male,female'],
            'community_role' => [
                'nullable', 'string', Rule::in(JumuiyaMember::ROLES),
                $this->freeRole('community', $jumuiya, $member),
            ],
            'zone_role' => [
                'nullable', 'string', Rule::in(JumuiyaMember::ROLES),
                $this->freeRole('zone', $jumuiya, $member),
            ],
        ]);
    }

    /**
     * One person per post: a community has one of each title, and so does a zone
     * (across all its communities). Blank is always allowed — most people hold none.
     */
    private function freeRole(string $level, Jumuiya $jumuiya, ?JumuiyaMember $member): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($level, $jumuiya, $member) {
            if (! $value) {
                return;
            }

            $column = $level === 'zone' ? 'zone_role' : 'community_role';
            $query = JumuiyaMember::query()
                ->where($column, $value)
                ->when($member, fn ($q) => $q->whereKeyNot($member->id));

            if ($level === 'zone') {
                $query->whereHas('jumuiya', fn ($q) => $q->where('kanda_id', $jumuiya->kanda_id));
            } else {
                $query->where('jumuiya_id', $jumuiya->id);
            }

            if ($query->exists()) {
                $label = self::ROLE_LABELS[$value] ?? $value;
                $where = $level === 'zone' ? 'Kanda hii' : 'Jumuiya hii';
                $fail("{$where} tayari ina {$label}.");
            }
        };
    }

    /** Names read top to bottom by family name, then given name. */
    private function ordered(Jumuiya $jumuiya)
    {
        return $jumuiya->members()->orderBy('last_name')->orderBy('first_name');
    }

    private function ensureMember(Jumuiya $jumuiya, JumuiyaMember $member): void
    {
        abort_unless($member->jumuiya_id === $jumuiya->id, 404);
    }

    private function presentJumuiya(Jumuiya $jumuiya): Jumuiya
    {
        $jumuiya->load('kanda:id,name');
        $jumuiya->loadCount('members');

        return $jumuiya;
    }
}
