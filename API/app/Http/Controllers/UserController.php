<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Recycle;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const FIELD_LABELS = [
        'name' => 'Jina',
        'username' => 'Jina la mtumiaji',
        'email' => 'Barua pepe',
        'phone' => 'Simu',
        'gender' => 'Jinsia',
        'role' => 'Wadhifa',
        'password' => 'Nenosiri',
    ];

    public function index(): JsonResponse
    {
        $users = User::query()
            ->with('modules:id,key')
            ->orderBy('name')
            ->get();

        return response()->json($users->map(fn (User $user) => $this->present($user)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'users', 'create');

        $data = $request->validate([
            ...$this->rules(),
            'username' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('users', 'username')->withoutTrashed()],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->withoutTrashed()],
            'password' => ['required', 'string', 'min:4'],
        ]);

        $this->guardAssignment($request, $data);

        $user = DB::transaction(function () use ($data) {
            $user = User::query()->create(collect($data)->except(['modules', 'privileges'])->all());
            $this->syncModules($user, $data['modules'] ?? [], $data['privileges'] ?? []);

            return $user;
        });

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            $user->name.' ('.$user->username.')',
            'user',
            $request,
            $user,
        );

        return response()->json($this->present($user->load('modules:id,key')), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->ensureCan($request, 'users', 'update');

        $data = $request->validate([
            ...$this->rules(),
            'username' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)->withoutTrashed()],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)->withoutTrashed()],
            'password' => ['nullable', 'string', 'min:4'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $this->guardAssignment($request, $data, $user);

        $modulesBefore = $this->moduleLabels($user);

        DB::transaction(function () use ($user, $data) {
            $user->update(collect($data)->except(['modules', 'privileges'])->all());
            $this->syncModules($user, $data['modules'] ?? [], $data['privileges'] ?? []);
        });

        $changes = ActivityLogger::changes($user, self::FIELD_LABELS);
        $modulesAfter = $this->moduleLabels($user);
        if ($modulesBefore !== $modulesAfter) {
            $changes['Moduli'] = ['from' => $modulesBefore, 'to' => $modulesAfter];
        }

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $user->name.' ('.$user->username.')',
            'user',
            $request,
            $user,
            $changes ? ['changes' => $changes] : null,
        );

        return response()->json($this->present($user->load('modules:id,key')));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->ensureCan($request, 'users', 'delete');

        abort_if($user->is($request->user()), 422, 'Huwezi kufuta akaunti yako mwenyewe.');
        abort_if(
            $user->role === Roles::ADMIN && $request->user()->role !== Roles::ADMIN,
            403,
            'Ni msimamizi pekee anayeweza kufuta msimamizi.',
        );

        $subject = $user->name.' ('.$user->username.')';
        $snapshot = Recycle::snapshot($user);
        $user->tokens()->delete();
        $user->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            $subject,
            'user',
            $request,
            $user,
            ['snapshot' => $snapshot],
        );

        return response()->json(['message' => 'User removed.']);
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'gender' => ['nullable', 'string', 'in:male,female'],
            'role' => ['required', 'string', Rule::exists('roles', 'name')->whereNull('deleted_at')],
            'modules' => ['sometimes', 'array'],
            'modules.*' => ['string', 'distinct', 'exists:modules,key'],
            'privileges' => ['sometimes', 'array'],
            'privileges.*' => ['array'],
            'privileges.*.create' => ['sometimes', 'boolean'],
            'privileges.*.update' => ['sometimes', 'boolean'],
            'privileges.*.delete' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * A non-admin may grant only modules and actions they already have, and may not
     * create or edit an administrator. Privileges the account already has can stay.
     *
     * @param  array<string, mixed>  $data
     */
    private function guardAssignment(Request $request, array $data, ?User $target = null): void
    {
        $actor = $request->user();

        if ($actor->role === Roles::ADMIN) {
            return;
        }

        abort_if($target?->is($actor), 403, 'Huwezi kujihariri mwenyewe kupitia orodha hii.');
        abort_if(
            $target?->role === Roles::ADMIN || ($data['role'] ?? null) === Roles::ADMIN,
            403,
            'Ni msimamizi pekee anayeweza kugawa wadhifa wa msimamizi.',
        );

        $target?->loadMissing('modules');
        $privileges = $data['privileges'] ?? [];

        foreach ($data['modules'] ?? [] as $key) {
            $existing = $target?->modules->firstWhere('key', $key);

            abort_if(
                $existing === null && ! Modules::canAccess($actor, $key),
                403,
                'Huwezi kumpa moduli usiyo nayo.',
            );

            $given = is_array($privileges[$key] ?? null) ? $privileges[$key] : [];

            foreach (Modules::ACTIONS[$key] ?? [] as $action) {
                $wanted = array_key_exists($action, $given)
                    ? (bool) $given[$action]
                    : ($existing === null);
                $had = $existing !== null && (bool) $existing->pivot->{'can_'.$action};

                abort_if(
                    $wanted && ! $had && ! Modules::can($actor, $key, $action),
                    403,
                    'Huwezi kumpa ruhusa usiyo nayo.',
                );
            }
        }
    }

    /**
     * @param  list<string>  $keys
     * @param  array<string, mixed>  $privileges
     */
    private function syncModules(User $user, array $keys, array $privileges): void
    {
        $modules = Module::query()->whereIn('key', $keys)->get();
        $sync = [];

        foreach ($modules as $module) {
            $given = is_array($privileges[$module->key] ?? null) ? $privileges[$module->key] : [];
            $sync[$module->id] = Modules::flags($module->key, $given, $given === []);
        }

        $user->modules()->sync($sync);
    }

    private function moduleLabels(User $user): string
    {
        return $user->modules()
            ->orderBy('sort_order')
            ->get()
            ->map(function (Module $module) {
                $parts = array_filter([
                    $module->pivot->can_create ? 'ongeza' : null,
                    $module->pivot->can_update ? 'hariri' : null,
                    $module->pivot->can_delete ? 'futa' : null,
                ]);

                return $module->label.' ('.($parts === [] ? 'kuona tu' : implode(', ', $parts)).')';
            })
            ->join(', ');
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'gender' => $user->gender,
            'role' => $user->role,
            'modules' => $user->modules->pluck('key')->values(),
            'privileges' => Modules::privilegesFor($user),
            'created_at' => $user->created_at,
        ];
    }
}
