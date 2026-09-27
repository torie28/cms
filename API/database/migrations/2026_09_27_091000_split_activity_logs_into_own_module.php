<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('modules')->where('key', 'settings')->update([
            'label' => 'Mipangilio ya mfumo',
            'description' => 'Mipangilio ya mfumo na moduli zake.',
        ]);

        if (DB::table('modules')->where('key', 'activity_logs')->doesntExist()) {
            DB::table('modules')->insert([
                'key' => 'activity_logs',
                'label' => 'Kumbukumbu za shughuli',
                'description' => 'Nyeti: inaonyesha nani alifanya nini na lini. Mpe tu anayehitaji.',
                'enabled' => true,
                'is_core' => true,
                'sort_order' => (int) DB::table('modules')->max('sort_order') + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('modules')->where('key', 'activity_logs')->delete();
        DB::table('modules')->where('key', 'settings')->update([
            'label' => 'Mipangilio',
            'description' => 'Mipangilio ya mfumo na kumbukumbu za shughuli.',
        ]);
    }
};
