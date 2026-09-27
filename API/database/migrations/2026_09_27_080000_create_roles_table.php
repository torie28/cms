<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('label');
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        $now = now();

        DB::table('roles')->insert(array_map(fn (array $role) => [
            ...$role,
            'created_at' => $now,
            'updated_at' => $now,
        ], [
            ['name' => 'admin', 'label' => 'Msimamizi', 'description' => 'Ana ruhusa zote za mfumo.', 'is_system' => true],
            ['name' => 'secretary', 'label' => 'Katibu', 'description' => null, 'is_system' => false],
            ['name' => 'treasurer', 'label' => 'Mweka hazina', 'description' => null, 'is_system' => false],
            ['name' => 'kanda_leader', 'label' => 'Kiongozi wa kanda', 'description' => null, 'is_system' => false],
            ['name' => 'jumuiya_leader', 'label' => 'Kiongozi wa jumuiya', 'description' => null, 'is_system' => false],
            ['name' => 'member', 'label' => 'Mwanachama', 'description' => null, 'is_system' => true],
        ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
