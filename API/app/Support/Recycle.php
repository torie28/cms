<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Module;
use App\Models\Offering;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Everything that can be deleted and later restored from the activity log.
 * To make a new model restorable: add the SoftDeletes trait, register it in
 * TYPES, describe it in snapshot(), and log deletions with that snapshot.
 */
class Recycle
{
    /** @var array<string, class-string<Model>> */
    public const TYPES = [
        'user' => User::class,
        'role' => Role::class,
        'jumuiya' => Jumuiya::class,
        'jumuiya_member' => JumuiyaMember::class,
        'offering' => Offering::class,
    ];

    /** Deleted records can be restored for this long, then they are removed for good. */
    public const RETENTION_DAYS = 30;

    public const SYSTEM_ACTOR = 'Mfumo (baada ya siku 30)';

    public static function restoreDeadline(ActivityLog $log): Carbon
    {
        return $log->created_at->copy()->addDays(self::RETENTION_DAYS);
    }

    public static function isExpired(ActivityLog $log): bool
    {
        return self::restoreDeadline($log)->isPast();
    }

    /**
     * Permanently removes records whose restore window has passed. Their
     * snapshots stay in the activity log so they can still be viewed.
     *
     * @return int  How many deletions were finalised.
     */
    public static function purgeExpired(): int
    {
        $expired = ActivityLog::query()
            ->where('action', 'deleted')
            ->whereNotNull('subject_id')
            ->whereNull('restored_at')
            ->whereNull('purged_at')
            ->where('created_at', '<=', now()->subDays(self::RETENTION_DAYS))
            ->orderBy('id')
            ->get();

        $count = 0;

        foreach ($expired as $log) {
            $model = self::find((string) $log->subject_type, (int) $log->subject_id);

            try {
                DB::transaction(function () use ($model, $log) {
                    if ($model?->trashed()) {
                        $model->forceDelete();
                    }
                    $log->update(['purged_at' => now(), 'purged_by' => self::SYSTEM_ACTOR]);
                });
            } catch (QueryException) {
                // Still referenced by another deleted record (e.g. a role used by a deleted
                // user); it is retried on the next run, once that record has been purged.
                continue;
            }

            app(ActivityLogger::class)->record(
                null,
                'purged',
                $log->subject,
                $log->subject_type,
                null,
                null,
                ['purged_from_log' => $log->id, 'reason' => 'Siku '.self::RETENTION_DAYS.' zimepita'],
            );
            $count++;
        }

        return $count;
    }

    public static function find(string $type, int $id): ?Model
    {
        $class = self::TYPES[$type] ?? null;

        return $class ? $class::withTrashed()->find($id) : null;
    }

    /**
     * A readable copy of the record, stored in the log so admins can see what
     * was deleted even after it is removed permanently.
     *
     * @return array<string, mixed>
     */
    public static function snapshot(Model $model): array
    {
        return match (true) {
            $model instanceof User => [
                'Jina' => $model->name,
                'Jina la mtumiaji' => $model->username,
                'Barua pepe' => $model->email,
                'Simu' => $model->phone,
                'Jinsia' => self::gender($model->gender),
                'Wadhifa' => Role::withTrashed()->where('name', $model->role)->value('label') ?? $model->role,
                'Moduli' => $model->role === Roles::ADMIN
                    ? 'Zote'
                    : Module::query()->whereIn('id', $model->modules()->pluck('modules.id'))->orderBy('sort_order')->pluck('label')->join(', '),
                'Aliongezwa' => $model->created_at?->toDateTimeString(),
            ],
            $model instanceof Role => [
                'Jina la wadhifa' => $model->label,
                'Msimbo' => $model->name,
                'Maelezo' => $model->description,
            ],
            $model instanceof Jumuiya => [
                'Jina' => $model->name,
                'Kanda' => $model->kanda()->value('name'),
                'Mwenyekiti' => $model->chairperson,
                'Maelezo' => $model->notes,
                'Idadi ya wanajumuiya' => $model->members()->count(),
                'Wanajumuiya' => $model->members()->orderBy('name')->pluck('name')->join(', '),
            ],
            $model instanceof JumuiyaMember => [
                'Jina' => $model->name,
                'Simu' => $model->phone,
                'Jinsia' => self::gender($model->gender),
                'Jumuiya' => Jumuiya::withTrashed()->whereKey($model->jumuiya_id)->value('name'),
            ],
            $model instanceof Offering => [
                'Aina' => Offering::CATEGORIES[$model->category] ?? $model->category,
                'Kiasi' => 'TSh '.number_format((float) $model->amount, 2),
                'Tarehe' => $model->received_on?->toDateString(),
                'Njia ya malipo' => Offering::PAYMENT_METHODS[$model->payment_method] ?? $model->payment_method,
                'Jumuiya' => $model->jumuiya_id ? Jumuiya::withTrashed()->whereKey($model->jumuiya_id)->value('name') : null,
                'Mtoaji' => $model->contributor,
                'Namba ya risiti' => $model->reference,
                'Maelezo' => $model->notes,
                'Imerekodiwa na' => $model->recorded_by,
            ],
            default => $model->attributesToArray(),
        };
    }

    /** Why the record can't be restored right now, or null if it can. */
    public static function restoreBlocker(Model $model): ?string
    {
        if ($model instanceof User) {
            if (User::query()->where('username', $model->username)->exists()) {
                return "Jina la mtumiaji \"{$model->username}\" sasa linatumiwa na akaunti nyingine.";
            }
            if ($model->email && User::query()->where('email', $model->email)->exists()) {
                return "Barua pepe {$model->email} sasa inatumiwa na akaunti nyingine.";
            }
            if (Role::onlyTrashed()->where('name', $model->role)->exists()) {
                return 'Wadhifa wa mtumiaji huyu ulifutwa. Urejeshe wadhifa huo kwanza.';
            }
        }

        if ($model instanceof JumuiyaMember && Jumuiya::onlyTrashed()->whereKey($model->jumuiya_id)->exists()) {
            return 'Jumuiya yake ilifutwa. Rejesha jumuiya hiyo kwanza.';
        }

        return null;
    }

    private static function gender(?string $gender): ?string
    {
        return match ($gender) {
            'male' => 'Mwanaume',
            'female' => 'Mwanamke',
            default => null,
        };
    }
}
