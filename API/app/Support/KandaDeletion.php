<?php

namespace App\Support;

use App\Models\Kanda;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a kanda after optionally moving its jumuiyas to another kanda.
 * Used by the immediate admin delete and by approved deletion requests.
 */
class KandaDeletion
{
    /**
     * @return array{jumuiya_count: int, target: ?Kanda}
     */
    public static function prepare(Kanda $kanda, ?int $moveToKandaId): array
    {
        $jumuiyaCount = $kanda->jumuiyas()->count();
        $target = $moveToKandaId ? Kanda::query()->find($moveToKandaId) : null;

        if ($target && ((int) $target->id === (int) $kanda->id || $target->trashed())) {
            $target = null;
        }

        if ($jumuiyaCount > 0 && ! $target) {
            throw ValidationException::withMessages([
                'move_to_kanda_id' => ["Kanda hii ina jumuiya {$jumuiyaCount}. Chagua kanda ya kuzihamishia kabla ya kuifuta."],
            ]);
        }

        return ['jumuiya_count' => $jumuiyaCount, 'target' => $target];
    }

    /**
     * @param  array<string, mixed>|null  $extraDetails
     * @return array{moved: int, subject: string}
     */
    public static function run(
        ?User $actor,
        Kanda $kanda,
        ?int $moveToKandaId,
        ?Request $request = null,
        ?array $extraDetails = null,
    ): array {
        ['jumuiya_count' => $jumuiyaCount, 'target' => $target] = self::prepare($kanda, $moveToKandaId);

        $snapshot = Recycle::snapshot($kanda);

        DB::transaction(function () use ($kanda, $target) {
            if ($target) {
                $kanda->jumuiyas()->update(['kanda_id' => $target->id]);
            }
            $kanda->delete();
        });

        $subject = $kanda->name;
        if ($target && $jumuiyaCount > 0) {
            $subject .= ' ('.$jumuiyaCount.' jumuiyas moved to '.$target->name.')';
        }

        $details = ['snapshot' => $snapshot];
        if ($extraDetails) {
            $details = [...$details, ...$extraDetails];
        }

        app(ActivityLogger::class)->record(
            $actor,
            'deleted',
            $subject,
            'kanda',
            $request,
            $kanda,
            $details,
        );

        return ['moved' => $target ? $jumuiyaCount : 0, 'subject' => $subject];
    }
}
