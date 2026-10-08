<?php

namespace App\Http\Controllers;

use App\Support\Modules;
use App\Support\Roles;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === Roles::ADMIN, 403, 'Ni msimamizi pekee anayeweza kufanya hivi.');
    }

    protected function ensureCan(Request $request, string $module, string $action): void
    {
        abort_unless(
            Modules::can($request->user(), $module, $action),
            403,
            'Huna ruhusa ya kufanya hivi katika moduli hii.',
        );
    }
}
