<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['enabled', 'threshold', 'active', 'episode', 'last_notified_on', 'updated_by'])]
class SmsBalanceAlert extends Model
{
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'threshold' => 'integer',
            'active' => 'boolean',
            'episode' => 'integer',
            'last_notified_on' => 'date',
        ];
    }

    /** The parish keeps a single alert. */
    public static function current(): self
    {
        return static::query()->orderBy('id')->first() ?? static::query()->create([
            'enabled' => false,
        ]);
    }
}
