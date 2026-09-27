<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'message_id', 'channel', 'recipient_type', 'recipient_id', 'name', 'phone', 'group_name', 'status', 'error', 'read_at',
])]
class MessageRecipient extends Model
{
    protected function casts(): array
    {
        return [
            'recipient_id' => 'integer',
            'read_at' => 'datetime',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
