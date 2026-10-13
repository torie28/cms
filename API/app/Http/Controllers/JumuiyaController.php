<?php

namespace App\Http\Controllers;

use App\Models\Jumuiya;
use App\Support\ActivityLogger;
use App\Support\Recycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class JumuiyaController extends Controller
{
    public function index(): JsonResponse
    {
        $jumuiyas = Jumuiya::query()
            ->with(['kanda:id,name', 'parent:id,name'])
            ->withCount('members')
            ->orderBy('name')
            ->get();

        return response()->json($jumuiyas);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', $this->uniqueName()],
            'kanda_id' => ['required', 'integer', $this->activeKanda()],
            'chairperson' => ['nullable', 'string', 'max:255', $this->uniqueChairperson()],
            'notes' => ['nullable', 'string'],
            'members' => ['sometimes', 'array'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.phone' => ['nullable', 'string', 'max:40'],
            'members.*.gender' => ['nullable', 'string', 'in:male,female'],
        ]);

        $members = $data['members'] ?? [];
        unset($data['members']);

        $jumuiya = DB::transaction(function () use ($data, $members) {
            $jumuiya = Jumuiya::query()->create($data);

            if ($members !== []) {
                $jumuiya->members()->createMany($members);
            }

            return $jumuiya;
        });

        $jumuiya->load('kanda:id,name');
        $jumuiya->loadCount('members');

        $subject = $jumuiya->name;
        if ($jumuiya->members_count) {
            $subject .= ' with '.$jumuiya->members_count.' members';
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $subject,
            'jumuiya',
            $request,
        );

        return response()->json($jumuiya, 201);
    }

    public function show(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureAnyModule($request, 'jumuiya', 'kanda');

        $jumuiya->load(['kanda:id,name', 'members']);
        $jumuiya->loadCount('members');

        return response()->json($jumuiya);
    }

    public function update(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', $this->uniqueName($jumuiya)],
            'kanda_id' => ['required', 'integer', $this->activeKanda()],
            'chairperson' => ['nullable', 'string', 'max:255', $this->uniqueChairperson($jumuiya)],
            'notes' => ['nullable', 'string'],
        ]);

        $jumuiya->update($data);
        $changes = ActivityLogger::changes($jumuiya, [
            'name' => 'Jina',
            'kanda_id' => 'Kanda (namba)',
            'chairperson' => 'Mwenyekiti',
            'notes' => 'Maelezo',
        ]);
        $jumuiya->load('kanda:id,name');
        $jumuiya->loadCount('members');

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $jumuiya->name,
            'jumuiya',
            $request,
            $jumuiya,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json($jumuiya);
    }

    /**
     * Splits a jumuiya in two: a new jumuiya is created from the chosen members. The
     * original (parent) either stays in its kanda or moves to `parent_kanda_id`, and the
     * new one goes to `kanda_id`, which may be the same kanda or a different one.
     */
    public function split(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'create');
        $this->ensureCan($request, 'jumuiya', 'update');

        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($jumuiya) {
                    if (mb_strtolower(trim((string) $value)) === mb_strtolower(trim($jumuiya->name))) {
                        $fail('Jumuiya mpya inahitaji jina tofauti na jumuiya mama.');
                    }
                },
                $this->uniqueName(),
            ],
            'kanda_id' => ['required', 'integer', $this->activeKanda()],
            'parent_kanda_id' => ['required', 'integer', $this->activeKanda()],
            'chairperson' => ['nullable', 'string', 'max:255', $this->uniqueChairperson()],
            'notes' => ['nullable', 'string'],
            'member_ids' => ['present', 'array'],
            'member_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('jumuiya_members', 'id')
                    ->where('jumuiya_id', $jumuiya->id)
                    ->whereNull('deleted_at'),
            ],
        ]);

        $jumuiya->load('kanda:id,name');
        $originalKanda = $jumuiya->kanda;

        [$child, $moved] = DB::transaction(function () use ($jumuiya, $data) {
            $jumuiya->update(['kanda_id' => $data['parent_kanda_id']]);

            $child = Jumuiya::query()->create([
                'name' => trim($data['name']),
                'kanda_id' => $data['kanda_id'],
                'parent_id' => $jumuiya->id,
                'chairperson' => $data['chairperson'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $moved = $data['member_ids'] === []
                ? 0
                : $jumuiya->members()->whereIn('id', $data['member_ids'])->update(['jumuiya_id' => $child->id]);

            return [$child, $moved];
        });

        $parent = $this->present($jumuiya);
        $child = $this->present($child);

        $changes = [
            'Jumuiya mpya' => ['from' => $parent->name, 'to' => $child->name.' ('.$child->kanda?->name.')'],
            'Wanajumuiya waliohamishwa' => ['from' => null, 'to' => $moved],
        ];
        if ($originalKanda?->id !== $parent->kanda_id) {
            $changes['Kanda ya '.$parent->name] = ['from' => $originalKanda?->name, 'to' => $parent->kanda?->name];
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'split',
            $parent->name.' into '.$child->name.' with '.$moved.' members',
            'jumuiya',
            $request,
            $child,
            ['changes' => $changes],
        );

        return response()->json(['parent' => $parent, 'jumuiya' => $child], 201);
    }

    /**
     * Moves a jumuiya to another kanda. Members belong to the jumuiya, so they (and its
     * offerings) follow it to the new kanda automatically.
     */
    public function move(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'update');

        $data = $request->validate([
            'kanda_id' => ['required', 'integer', Rule::notIn([$jumuiya->kanda_id]), $this->activeKanda()],
        ], [
            'kanda_id.not_in' => 'Jumuiya hii tayari iko kwenye kanda hiyo.',
        ]);

        $from = $jumuiya->kanda()->value('name');
        $jumuiya->update(['kanda_id' => $data['kanda_id']]);
        $jumuiya = $this->present($jumuiya);

        app(ActivityLogger::class)->record(
            $request->user(),
            'moved',
            $jumuiya->name.' with '.$jumuiya->members_count.' members to '.$jumuiya->kanda?->name,
            'jumuiya',
            $request,
            $jumuiya,
            ['changes' => [
                'Kanda' => ['from' => $from, 'to' => $jumuiya->kanda?->name],
                'Wanajumuiya waliohamia' => ['from' => null, 'to' => $jumuiya->members_count],
            ]],
        );

        return response()->json($jumuiya);
    }

    public function destroy(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $this->ensureCan($request, 'jumuiya', 'delete');

        $snapshot = Recycle::snapshot($jumuiya);
        $jumuiya->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $jumuiya->name,
            'jumuiya',
            $request,
            $jumuiya,
            ['snapshot' => $snapshot],
        );

        return response()->json(['message' => 'Jumuiya removed.']);
    }

    private function activeKanda(): Exists
    {
        return Rule::exists('kandas', 'id')->withoutTrashed();
    }

    /**
     * A jumuiya name may be used once across the whole parish (ignoring case and spacing),
     * so the same jumuiya can't appear twice in a kanda or in two different kandas.
     */
    private function uniqueName(?Jumuiya $ignore = null): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($ignore) {
            $existing = Jumuiya::query()
                ->with('kanda:id,name')
                ->whereRaw('lower(trim(name)) = ?', [mb_strtolower(trim((string) $value))])
                ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
                ->first();

            if ($existing) {
                $fail("Jumuiya \"{$existing->name}\" tayari ipo kwenye kanda ".($existing->kanda?->name ?? '—').'. Tumia jina tofauti.');
            }
        };
    }

    /** One person may chair only one jumuiya (names compared ignoring case and spacing). */
    private function uniqueChairperson(?Jumuiya $ignore = null): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($ignore) {
            $chair = trim((string) $value);
            if ($chair === '') {
                return;
            }

            $existing = Jumuiya::query()
                ->with('kanda:id,name')
                ->whereRaw('lower(trim(chairperson)) = ?', [mb_strtolower($chair)])
                ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
                ->first();

            if ($existing) {
                $fail("{$existing->chairperson} tayari ni mwenyekiti wa jumuiya {$existing->name} (".($existing->kanda?->name ?? '—').'). Mwenyekiti mmoja hawezi kuongoza jumuiya mbili.');
            }
        };
    }

    private function present(Jumuiya $jumuiya): Jumuiya
    {
        $jumuiya->load(['kanda:id,name', 'parent:id,name']);
        $jumuiya->loadCount('members');

        return $jumuiya;
    }
}
