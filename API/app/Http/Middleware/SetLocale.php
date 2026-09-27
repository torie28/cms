<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Uses the UI language sent by the Angular app (Accept-Language: sw|en) for
 * framework messages such as validation errors.
 */
class SetLocale
{
    public const SUPPORTED = ['sw', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->getPreferredLanguage(self::SUPPORTED);

        if ($locale !== null && $request->headers->has('Accept-Language')) {
            app()->setLocale($locale);
        }

        return $next($request);
    }
}
