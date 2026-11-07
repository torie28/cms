<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // The app owns the database and talks to it directly through Laravel, so the
    // Supabase data API (anon / authenticated roles) must not reach these tables.
    // Enable RLS with no policies and strip those roles' grants: the postgres
    // owner the app connects as bypasses RLS, so nothing in the app changes.
    public function up(): void
    {
        // Postgres (Supabase) only; SQLite used locally and in tests has no RLS.
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            DO $$
            DECLARE t text;
            BEGIN
                FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                LOOP
                    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
                    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
                END LOOP;
            END $$;
        SQL);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            DO $$
            DECLARE t text;
            BEGIN
                FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                LOOP
                    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
                    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
                END LOOP;
            END $$;
        SQL);
    }
};
