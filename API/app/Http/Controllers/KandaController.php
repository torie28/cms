<?php

namespace App\Http\Controllers;

use App\Models\Kanda;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
