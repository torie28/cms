<?php

namespace App\Http\Controllers;

use App\Support\Roles;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === Roles::ADMIN, 403, 'Ni msimamizi pekee anayeweza kufanya hivi.');
    }
}
