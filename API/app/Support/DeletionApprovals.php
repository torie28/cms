<?php

namespace App\Support;

use App\Models\DeletionRequest;
use App\Models\SystemNotice;
use App\Models\User;
use App\Support\RecordDeletion;

/** Notifies admins about pending deletions and the requester about the decision. */
class DeletionApprovals
{
    public static function notifyAdmins(DeletionRequest $request): void
    {
        $requester = $request->requester?->name ?? 'Mtumiaji';
        $label = $request->subject_label;
        $type = self::typeLabel($request->subject_type);

        foreach (self::adminIds() as $userId) {
            SystemNotice::query()->updateOrCreate(
                ['user_id' => $userId, 'dedupe_key' => 'deletion-request:'.$request->id],
                [
                    'kind' => 'deletion_request',
                    'sender' => 'Mfumo',
                    'title' => "Ombi la kufuta {$type}",
                    'body' => "{$requester} anaomba kufuta {$type} \"{$label}\". Fungua Maombi ya kufuta ili uidhinishe au ukatae.",
                    'meta' => [
                        'request_id' => $request->id,
                        'subject_type' => $request->subject_type,
                        'subject_id' => $request->subject_id,
                        'subject_label' => $label,
                        'href' => '/settings/deletion-requests',
                    ],
                    'read_at' => null,
                ],
            );
        }
    }

    public static function notifyRequester(DeletionRequest $request, bool $approved): void
    {
        $type = self::typeLabel($request->subject_type);
        $label = $request->subject_label;
        $reviewer = $request->reviewer?->name ?? 'Msimamizi';

        SystemNotice::query()->create([
            'user_id' => $request->requester_id,
            'kind' => $approved ? 'deletion_approved' : 'deletion_rejected',
            'dedupe_key' => 'deletion-decision:'.$request->id.':'.($approved ? 'ok' : 'no'),
            'sender' => 'Mfumo',
            'title' => $approved ? "Ombi la kufuta limeidhinishwa" : 'Ombi la kufuta limekataliwa',
            'body' => $approved
                ? "{$reviewer} ameidhinisha kufuta {$type} \"{$label}\". Imefutwa kiotomatiki."
                : "{$reviewer} amekataa ombi lako la kufuta {$type} \"{$label}\"."
                    .($request->review_note ? ' Sababu: '.$request->review_note : ''),
            'meta' => [
                'request_id' => $request->id,
                'subject_type' => $request->subject_type,
                'subject_id' => $request->subject_id,
                'subject_label' => $label,
                'approved' => $approved,
            ],
        ]);
    }

    /** @return list<int> */
    public static function adminIds(): array
    {
        return User::query()
            ->where('role', Roles::ADMIN)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private static function typeLabel(string $type): string
    {
        return RecordDeletion::typeLabel($type);
    }
}
