<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['key', 'value', 'updated_by'])]
class ApiSetting extends Model
{
    protected function casts(): array
    {
        return [
            // Every value is encrypted with APP_KEY, not just the secret ones.
            'value' => 'encrypted',
        ];
    }
}
