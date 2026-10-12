<?php

namespace Tests\Feature;

use App\Models\Module;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserModulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_grant_matukio_to_new_and_existing_users_even_while_it_is_switched_off(): void
    {
        Modules::sync();
        Module::query()->where('key', 'matukio')->update(['enabled' => false]);

        $admin = User::query()->create(['name' => 'Admin', 'username' => 'admin', 'role' => 'admin', 'password' => 'secret']);
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/users', [
            'name' => 'Neema Juma',
            'username' => 'neema',
            'password' => 'secret',
            'role' => 'member',
            'modules' => ['matukio'],
        ])->assertCreated();

        $neema = User::query()->findOrFail($created->json('id'));
        $this->assertTrue($neema->modules()->where('key', 'matukio')->exists());
        $this->assertNotContains('matukio', Modules::accessibleBy($neema));

        $existing = User::query()->create(['name' => 'Torie', 'username' => 'torie', 'role' => 'member', 'password' => 'secret']);

        $this->putJson("/api/users/{$existing->id}", [
            'name' => 'Torie',
            'username' => 'torie',
            'role' => 'member',
            'modules' => ['matukio'],
        ])->assertOk();

        Module::query()->where('key', 'matukio')->update(['enabled' => true]);

        $this->assertContains('matukio', Modules::accessibleBy($existing->fresh()));
        $this->assertContains('matukio', Modules::accessibleBy($neema->fresh()));
    }
}
