<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $known = DB::table('roles')->pluck('name')->all();
        DB::table('users')->whereNotIn('role', $known)->update(['role' => 'member']);

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('role')->references('name')->on('roles')->cascadeOnUpdate()->restrictOnDelete();
        });

        // Read-only summary for browsing the database (e.g. in Adminer); the app never writes to it.
        DB::statement(<<<'SQL'
            CREATE VIEW user_access AS
            SELECT
                u.id AS user_id,
                u.name,
                u.username,
                u.phone,
                u.gender,
                u.role,
                r.label AS role_label,
                CASE
                    WHEN u.role = 'admin' THEN 'ALL'
                    ELSE COALESCE(string_agg(m.label, ', ' ORDER BY m.sort_order), '')
                END AS modules,
                u.created_at
            FROM users u
            LEFT JOIN roles r ON r.name = u.role
            LEFT JOIN module_user mu ON mu.user_id = u.id
            LEFT JOIN modules m ON m.id = mu.module_id
            GROUP BY u.id, r.label
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS user_access');

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role']);
        });
    }
};
