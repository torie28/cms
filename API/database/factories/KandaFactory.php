<?php

namespace Database\Factories;

use App\Models\Kanda;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Kanda>
 */
class KandaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->city(),
            'leader' => fake()->name(),
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
