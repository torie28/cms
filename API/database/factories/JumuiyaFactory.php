<?php

namespace Database\Factories;

use App\Models\Jumuiya;
use App\Models\Kanda;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Jumuiya>
 */
class JumuiyaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Jumuiya '.fake()->unique()->word(),
            'kanda_id' => Kanda::factory(),
            'chairperson' => fake()->name(),
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
