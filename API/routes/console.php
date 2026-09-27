<?php

use App\Support\Recycle;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('recycle:purge-expired', function () {
    $count = Recycle::purgeExpired();
    $this->info("Permanently removed {$count} record(s) deleted more than ".Recycle::RETENTION_DAYS.' days ago.');
})->purpose('Permanently delete records whose 30-day restore window has passed');

Schedule::command('recycle:purge-expired')->daily();
