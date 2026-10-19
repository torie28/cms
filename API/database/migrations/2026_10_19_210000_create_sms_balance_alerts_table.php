<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_balance_alerts', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->unsignedInteger('threshold')->nullable();
            // True while the balance is still at or under the threshold.
            $table->boolean('active')->default(false);
            // Bumps each time a fresh reminder is posted, so the same dip is not repeated.
            $table->unsignedInteger('episode')->default(0);
            $table->date('last_notified_on')->nullable();
            $table->string('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('system_notices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 40);
            $table->string('dedupe_key', 80);
            $table->string('sender');
            $table->string('title');
            $table->text('body');
            $table->json('meta')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'dedupe_key']);
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_notices');
        Schema::dropIfExists('sms_balance_alerts');
    }
};
