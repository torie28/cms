<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Support\ActivityLogger;
use App\Support\Modules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleController extends Controller
{
    public function index(): JsonResponse
    {
        Modules::sync();

        $modules = Module::query()
            ->withCount('users')
            ->orderBy('sort_order')
            ->get();

        return response()->json($modules);
    }

    public function update(Request $request, Module $module): JsonResponse
    {
        $this->ensureCan($request, 'settings', 'update');

        $data = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        abort_if(
            $module->is_core && array_key_exists('enabled', $data) && ! $data['enabled'],
            422,
            'Moduli hii ni ya msingi na haiwezi kuzimwa.',
        );

        $module->update($data);
        $module->loadCount('users');

        $action = match (true) {
            ! array_key_exists('enabled', $data) || $module->wasChanged('label') || $module->wasChanged('description') => 'updated',
            $data['enabled'] => 'enabled',
            default => 'disabled',
        };

        app(ActivityLogger::class)->record($request->user(), $action, 'module '.$module->label, 'module', $request);

        return response()->json($module);
    }
}
