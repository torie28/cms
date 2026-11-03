<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/', static function (): JsonResponse {
    return response()->json([
        'app' => config('app.name'),
        'status' => 'ok',
    ]);
});

Route::get('/health', static function (): JsonResponse {
    return response()->json(['status' => 'ok']);
});
