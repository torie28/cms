<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'actor', 'action', 'subject', 'subject_type', 'subject_id', 'details', 'ip_address',
    'restored_at', 'restored_by', 'purged_at', 'purged_by',
])]
class ActivityLog extends Model
{
    protected function casts(): array
    {
        return [
            'details' => 'array',
            'restored_at' => 'datetime',
            'purged_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
