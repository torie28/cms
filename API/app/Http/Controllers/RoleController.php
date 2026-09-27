<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Support\ActivityLogger;
use App\Support\Recycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::query()
            ->withCount('users')
            ->orderByDesc('is_system')
            ->orderBy('label')
            ->get();

        return response()->json($roles);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $name = Str::slug($data['label'], '_');

        $existing = $name === '' ? null : Role::withTrashed()->where('name', $name)->first();

        if ($name === '' || $existing) {
            throw ValidationException::withMessages([
                'label' => [$existing?->trashed()
                    ? 'Wadhifa wenye jina hili ulifutwa. Urejeshe kutoka Kumbukumbu za shughuli.'
                    : 'Wadhifa wenye jina hili tayari upo.'],
            ]);
        }

        $role = Role::query()->create([...$data, 'name' => $name]);
        $role->loadCount('users');

        app(ActivityLogger::class)->record($request->user(), 'created', $role->label, 'role', $request, $role);

        return response()->json($role, 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $role->update($data);
        $role->loadCount('users');

        $changes = ActivityLogger::changes($role, ['label' => 'Jina la wadhifa', 'description' => 'Maelezo']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $role->label,
            'role',
            $request,
            $role,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json($role);
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_if($role->is_system, 422, 'Wadhifa huu wa mfumo hauwezi kufutwa.');
        abort_if($role->users()->exists(), 422, 'Wadhifa huu una watumiaji. Wahamishie wadhifa mwingine kwanza.');

        $snapshot = Recycle::snapshot($role);
        $role->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $role->label,
            'role',
            $request,
            $role,
            ['snapshot' => $snapshot],
        );

        return response()->json(['message' => 'Role removed.']);
    }
}
