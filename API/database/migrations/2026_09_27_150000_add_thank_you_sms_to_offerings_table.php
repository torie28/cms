<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offerings', function (Blueprint $table) {
            $table->string('contributor_phone', 20)->nullable()->after('contributor');
            $table->foreignId('thank_you_message_id')->nullable()->after('contributor_phone')
                ->constrained('messages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('offerings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('thank_you_message_id');
            $table->dropColumn('contributor_phone');
        });
    }
};
