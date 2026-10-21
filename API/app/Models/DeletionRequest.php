<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'requester_id',
    'subject_type',
    'subject_id',
    'subject_label',
    'payload',
    'reason',
    'status',
    'reviewer_id',
    'reviewed_at',
    'review_note',
])]
class DeletionRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_KANDA = 'kanda';
    public const TYPE_JUMUIYA = 'jumuiya';
    public const TYPE_JUMUIYA_MEMBER = 'jumuiya_member';
    public const TYPE_USER = 'user';
    public const TYPE_ROLE = 'role';
    public const TYPE_OFFERING = 'offering';
    public const TYPE_ACTIVITY_LOG = 'activity_log';

    protected function casts(): array
    {
        return [
            'requester_id' => 'integer',
            'subject_id' => 'integer',
            'payload' => 'array',
            'reviewer_id' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public static function cancelPending(string $type, int $subjectId, User $reviewer, string $note): void
    {
        self::query()
            ->where('subject_type', $type)
            ->where('subject_id', $subjectId)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status' => self::STATUS_CANCELLED,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ]);
    }
}
