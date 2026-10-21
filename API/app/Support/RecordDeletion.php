<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Kanda;
use App\Models\Offering;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Runs the actual delete (or permanent purge) after an admin approves a request,
 * or when an admin deletes immediately.
 */
class RecordDeletion
{
    /** @var list<string> */
    public const TYPES = [
        'kanda',
        'jumuiya',
        'jumuiya_member',
        'user',
        'role',
        'offering',
        'activity_log',
    ];

    public static function moduleFor(string $type): string
    {
        return match ($type) {
            'kanda' => 'kanda',
            'jumuiya', 'jumuiya_member' => 'jumuiya',
            'user', 'role' => 'users',
            'offering' => 'sadaka',
            'activity_log' => 'activity_logs',
            default => abort(422, 'Aina hiyo ya ombi haitambuliki.'),
        };
    }

    public static function typeLabel(string $type): string
    {
        return match ($type) {
            'kanda' => 'kanda',
            'jumuiya' => 'jumuiya',
            'jumuiya_member' => 'mwanajumuiya',
            'user' => 'mtumiaji',
            'role' => 'wadhifa',
            'offering' => 'sadaka/mchango',
            'activity_log' => 'kumbukumbu (futa kabisa)',
            default => $type,
        };
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array{label: string, payload: array<string, mixed>}
     */
    public static function prepare(string $type, int $id, ?User $actor, ?array $payload = null): array
    {
        $payload = $payload ?? [];

        return match ($type) {
            'kanda' => self::prepareKanda($id, $payload),
            'jumuiya' => self::prepareJumuiya($id),
            'jumuiya_member' => self::prepareMember($id, $payload),
            'user' => self::prepareUser($id, $actor),
            'role' => self::prepareRole($id),
            'offering' => self::prepareOffering($id),
            'activity_log' => self::prepareActivityLog($id),
            default => abort(422, 'Aina hiyo ya ombi haitambuliki.'),
        };
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    public static function run(
        ?User $actor,
        string $type,
        int $id,
        ?Request $request = null,
        ?array $payload = null,
        ?array $extraDetails = null,
    ): array {
        $payload = $payload ?? [];

        return match ($type) {
            'kanda' => KandaDeletion::run(
                $actor,
                Kanda::query()->findOrFail($id),
                isset($payload['move_to_kanda_id']) ? (int) $payload['move_to_kanda_id'] : null,
                $request,
                $extraDetails,
            ),
            'jumuiya' => self::deleteSoft($actor, Jumuiya::query()->findOrFail($id), 'jumuiya', $request, $extraDetails),
            'jumuiya_member' => self::deleteMember($actor, $id, $payload, $request, $extraDetails),
            'user' => self::deleteUser($actor, $id, $request, $extraDetails),
            'role' => self::deleteRole($actor, $id, $request, $extraDetails),
            'offering' => self::deleteOffering($actor, $id, $request, $extraDetails),
            'activity_log' => self::purgeActivityLog($actor, $id, $request, $extraDetails),
            default => abort(422, 'Aina hiyo ya ombi haitambuliki.'),
        };
    }

    /** @param  array<string, mixed>  $payload */
    private static function prepareKanda(int $id, array $payload): array
    {
        $kanda = Kanda::query()->findOrFail($id);
        $moveTo = isset($payload['move_to_kanda_id']) ? (int) $payload['move_to_kanda_id'] : null;
        ['target' => $target] = KandaDeletion::prepare($kanda, $moveTo);

        return [
            'label' => $kanda->name,
            'payload' => [
                'move_to_kanda_id' => $moveTo,
                'move_to_kanda_name' => $target?->name,
            ],
        ];
    }

    private static function prepareJumuiya(int $id): array
    {
        $jumuiya = Jumuiya::query()->findOrFail($id);

        return ['label' => $jumuiya->name, 'payload' => []];
    }

    /** @param  array<string, mixed>  $payload */
    private static function prepareMember(int $id, array $payload): array
    {
        $member = JumuiyaMember::query()->findOrFail($id);
        $jumuiyaId = (int) ($payload['jumuiya_id'] ?? $member->jumuiya_id);
        $jumuiya = Jumuiya::query()->findOrFail($jumuiyaId);

        abort_unless((int) $member->jumuiya_id === (int) $jumuiya->id, 422, 'Mwanajumuiya huyo si wa jumuiya hiyo.');

        return [
            'label' => $member->name.' ('.$jumuiya->name.')',
            'payload' => ['jumuiya_id' => $jumuiya->id, 'jumuiya_name' => $jumuiya->name],
        ];
    }

    private static function prepareUser(int $id, ?User $actor): array
    {
        $user = User::query()->findOrFail($id);

        abort_if($actor && $user->is($actor), 422, 'Huwezi kufuta akaunti yako mwenyewe.');
        abort_if(
            $user->role === Roles::ADMIN && $actor?->role !== Roles::ADMIN,
            403,
            'Ni msimamizi pekee anayeweza kufuta msimamizi.',
        );

        return [
            'label' => $user->name.' ('.$user->username.')',
            'payload' => [],
        ];
    }

    private static function prepareRole(int $id): array
    {
        $role = Role::query()->findOrFail($id);

        abort_if($role->is_system, 422, 'Wadhifa huu wa mfumo hauwezi kufutwa.');
        abort_if($role->users()->exists(), 422, 'Wadhifa huu una watumiaji. Wahamishie wadhifa mwingine kwanza.');

        return ['label' => $role->label, 'payload' => []];
    }

    private static function prepareOffering(int $id): array
    {
        $offering = Offering::query()->with('jumuiya:id,name')->findOrFail($id);

        return ['label' => self::offeringLabel($offering), 'payload' => []];
    }

    private static function prepareActivityLog(int $id): array
    {
        $log = ActivityLog::query()->findOrFail($id);
        self::deletedModelForPurge($log);

        return [
            'label' => (string) $log->subject,
            'payload' => ['subject_type' => $log->subject_type],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function deleteSoft(
        ?User $actor,
        Model $model,
        string $type,
        ?Request $request,
        ?array $extraDetails,
        ?string $subject = null,
    ): array {
        $snapshot = Recycle::snapshot($model);
        $label = $subject ?? (string) ($model->getAttribute('name') ?? $model->getAttribute('label') ?? $model->getKey());
        $model->delete();

        $details = ['snapshot' => $snapshot];
        if ($extraDetails) {
            $details = [...$details, ...$extraDetails];
        }

        app(ActivityLogger::class)->record($actor, 'deleted', $label, $type, $request, $model, $details);

        return [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function deleteMember(
        ?User $actor,
        int $id,
        array $payload,
        ?Request $request,
        ?array $extraDetails,
    ): array {
        $member = JumuiyaMember::query()->findOrFail($id);
        $jumuiya = Jumuiya::query()->findOrFail((int) ($payload['jumuiya_id'] ?? $member->jumuiya_id));
        abort_unless((int) $member->jumuiya_id === (int) $jumuiya->id, 422, 'Mwanajumuiya huyo si wa jumuiya hiyo.');

        return self::deleteSoft(
            $actor,
            $member,
            'jumuiya_member',
            $request,
            $extraDetails,
            $member->name.' from '.$jumuiya->name,
        );
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function deleteUser(?User $actor, int $id, ?Request $request, ?array $extraDetails): array
    {
        $user = User::query()->findOrFail($id);
        self::prepareUser($id, $actor);

        $subject = $user->name.' ('.$user->username.')';
        $snapshot = Recycle::snapshot($user);
        $user->tokens()->delete();
        $user->delete();

        $details = ['snapshot' => $snapshot];
        if ($extraDetails) {
            $details = [...$details, ...$extraDetails];
        }

        app(ActivityLogger::class)->record($actor, 'deleted', $subject, 'user', $request, $user, $details);

        return [];
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function deleteRole(?User $actor, int $id, ?Request $request, ?array $extraDetails): array
    {
        $role = Role::query()->findOrFail($id);
        self::prepareRole($id);

        return self::deleteSoft($actor, $role, 'role', $request, $extraDetails, $role->label);
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function deleteOffering(?User $actor, int $id, ?Request $request, ?array $extraDetails): array
    {
        $offering = Offering::query()->with('jumuiya:id,name')->findOrFail($id);

        return self::deleteSoft(
            $actor,
            $offering,
            'offering',
            $request,
            $extraDetails,
            self::offeringLabel($offering),
        );
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved?: int}
     */
    private static function purgeActivityLog(?User $actor, int $id, ?Request $request, ?array $extraDetails): array
    {
        $log = ActivityLog::query()->findOrFail($id);
        $model = self::deletedModelForPurge($log);

        try {
            DB::transaction(function () use ($model, $log, $actor) {
                $model->forceDelete();
                $log->update([
                    'purged_at' => now(),
                    'purged_by' => $actor?->name ?? Recycle::SYSTEM_ACTOR,
                    'details' => Recycle::scrubDetails($log->details),
                ]);
            });
        } catch (QueryException) {
            abort(422, 'Haiwezi kufutwa kabisa kwa sababu bado kuna kumbukumbu zinazoitegemea (mf. watumiaji waliofutwa wenye wadhifa huu).');
        }

        $details = ['purged_from_log' => $log->id];
        if ($extraDetails) {
            $details = [...$details, ...$extraDetails];
        }

        app(ActivityLogger::class)->record(
            $actor,
            'purged',
            $log->subject,
            $log->subject_type,
            $request,
            null,
            $details,
        );

        return [];
    }

    private static function deletedModelForPurge(ActivityLog $log): Model
    {
        abort_unless($log->action === 'deleted' && $log->subject_id, 422, 'Kumbukumbu hii si ya kitu kilichofutwa.');
        abort_if($log->restored_at !== null, 422, 'Kitu hiki tayari kimerejeshwa.');
        abort_if($log->purged_at !== null, 422, 'Kitu hiki kilishafutwa kabisa.');
        abort_if(
            Recycle::isExpired($log),
            422,
            'Siku '.Recycle::RETENTION_DAYS.' za kurejesha zimepita. Kitu hiki kinaweza kuangaliwa tu, si kurejeshwa.',
        );

        $model = Recycle::find((string) $log->subject_type, (int) $log->subject_id);

        abort_if($model === null, 422, 'Kitu hiki hakipo tena kwenye mfumo.');
        abort_unless($model->trashed(), 422, 'Kitu hiki tayari kimerejeshwa.');

        return $model;
    }

    private static function offeringLabel(Offering $offering): string
    {
        $subject = Offering::CATEGORIES[$offering->category].' TSh '.number_format((float) $offering->amount)
            .' ('.$offering->received_on->toDateString().')';
        $from = $offering->contributor ?: $offering->jumuiya?->name;

        return $from ? $subject.' from '.$from : $subject;
    }
}
