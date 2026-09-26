<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jumuiyas', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('kanda_id')->constrained('kandas')->cascadeOnDelete();
            $table->string('chairperson')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jumuiyas');
    }
};
