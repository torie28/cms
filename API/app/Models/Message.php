<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'sender', 'channel', 'audience', 'audience_ids', 'audience_label', 'title', 'body', 'status',
    'sms_count', 'sms_sent', 'sms_failed', 'sms_segments', 'app_count', 'skipped_count',
])]
class Message extends Model
{
    protected function casts(): array
    {
        return [
            'audience_ids' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(MessageRecipient::class);
    }
}
