<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    public function index(): JsonResponse
    {
        $logs = ActivityLog::query()
            ->latest()
            ->limit(200)
            ->get(['id', 'actor', 'action', 'subject', 'subject_type', 'ip_address', 'created_at']);

        return response()->json($logs);
    }
}
