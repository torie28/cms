<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A person now has three name parts and may hold a titled post in their
        // community and/or their zone. Leaders are these people, so the old single
        // leader/chairperson text fields on the zone and community are retired.
        DB::statement('DROP INDEX IF EXISTS jumuiyas_chairperson_unique');

        Schema::table('jumuiya_members', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('jumuiya_id');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('last_name')->nullable()->after('middle_name');
            $table->string('community_role')->nullable()->after('gender');
            $table->string('zone_role')->nullable()->after('community_role');
        });

        // Keep any existing name as the last name so nothing is lost, then drop it.
        DB::table('jumuiya_members')->whereNotNull('name')->update([
            'last_name' => DB::raw('name'),
        ]);

        Schema::table('jumuiya_members', function (Blueprint $table) {
            $table->dropColumn('name');
        });

        Schema::table('jumuiyas', function (Blueprint $table) {
            $table->dropColumn('chairperson');
        });

        Schema::table('kandas', function (Blueprint $table) {
            $table->dropColumn('leader');
        });
    }

    public function down(): void
    {
        Schema::table('kandas', function (Blueprint $table) {
            $table->string('leader')->nullable();
        });

        Schema::table('jumuiyas', function (Blueprint $table) {
            $table->string('chairperson')->nullable();
        });

        Schema::table('jumuiya_members', function (Blueprint $table) {
            $table->string('name')->nullable()->after('jumuiya_id');
        });

        DB::table('jumuiya_members')->whereNotNull('last_name')->update([
            'name' => DB::raw("trim(coalesce(first_name,'')||' '||coalesce(middle_name,'')||' '||coalesce(last_name,''))"),
        ]);

        Schema::table('jumuiya_members', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'middle_name', 'last_name', 'community_role', 'zone_role']);
        });
    }
};
