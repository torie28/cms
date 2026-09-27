<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['jumuiya_id', 'name', 'phone', 'gender'])]
class JumuiyaMember extends Model
{
    use SoftDeletes;

    public function jumuiya(): BelongsTo
    {
        return $this->belongsTo(Jumuiya::class);
    }
}
