<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLogger
{
    /** Never copied into a log entry. */
    private const HIDDEN = ['password', 'remember_token'];

    /** Bookkeeping columns that add noise to a change list. */
    private const IGNORED = ['created_at', 'updated_at', 'deleted_at'];

    /**
     * @param  array<string, mixed>|null  $details  `snapshot` (what a deleted record looked like)
     *                                              and/or `changes` (field => [from, to]).
     */
    public function record(
        ?User $user,
        string $action,
        string $subject,
        ?string $subjectType = null,
        ?Request $request = null,
        ?Model $model = null,
        ?array $details = null,
    ): ActivityLog {
        return ActivityLog::query()->create([
            'user_id' => $user?->id,
            'actor' => $user?->name ?? 'System',
            'action' => $action,
            'subject' => $subject,
            'subject_type' => $subjectType,
            'subject_id' => $model?->getKey(),
            'details' => $details,
            'ip_address' => $request?->ip(),
        ]);
    }

    /**
     * What changed in the model's last save, as field => ['from' => old, 'to' => new].
     *
     * @param  array<string, string>  $labels  Optional readable names for fields.
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public static function changes(Model $model, array $labels = []): array
    {
        $previous = $model->getPrevious();
        $changes = [];

        foreach ($model->getChanges() as $field => $value) {
            if (in_array($field, self::IGNORED, true)) {
                continue;
            }

            $hidden = in_array($field, self::HIDDEN, true);
            $changes[$labels[$field] ?? $field] = [
                'from' => $hidden ? '••••' : ($previous[$field] ?? null),
                'to' => $hidden ? '•••• (limebadilishwa)' : $value,
            ];
        }

        return $changes;
    }
}
