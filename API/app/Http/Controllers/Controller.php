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

    /** Non-admins with delete privilege must send a deletion request instead. */
    protected function ensureImmediateDeleteAllowed(Request $request): void
    {
        abort_unless(
            $request->user()?->role === Roles::ADMIN,
            403,
            'Kufuta kunahitaji idhini ya msimamizi. Tuma ombi la kufuta.',
        );
    }

    protected function ensureAnyModule(Request $request, string ...$keys): void
    {
        foreach ($keys as $key) {
            if (Modules::canAccess($request->user(), $key)) {
                return;
            }
        }

        abort(403, 'Huna ruhusa ya kufungua moduli hii.');
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
