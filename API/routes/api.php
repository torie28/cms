<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\ApiSettingController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\JumuiyaController;
use App\Http\Controllers\JumuiyaMemberController;
use App\Http\Controllers\KandaController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ModuleController;
use App\Http\Controllers\OfferingController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Support\Recycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// Vercel Cron stands in for `schedule:run`; it authenticates with the CRON_SECRET bearer token.
Route::get('/cron/purge-expired', function (Request $request) {
    $secret = config('services.cron.secret');
    abort_unless($secret && hash_equals("Bearer {$secret}", (string) $request->header('Authorization')), 401);

    return response()->json(['purged' => Recycle::purgeExpired()]);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user/preferences', [AuthController::class, 'preferences']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);

    Route::get('/modules', [ModuleController::class, 'index']);
    Route::put('/modules/{module}', [ModuleController::class, 'update']);

    Route::get('/api-settings', [ApiSettingController::class, 'index']);
    Route::put('/api-settings/{service}', [ApiSettingController::class, 'update']);
    Route::post('/api-settings/{service}/test', [ApiSettingController::class, 'test']);

    Route::get('/kandas', [KandaController::class, 'index']);
    Route::post('/kandas', [KandaController::class, 'store']);
    Route::post('/kandas/import', [KandaController::class, 'import']);

    Route::get('/jumuiyas', [JumuiyaController::class, 'index']);
    Route::post('/jumuiyas', [JumuiyaController::class, 'store']);
    Route::get('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'show']);
    Route::put('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'update']);
    Route::delete('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'destroy']);
    Route::get('/jumuiyas/{jumuiya}/members', [JumuiyaMemberController::class, 'index']);
    Route::post('/jumuiyas/{jumuiya}/members', [JumuiyaMemberController::class, 'store']);
    Route::put('/jumuiyas/{jumuiya}/members/{member}', [JumuiyaMemberController::class, 'update']);
    Route::delete('/jumuiyas/{jumuiya}/members/{member}', [JumuiyaMemberController::class, 'destroy']);

    Route::get('/offerings', [OfferingController::class, 'index']);
    Route::post('/offerings', [OfferingController::class, 'store']);
    Route::put('/offerings/{offering}', [OfferingController::class, 'update']);
    Route::delete('/offerings/{offering}', [OfferingController::class, 'destroy']);

    Route::get('/messages/contacts', [MessageController::class, 'contacts']);
    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);
    Route::get('/messages/{message}', [MessageController::class, 'show'])->whereNumber('message');
    Route::post('/messages/{message}/retry', [MessageController::class, 'retry'])->whereNumber('message');

    Route::get('/inbox', [MessageController::class, 'inbox']);
    Route::post('/inbox/read-all', [MessageController::class, 'markAllRead']);
    Route::post('/inbox/{recipient}/read', [MessageController::class, 'markRead'])->whereNumber('recipient');

    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::post('/activity-logs', [ActivityLogController::class, 'store']);
    Route::post('/activity-logs/{log}/restore', [ActivityLogController::class, 'restore']);
    Route::delete('/activity-logs/{log}/purge', [ActivityLogController::class, 'purge']);
});
