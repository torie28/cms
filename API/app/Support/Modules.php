<?php

namespace App\Support;

use App\Models\Module;
use App\Models\User;

class Modules
{
    /**
     * Every module the app knows about. Adding an entry here is enough to make it
     * appear in System settings and in the user-assignment dialog; it is inserted
     * into the `modules` table on the next read. Core modules cannot be disabled.
     *
     * @var list<array{key: string, label: string, description: string, is_core?: bool}>
     */
    public const DEFINITIONS = [
        ['key' => 'dashboard', 'label' => 'Muhtasari', 'description' => 'Muhtasari wa takwimu za parokia.', 'is_core' => true],
        ['key' => 'users', 'label' => 'Watumiaji', 'description' => 'Akaunti za watumiaji na nyadhifa zao.'],
        ['key' => 'sadaka', 'label' => 'Sadaka', 'description' => 'Kumbukumbu za sadaka na michango.'],
        ['key' => 'jumuiya', 'label' => 'Jumuiya', 'description' => 'Jumuiya ndogo ndogo na wanachama wake.'],
        ['key' => 'kanda', 'label' => 'Kanda', 'description' => 'Kanda za parokia.'],
        ['key' => 'notifications', 'label' => 'Arifa na SMS', 'description' => 'Kutuma SMS na arifa kwa waumini, jumuiya, kanda au watumiaji wa mfumo.'],
        ['key' => 'settings', 'label' => 'Mipangilio ya mfumo', 'description' => 'Mipangilio ya mfumo na moduli zake.', 'is_core' => true],
        ['key' => 'api_settings', 'label' => 'API na huduma za nje', 'description' => 'Nyeti: funguo za SMS, barua pepe na huduma nyingine za nje.', 'is_core' => true],
        ['key' => 'activity_logs', 'label' => 'Kumbukumbu za shughuli', 'description' => 'Nyeti: inaonyesha nani alifanya nini na lini. Mpe tu anayehitaji.', 'is_core' => true],
    ];

    /**
     * Write actions each module actually has. View access is the module assignment itself.
     *
     * @var array<string, list<'create'|'update'|'delete'>>
     */
    public const ACTIONS = [
        'users' => ['create', 'update', 'delete'],
        'sadaka' => ['create', 'update', 'delete'],
        'jumuiya' => ['create', 'update', 'delete'],
        'kanda' => ['create'],
        'notifications' => ['create'],
        'settings' => ['update'],
        'api_settings' => ['update'],
        'activity_logs' => ['update', 'delete'],
    ];

    public static function canAccess(User $user, string $key): bool
    {
        return in_array($key, self::accessibleBy($user), true);
    }

    public static function can(?User $user, string $key, string $action): bool
    {
        if ($user === null || ! in_array($action, self::ACTIONS[$key] ?? [], true)) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return self::canAccess($user, $key);
        }

        $module = $user->modules->firstWhere('key', $key) ?? $user->modules()->where('key', $key)->first();

        return $module !== null && (bool) $module->pivot->{'can_'.$action};
    }

    /**
     * @param  array<string, mixed>  $given
     * @return array{can_create: bool, can_update: bool, can_delete: bool}
     */
    public static function flags(string $key, array $given, bool $defaultWhenMissing): array
    {
        $actions = self::ACTIONS[$key] ?? [];
        $flags = ['can_create' => false, 'can_update' => false, 'can_delete' => false];

        foreach (['create' => 'can_create', 'update' => 'can_update', 'delete' => 'can_delete'] as $action => $column) {
            if (! in_array($action, $actions, true)) {
                continue;
            }

            $flags[$column] = array_key_exists($action, $given)
                ? (bool) $given[$action]
                : $defaultWhenMissing;
        }

        return $flags;
    }

    /**
     * @return array<string, array{create: bool, update: bool, delete: bool}>
     */
    public static function privilegesFor(User $user): array
    {
        $privileges = [];

        if ($user->role === Roles::ADMIN) {
            foreach (self::accessibleBy($user) as $key) {
                if (! isset(self::ACTIONS[$key])) {
                    continue;
                }

                $privileges[$key] = self::full($key);
            }

            return $privileges;
        }

        $user->loadMissing('modules');

        foreach ($user->modules as $module) {
            if (! isset(self::ACTIONS[$module->key])) {
                continue;
            }

            $actions = self::ACTIONS[$module->key];
            $privileges[$module->key] = [
                'create' => in_array('create', $actions, true) && (bool) $module->pivot->can_create,
                'update' => in_array('update', $actions, true) && (bool) $module->pivot->can_update,
                'delete' => in_array('delete', $actions, true) && (bool) $module->pivot->can_delete,
            ];
        }

        return $privileges;
    }

    /**
     * @return array{create: bool, update: bool, delete: bool}
     */
    private static function full(string $key): array
    {
        $actions = self::ACTIONS[$key];

        return [
            'create' => in_array('create', $actions, true),
            'update' => in_array('update', $actions, true),
            'delete' => in_array('delete', $actions, true),
        ];
    }

    public static function sync(): void
    {
        $existing = Module::query()->pluck('key')->all();

        foreach (self::DEFINITIONS as $index => $definition) {
            if (in_array($definition['key'], $existing, true)) {
                continue;
            }

            Module::query()->create([
                'key' => $definition['key'],
                'label' => $definition['label'],
                'description' => $definition['description'],
                'is_core' => $definition['is_core'] ?? false,
                'enabled' => true,
                'sort_order' => $index,
            ]);
        }
    }

    /**
     * Module keys the user may open: admins get every enabled module, everyone
     * else gets the enabled modules assigned to them plus the core dashboard.
     *
     * @return list<string>
     */
    public static function accessibleBy(User $user): array
    {
        self::sync();

        $enabled = Module::query()->where('enabled', true)->orderBy('sort_order');

        if ($user->role === Roles::ADMIN) {
            return $enabled->pluck('key')->all();
        }

        $assigned = $user->modules()->pluck('key')->all();

        return $enabled
            ->where(fn ($query) => $query->whereIn('key', $assigned)->orWhere('key', 'dashboard'))
            ->pluck('key')
            ->all();
    }
}
