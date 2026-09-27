<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offerings', function (Blueprint $table) {
            $table->id();
            $table->string('category', 30);
            $table->decimal('amount', 14, 2);
            $table->date('received_on');
            $table->string('payment_method', 20)->default('cash');
            $table->foreignId('jumuiya_id')->nullable()->constrained()->nullOnDelete();
            $table->string('contributor')->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('recorded_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['received_on', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offerings');
    }
};
