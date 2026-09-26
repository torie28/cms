<?php

namespace App\Http\Controllers;

use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JumuiyaMemberController extends Controller
{
    public function index(Jumuiya $jumuiya): JsonResponse
    {
        return response()->json($jumuiya->members()->orderBy('name')->get());
    }

    public function store(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        if ($request->exists('members')) {
            return $this->storeMany($request, $jumuiya);
        }

        $member = $jumuiya->members()->create($this->validated($request));

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
        $this->ensureMember($jumuiya, $member);
        $member->update($this->validated($request));

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $member->name.' in '.$jumuiya->name,
            'jumuiya_member',
            $request,
        );

        return response()->json([
            'member' => $member,
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ]);
    }

    public function destroy(Request $request, Jumuiya $jumuiya, JumuiyaMember $member): JsonResponse
    {
        $this->ensureMember($jumuiya, $member);
        $name = $member->name;
        $member->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $name.' from '.$jumuiya->name,
            'jumuiya_member',
            $request,
        );

        return response()->json([
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ]);
    }

    private function storeMany(Request $request, Jumuiya $jumuiya): JsonResponse
    {
        $data = $request->validate([
            'members' => ['required', 'array', 'min:1'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.phone' => ['nullable', 'string', 'max:40'],
            'members.*.gender' => ['nullable', 'string', 'in:male,female'],
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
            'members' => $jumuiya->members()->orderBy('name')->get(),
            'jumuiya' => $this->presentJumuiya($jumuiya),
        ], 201);
    }

    /**
     * @return array{name: string, phone: string|null, gender: string|null}
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'gender' => ['nullable', 'string', 'in:male,female'],
        ]);
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
