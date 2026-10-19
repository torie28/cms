<?php

namespace App\Support\Sms;

use App\Models\Module;
use App\Models\SmsBalanceAlert;
use App\Models\SystemNotice;
use App\Models\User;
use App\Support\Modules;
use App\Support\Roles;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Reminds people who can open Arifa na SMS when the live provider balance
 * (NextSMS, Beem or SEWMR) falls to the limit they chose. One reminder per day
 * while it stays low, and another after the balance recovers and drops again.
 */
class BalanceAlert
{
    private const CACHE_KEY = 'sms.balance.snapshot';

    /**
     * @return array{driver: string, provider: string, sender_id: string, test_mode: bool, available: int|float|null, rate: string|null, error: string|null}
     */
    public function snapshot(bool $fresh = false): array
    {
        if ($fresh) {
            Cache::forget(self::CACHE_KEY);
        }

        /** @var array{driver: string, provider: string, sender_id: string, test_mode: bool, available: int|float|null, rate: string|null, error: string|null} $balance */
        $balance = Cache::remember(
            self::CACHE_KEY,
            now()->addMinutes(3),
            fn () => app(SmsGateway::class)->balance(),
        );

        return $balance;
    }

    /**
     * Pulls the provider balance and posts a bell notification when it is at or
     * under the saved limit. A cached balance is reused so the bell poll does
     * not call NextSMS on every request.
     *
     * @return array{driver: string, provider: string, sender_id: string, test_mode: bool, available: int|float|null, rate: string|null, error: string|null}
     */
    public function sync(bool $fresh = false): array
    {
        $balance = $this->snapshot($fresh);
        $this->notifyIfLow($balance);

        return $balance;
    }

    /**
     * @param  array{available: int|float|null, provider?: string}  $balance
     * @return array{enabled: bool, threshold: int|null, low: bool}
     */
    public function describe(array $balance): array
    {
        $alert = SmsBalanceAlert::current();
        $available = $balance['available'] ?? null;

        return [
            'enabled' => $alert->enabled,
            'threshold' => $alert->threshold,
            'low' => $alert->enabled
                && $alert->threshold !== null
                && is_numeric($available)
                && (float) $available <= $alert->threshold,
        ];
    }

    /** @param  array{available: int|float|null, provider?: string}  $balance */
    private function notifyIfLow(array $balance): void
    {
        $available = $balance['available'] ?? null;

        if (! is_numeric($available)) {
            return;
        }

        $alertId = SmsBalanceAlert::current()->id;

        DB::transaction(function () use ($alertId, $balance, $available): void {
            $alert = SmsBalanceAlert::query()->lockForUpdate()->find($alertId);

            if ($alert === null || ! $alert->enabled || $alert->threshold === null) {
                return;
            }

            if ((float) $available > $alert->threshold) {
                if ($alert->active) {
                    $alert->active = false;
                    $alert->save();
                }

                return;
            }

            $today = now()->toDateString();

            if (! $alert->active || $alert->last_notified_on?->toDateString() !== $today) {
                $alert->episode++;
                $alert->active = true;
                $alert->last_notified_on = $today;
                $alert->save();
            }

            $this->deliver($alert, $balance, $available);
        });
    }

    /** @param  array{provider?: string}  $balance */
    private function deliver(SmsBalanceAlert $alert, array $balance, int|float|string $available): void
    {
        $shown = $this->countValue($available);
        $provider = trim((string) ($balance['provider'] ?? '')) ?: 'SMS';
        $empty = (float) $available <= 0;
        $title = $empty ? 'Salio la SMS limeisha' : 'Salio la SMS linakaribia kuisha';
        $body = $empty
            ? "Hakuna SMS iliyobaki kwa {$provider}. Ongeza salio ili uendelee kutuma ujumbe."
            : "Zimebaki SMS {$shown} kwa {$provider}. Kikomo ulichoweka ni {$alert->threshold}. Ongeza salio ili usikose kutuma ujumbe.";
        $meta = [
            'available' => $shown,
            'threshold' => (int) $alert->threshold,
            'provider' => $provider,
            'empty' => $empty,
        ];

        foreach ($this->recipientIds() as $userId) {
            SystemNotice::query()->firstOrCreate(
                ['user_id' => $userId, 'dedupe_key' => 'sms-low:'.$alert->episode],
                [
                    'kind' => 'sms_balance',
                    'sender' => $provider,
                    'title' => $title,
                    'body' => $body,
                    'meta' => $meta,
                ],
            );
        }
    }

    /** @return list<int> */
    private function recipientIds(): array
    {
        Modules::sync();

        $module = Module::query()->where('key', 'notifications')->where('enabled', true)->first();

        if ($module === null) {
            return [];
        }

        $assigned = $module->users()->pluck('users.id');
        $admins = User::query()->where('role', Roles::ADMIN)->pluck('id');

        return User::query()
            ->whereIn('id', $admins->merge($assigned)->unique()->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function countValue(int|float|string $available): int|float
    {
        $value = (float) $available;

        return fmod($value, 1.0) === 0.0 ? (int) $value : $value;
    }
}
