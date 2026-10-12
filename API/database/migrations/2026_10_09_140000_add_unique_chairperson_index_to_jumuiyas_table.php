<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE UNIQUE INDEX jumuiyas_chairperson_unique ON jumuiyas (lower(trim(chairperson))) WHERE deleted_at IS NULL AND trim(coalesce(chairperson, '')) <> ''");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS jumuiyas_chairperson_unique');
    }
};
