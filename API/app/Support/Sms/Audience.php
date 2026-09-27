<?php

namespace App\Support\Sms;

use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Kanda;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Turns an audience selection into concrete recipients. SMS recipients are
 * de-duplicated by phone number; in-app recipients are system users only.
 */
class Audience
{
    public const TYPES = ['all', 'kanda', 'jumuiya', 'users', 'custom'];

    /**
     * @param  array{kanda_ids?: list<int>, jumuiya_ids?: list<int>, member_ids?: list<int>, user_ids?: list<int>, phones?: list<string>}  $selection
     * @return array{sms: list<array<string, mixed>>, app: list<array<string, mixed>>, skipped: int, label: string}
     */
    public static function resolve(string $type, array $selection): array
    {
        $members = collect();
        $users = collect();
        $phones = [];

        switch ($type) {
            case 'all':
                $members = self::members();
                $users = User::query()->orderBy('name')->get(['id', 'name', 'phone']);
                $label = 'Wote waliosajiliwa';
                break;

            case 'kanda':
                $ids = $selection['kanda_ids'] ?? [];
                $members = self::members(fn ($query) => $query->whereHas('jumuiya', fn ($q) => $q->whereIn('kanda_id', $ids)));
                $label = self::names('Kanda', Kanda::query()->whereIn('id', $ids)->orderBy('name')->pluck('name'));
                break;

            case 'jumuiya':
                $ids = $selection['jumuiya_ids'] ?? [];
                $members = self::members(fn ($query) => $query->whereIn('jumuiya_id', $ids));
                $label = self::names('Jumuiya', Jumuiya::query()->whereIn('id', $ids)->orderBy('name')->pluck('name'));
                break;

            case 'users':
                $ids = $selection['user_ids'] ?? [];
                $users = User::query()
                    ->when($ids !== [], fn ($query) => $query->whereIn('id', $ids))
                    ->orderBy('name')
                    ->get(['id', 'name', 'phone']);
                $label = $ids === [] ? 'Watumiaji wote wa mfumo' : 'Watumiaji '.count($users).' wa mfumo';
                break;

            default:
                $members = self::members(fn ($query) => $query->whereIn('id', $selection['member_ids'] ?? []));
                $users = User::query()->whereIn('id', $selection['user_ids'] ?? [])->orderBy('name')->get(['id', 'name', 'phone']);
                $phones = $selection['phones'] ?? [];
                $total = count($members) + count($users) + count($phones);
                $label = 'Watu '.$total.' waliochaguliwa';
        }

        $sms = [];
        $skipped = 0;
        $add = function (string $recipientType, ?int $id, ?string $name, ?string $rawPhone, ?string $group) use (&$sms, &$skipped) {
            $phone = Phone::normalize($rawPhone);

            if ($phone === null) {
                $skipped++;

                return;
            }

            $sms[$phone] ??= [
                'recipient_type' => $recipientType,
                'recipient_id' => $id,
                'name' => $name,
                'phone' => $phone,
                'group_name' => $group,
            ];
        };

        foreach ($members as $member) {
            $add('member', $member->id, $member->name, $member->phone, $member->jumuiya?->name);
        }

        foreach ($users as $user) {
            $add('user', $user->id, $user->name, $user->phone, 'Mtumiaji wa mfumo');
        }

        foreach ($phones as $phone) {
            $add('phone', null, null, $phone, null);
        }

        $app = $users->map(fn (User $user) => [
            'recipient_type' => 'user',
            'recipient_id' => $user->id,
            'name' => $user->name,
            'phone' => Phone::normalize($user->phone),
            'group_name' => 'Mtumiaji wa mfumo',
        ])->values()->all();

        return ['sms' => array_values($sms), 'app' => $app, 'skipped' => $skipped, 'label' => $label];
    }

    private static function members(?callable $scope = null): Collection
    {
        return JumuiyaMember::query()
            ->whereHas('jumuiya')
            ->when($scope, $scope)
            ->with('jumuiya:id,name')
            ->orderBy('name')
            ->get(['id', 'jumuiya_id', 'name', 'phone']);
    }

    private static function names(string $prefix, Collection $names): string
    {
        $shown = $names->take(3)->implode(', ');
        $rest = $names->count() - 3;

        return $prefix.': '.$shown.($rest > 0 ? " na nyingine {$rest}" : '');
    }
}
