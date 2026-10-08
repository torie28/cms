<?php

namespace App\Models;

use Database\Factories\KandaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'leader', 'notes'])]
class Kanda extends Model
{
    /** @use HasFactory<KandaFactory> */
    use HasFactory, SoftDeletes;

    public function jumuiyas(): HasMany
    {
        return $this->hasMany(Jumuiya::class);
    }

    public function members(): HasManyThrough
    {
        return $this->hasManyThrough(JumuiyaMember::class, Jumuiya::class);
    }
}
