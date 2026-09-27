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

    public static function canAccess(User $user, string $key): bool
    {
        return in_array($key, self::accessibleBy($user), true);
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
