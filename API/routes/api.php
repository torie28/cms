<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\JumuiyaController;
use App\Http\Controllers\JumuiyaMemberController;
use App\Http\Controllers\KandaController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);

    Route::get('/kandas', [KandaController::class, 'index']);
    Route::post('/kandas', [KandaController::class, 'store']);

    Route::get('/jumuiyas', [JumuiyaController::class, 'index']);
    Route::post('/jumuiyas', [JumuiyaController::class, 'store']);
    Route::get('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'show']);
    Route::put('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'update']);
    Route::delete('/jumuiyas/{jumuiya}', [JumuiyaController::class, 'destroy']);
    Route::get('/jumuiyas/{jumuiya}/members', [JumuiyaMemberController::class, 'index']);
    Route::post('/jumuiyas/{jumuiya}/members', [JumuiyaMemberController::class, 'store']);
    Route::put('/jumuiyas/{jumuiya}/members/{member}', [JumuiyaMemberController::class, 'update']);
    Route::delete('/jumuiyas/{jumuiya}/members/{member}', [JumuiyaMemberController::class, 'destroy']);

    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
});
