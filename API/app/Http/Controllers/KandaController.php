<?php

namespace App\Http\Controllers;

use App\Models\Kanda;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Recycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class KandaController extends Controller
{
    public function index(): JsonResponse
    {
        $kandas = Kanda::query()
            ->withCount(['jumuiyas', 'members'])
            ->orderBy('name')
            ->get();

        return response()->json($kandas);
    }

    /**
     * Everything the kanda dashboard needs: headline counts, gender split and each
     * jumuiya with its size, origin (if it was split off) and offerings this year.
     */
    public function show(Request $request, Kanda $kanda): JsonResponse
    {
        $showOfferings = Modules::canAccess($request->user(), 'sadaka');
        $yearStart = now()->startOfYear()->toDateString();

        $kanda->loadCount([
            'jumuiyas',
            'members',
            'members as male_count' => fn ($query) => $query->where('jumuiya_members.gender', 'male'),
            'members as female_count' => fn ($query) => $query->where('jumuiya_members.gender', 'female'),
        ]);

        $jumuiyas = $kanda->jumuiyas()
            ->with('parent:id,name')
            ->withCount([
                'members',
                'children',
                'members as male_count' => fn ($query) => $query->where('gender', 'male'),
                'members as female_count' => fn ($query) => $query->where('gender', 'female'),
            ])
            ->when($showOfferings, fn ($query) => $query->withSum(
                ['offerings as offerings_year' => fn ($offerings) => $offerings->where('received_on', '>=', $yearStart)],
                'amount',
            ))
            ->orderBy('name')
            ->get();

        return response()->json([
            ...$kanda->toArray(),
            'jumuiyas' => $jumuiyas,
            'offerings_year' => $showOfferings ? (float) $jumuiyas->sum('offerings_year') : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'kanda', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('kandas', 'name')->withoutTrashed()],
            'leader' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $kanda = Kanda::query()->create($data);
        $kanda->loadCount(['jumuiyas', 'members']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $kanda->name,
            'kanda',
            $request,
        );

        return response()->json($kanda, 201);
    }

    public function update(Request $request, Kanda $kanda): JsonResponse
    {
        $this->ensureCan($request, 'kanda', 'update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('kandas', 'name')->ignore($kanda->id)->withoutTrashed()],
            'leader' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $kanda->update($data);
        $changes = ActivityLogger::changes($kanda, [
            'name' => 'Jina',
            'leader' => 'Kiongozi',
            'notes' => 'Maelezo',
        ]);
        $kanda->loadCount(['jumuiyas', 'members']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $kanda->name,
            'kanda',
            $request,
            $kanda,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json($kanda);
    }

    /**
     * Soft-deletes a kanda. Its jumuiyas must not be lost with it, so a kanda that still
     * has any must name another kanda (`move_to_kanda_id`) to take them over first.
     */
    public function destroy(Request $request, Kanda $kanda): JsonResponse
    {
        $this->ensureCan($request, 'kanda', 'delete');

        $data = $request->validate([
            'move_to_kanda_id' => [
                'nullable',
                'integer',
                Rule::notIn([$kanda->id]),
                Rule::exists('kandas', 'id')->withoutTrashed(),
            ],
        ]);

        $jumuiyaCount = $kanda->jumuiyas()->count();
        $target = isset($data['move_to_kanda_id']) ? Kanda::query()->find($data['move_to_kanda_id']) : null;

        abort_if(
            $jumuiyaCount > 0 && ! $target,
            422,
            "Kanda hii ina jumuiya {$jumuiyaCount}. Chagua kanda ya kuzihamishia kabla ya kuifuta.",
        );

        $snapshot = Recycle::snapshot($kanda);

        DB::transaction(function () use ($kanda, $target) {
            if ($target) {
                $kanda->jumuiyas()->update(['kanda_id' => $target->id]);
            }
            $kanda->delete();
        });

        $subject = $kanda->name;
        if ($target && $jumuiyaCount > 0) {
            $subject .= ' ('.$jumuiyaCount.' jumuiyas moved to '.$target->name.')';
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $subject,
            'kanda',
            $request,
            $kanda,
            ['snapshot' => $snapshot],
        );

        return response()->json(['message' => 'Kanda removed.', 'moved' => $target ? $jumuiyaCount : 0]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'kanda', 'create');

        $data = $request->validate([
            'kandas' => ['required', 'array', 'min:1', 'max:500'],
            'kandas.*.name' => ['required', 'string', 'max:255', 'distinct:ignore_case'],
            'kandas.*.leader' => ['nullable', 'string', 'max:255'],
            'kandas.*.notes' => ['nullable', 'string'],
            'file' => ['nullable', 'string', 'max:255'],
        ]);

        $existing = Kanda::query()
            ->pluck('name')
            ->map(fn (string $name) => mb_strtolower(trim($name)))
            ->flip();

        [$skipped, $fresh] = collect($data['kandas'])
            ->map(fn (array $row) => [...$row, 'name' => trim($row['name'])])
            ->partition(fn (array $row) => $existing->has(mb_strtolower($row['name'])));

        DB::transaction(function () use ($fresh) {
            foreach ($fresh as $row) {
                Kanda::query()->create($row);
            }
        });

        if ($fresh->isNotEmpty()) {
            $subject = $fresh->count().' kandas';
            if (! empty($data['file'])) {
                $subject .= ' from '.$data['file'];
            }

            app(ActivityLogger::class)->record(
                $request->user(),
                'imported',
                $subject,
                'kanda',
                $request,
            );
        }

        return response()->json([
            'created' => $fresh->count(),
            'skipped' => $skipped->pluck('name')->values(),
            'kandas' => Kanda::query()->withCount(['jumuiyas', 'members'])->orderBy('name')->get(),
        ], 201);
    }
}
