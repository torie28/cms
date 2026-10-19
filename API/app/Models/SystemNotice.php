<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'kind', 'dedupe_key', 'sender', 'title', 'body', 'meta', 'read_at'])]
class SystemNotice extends Model
{
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'meta' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
