<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sender');
            $table->string('channel', 10);
            $table->string('audience', 20);
            $table->json('audience_ids')->nullable();
            $table->string('audience_label');
            $table->string('title')->nullable();
            $table->text('body');
            $table->string('status', 20)->default('sent');
            $table->unsignedInteger('sms_count')->default(0);
            $table->unsignedInteger('sms_sent')->default(0);
            $table->unsignedInteger('sms_failed')->default(0);
            $table->unsignedInteger('sms_segments')->default(0);
            $table->unsignedInteger('app_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->timestamps();
        });

        Schema::create('message_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 10);
            $table->string('recipient_type', 20);
            $table->unsignedBigInteger('recipient_id')->nullable();
            $table->string('name')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('group_name')->nullable();
            $table->string('status', 20);
            $table->text('error')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['channel', 'recipient_type', 'recipient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_recipients');
        Schema::dropIfExists('messages');
    }
};
