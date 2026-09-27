<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Recycle;
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
        $this->ensureAdmin($request);

        $data = $request->validate([
            ...$this->rules(),
            'username' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('users', 'username')->withoutTrashed()],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->withoutTrashed()],
            'password' => ['required', 'string', 'min:4'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::query()->create(collect($data)->except('modules')->all());
            $this->syncModules($user, $data['modules'] ?? []);

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
        $this->ensureAdmin($request);

        $data = $request->validate([
            ...$this->rules(),
            'username' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)->withoutTrashed()],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)->withoutTrashed()],
            'password' => ['nullable', 'string', 'min:4'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $modulesBefore = $this->moduleLabels($user);

        DB::transaction(function () use ($user, $data) {
            $user->update(collect($data)->except('modules')->all());
            $this->syncModules($user, $data['modules'] ?? []);
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
        $this->ensureAdmin($request);

        abort_if($user->is($request->user()), 422, 'Huwezi kufuta akaunti yako mwenyewe.');

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
        ];
    }

    /**
     * @param  list<string>  $keys
     */
    private function syncModules(User $user, array $keys): void
    {
        $user->modules()->sync(Module::query()->whereIn('key', $keys)->pluck('id'));
    }

    private function moduleLabels(User $user): string
    {
        return Module::query()
            ->whereIn('id', $user->modules()->pluck('modules.id'))
            ->orderBy('sort_order')
            ->pluck('label')
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
            'created_at' => $user->created_at,
        ];
    }
}
