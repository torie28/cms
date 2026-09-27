<?php

namespace App\Models;

use Database\Factories\JumuiyaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'kanda_id', 'chairperson', 'notes'])]
class Jumuiya extends Model
{
    /** @use HasFactory<JumuiyaFactory> */
    use HasFactory, SoftDeletes;

    public function kanda(): BelongsTo
    {
        return $this->belongsTo(Kanda::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(JumuiyaMember::class);
    }
}
