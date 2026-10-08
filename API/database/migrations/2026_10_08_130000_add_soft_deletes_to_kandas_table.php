<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kandas', function (Blueprint $table) {
            $table->softDeletes();
            $table->dropUnique(['name']);
        });

        // A deleted kanda keeps its name so it can be restored, without blocking a new kanda of that name.
        DB::statement('CREATE UNIQUE INDEX kandas_name_active_unique ON kandas (name) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS kandas_name_active_unique');
        DB::table('kandas')->whereNotNull('deleted_at')->delete();

        Schema::table('kandas', function (Blueprint $table) {
            $table->unique('name');
            $table->dropSoftDeletes();
        });
    }
};
