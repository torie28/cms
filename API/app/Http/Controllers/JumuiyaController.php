<?php

namespace App\Http\Controllers;

use App\Models\Jumuiya;
use App\Support\ActivityLogger;
use App\Support\Recycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JumuiyaController extends Controller
{
    public function index(): JsonResponse
    {
        $jumuiyas = Jumuiya::query()
            ->with('kanda:id,name')
            ->withCount('members')
            ->orderBy('name')
            ->get();

        return response()->json($jumuiyas);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kanda_id' => ['required', 'integer', 'exists:kandas,id'],
            'chairperson' => ['nullable', 'string', 'max:255'],
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

    public function show(Jumuiya $jumuiya): JsonResponse
    {
        $jumuiya->load(['kanda:id,name', 'members']);
        $jumuiya->loadCount('members');

        return response()->json($jumuiya);
    }

    public function update(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kanda_id' => ['required', 'integer', 'exists:kandas,id'],
            'chairperson' => ['nullable', 'string', 'max:255'],
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

    public function destroy(Request $request, Jumuiya $jumuiya): JsonResponse
    {
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
}
