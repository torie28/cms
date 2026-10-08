<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['key', 'label', 'description', 'enabled', 'is_core', 'sort_order'])]
class Module extends Model
{
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_core' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot(['can_create', 'can_update', 'can_delete']);
    }
}
