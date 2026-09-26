<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityLogger
{
    public function record(
        ?User $user,
        string $action,
        string $subject,
        ?string $subjectType = null,
        ?Request $request = null,
    ): ActivityLog {
        return ActivityLog::query()->create([
            'user_id' => $user?->id,
            'actor' => $user?->name ?? 'System',
            'action' => $action,
            'subject' => $subject,
            'subject_type' => $subjectType,
            'ip_address' => $request?->ip(),
        ]);
    }
}
