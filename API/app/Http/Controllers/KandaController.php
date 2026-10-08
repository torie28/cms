<?php

namespace App\Http\Controllers;

use App\Models\Kanda;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KandaController extends Controller
{
    public function index(): JsonResponse
    {
        $kandas = Kanda::query()
            ->withCount('jumuiyas')
            ->orderBy('name')
            ->get();

        return response()->json($kandas);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'kanda', 'create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:kandas,name'],
            'leader' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $kanda = Kanda::query()->create($data);
        $kanda->loadCount('jumuiyas');

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $kanda->name,
            'kanda',
            $request,
        );

        return response()->json($kanda, 201);
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
            'kandas' => Kanda::query()->withCount('jumuiyas')->orderBy('name')->get(),
        ], 201);
    }
}
