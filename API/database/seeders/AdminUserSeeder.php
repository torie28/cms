<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the default administrator account. Outside local development the
     * password must come from ADMIN_PASSWORD (at least 12 characters).
     */
    public function run(): void
    {
        $password = config('app.admin_password');

        if (! app()->isLocal() && ! app()->runningUnitTests() && mb_strlen((string) $password) < 12) {
            throw new RuntimeException('Set ADMIN_PASSWORD (at least 12 characters) in .env before seeding outside local development.');
        }

        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Administrator',
                'email' => 'admin@gracechapel.org',
                'role' => 'admin',
                'password' => Hash::make($password ?: 'admin'),
                'email_verified_at' => now(),
            ],
        );
    }
}
