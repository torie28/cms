<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('module_user', function (Blueprint $table) {
            $table->boolean('can_create')->default(false);
            $table->boolean('can_update')->default(false);
            $table->boolean('can_delete')->default(false);
        });

        // These modules already let anyone with access create, edit and delete.
        // Users, settings and activity logs stayed admin-only, so those stay off.
        $open = DB::table('modules')
            ->whereIn('key', ['sadaka', 'jumuiya', 'kanda', 'notifications'])
            ->pluck('id');

        if ($open->isNotEmpty()) {
            DB::table('module_user')
                ->whereIn('module_id', $open)
                ->update([
                    'can_create' => true,
                    'can_update' => true,
                    'can_delete' => true,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('module_user', function (Blueprint $table) {
            $table->dropColumn(['can_create', 'can_update', 'can_delete']);
        });
    }
};
