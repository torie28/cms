<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'topic', 'kind', 'name', 'body', 'is_default', 'is_system',
])]
class MessageTemplate extends Model
{
    /** Templates used when composing a broadcast on Arifa na SMS. */
    public const KIND_COMPOSE = 'compose';

    /** Templates used for the automatic thank-you SMS after recording an offering. */
    public const KIND_THANK_YOU = 'thank_you';

    /** @var list<string> */
    public const KINDS = [self::KIND_COMPOSE, self::KIND_THANK_YOU];

    /** Topics that may have an automatic thank-you template. */
    public const THANK_YOU_TOPICS = [
        'sadaka', 'zaka', 'fungu_la_kumi', 'majitoleo', 'shukrani', 'ujenzi',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_system' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
