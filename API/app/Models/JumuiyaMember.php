<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'jumuiya_id',
    'first_name',
    'middle_name',
    'last_name',
    'phone',
    'gender',
    'community_role',
    'zone_role',
])]
class JumuiyaMember extends Model
{
    use SoftDeletes;

    /**
     * The five leadership posts a person can hold, at the community level and the
     * zone level independently. A blank role means an ordinary member. The treasurer
     * has no assistant, which is why there are five, not six.
     */
    public const ROLES = ['chair', 'vice_chair', 'secretary', 'vice_secretary', 'treasurer'];

    /** The full name is shown and logged; it is built from the three stored parts. */
    protected $appends = ['name'];

    public function jumuiya(): BelongsTo
    {
        return $this->belongsTo(Jumuiya::class);
    }

    protected function name(): Attribute
    {
        return Attribute::get(fn (): string => trim(implode(' ', array_filter([
            $this->first_name,
            $this->middle_name,
            $this->last_name,
        ]))));
    }
}
