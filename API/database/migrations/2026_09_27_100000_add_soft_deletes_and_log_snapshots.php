<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOFT_DELETABLE = ['users', 'roles', 'jumuiyas', 'jumuiya_members'];

    public function up(): void
    {
        foreach (self::SOFT_DELETABLE as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->softDeletes());
        }

        // A deleted user keeps their username/email so they can be restored, but
        // must not block creating a new account with the same details.
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropUnique(['email']);
        });
        DB::statement('CREATE UNIQUE INDEX users_username_active_unique ON users (username) WHERE deleted_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX users_email_active_unique ON users (email) WHERE deleted_at IS NULL');

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('subject_id')->nullable()->after('subject_type');
            $table->json('details')->nullable()->after('subject_id');
            $table->timestamp('restored_at')->nullable();
            $table->string('restored_by')->nullable();
            $table->timestamp('purged_at')->nullable();
            $table->string('purged_by')->nullable();
            $table->index(['subject_type', 'subject_id']);
        });

        DB::statement('DROP VIEW IF EXISTS user_access');
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
            WHERE u.deleted_at IS NULL
            GROUP BY u.id, r.label
        SQL);
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['subject_type', 'subject_id']);
            $table->dropColumn(['subject_id', 'details', 'restored_at', 'restored_by', 'purged_at', 'purged_by']);
        });

        DB::statement('DROP INDEX IF EXISTS users_username_active_unique');
        DB::statement('DROP INDEX IF EXISTS users_email_active_unique');
        DB::table('users')->whereNotNull('deleted_at')->delete();

        Schema::table('users', function (Blueprint $table) {
            $table->unique('username');
            $table->unique('email');
        });

        foreach (self::SOFT_DELETABLE as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropSoftDeletes());
        }
    }
};
