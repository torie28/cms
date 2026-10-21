<?php

namespace Tests\Feature;

use App\Models\Jumuiya;
use App\Models\Kanda;
use App\Models\Module;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, array $modules = [], string $password = 'secret-pass'): User
    {
        Modules::sync();

        $user = User::query()->create([
            'name' => ucfirst($role),
            'username' => $role.fake()->unique()->numberBetween(1, 9999),
            'role' => $role,
            'password' => $password,
        ]);

        foreach ($modules as $key) {
            $user->modules()->attach(Module::query()->where('key', $key)->value('id'));
        }

        return $user;
    }

    public function test_login_is_rate_limited_after_repeated_failures(): void
    {
        $user = $this->makeUser('member');

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/login', ['username' => $user->username, 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['username' => $user->username, 'password' => 'secret-pass'])->assertTooManyRequests();
    }

    public function test_users_without_the_module_cannot_read_people_or_settings(): void
    {
        $kanda = Kanda::query()->create(['name' => 'Kanda A']);
        $jumuiya = Jumuiya::query()->create(['name' => 'Mt. Yosefu', 'kanda_id' => $kanda->id]);

        Sanctum::actingAs($this->makeUser('member', ['sadaka']));

        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/roles')->assertForbidden();
        $this->getJson('/api/modules')->assertForbidden();
        $this->getJson("/api/jumuiyas/{$jumuiya->id}")->assertForbidden();
        $this->getJson("/api/jumuiyas/{$jumuiya->id}/members")->assertForbidden();
        $this->getJson("/api/kandas/{$kanda->id}")->assertForbidden();
        $this->getJson('/api/kandas')->assertForbidden();
        $this->getJson('/api/sms/balance')->assertForbidden();
        $this->postJson('/api/activity-logs', [
            'action' => 'exported',
            'subject' => '1 kandas',
            'subject_type' => 'kanda',
        ])->assertForbidden();

        // Offering forms need jumuiya names; zone lists stay behind the kanda/jumuiya modules.
        $this->getJson('/api/jumuiyas')->assertOk();
    }

    public function test_users_with_the_module_can_still_read_it(): void
    {
        $kanda = Kanda::query()->create(['name' => 'Kanda A']);
        $jumuiya = Jumuiya::query()->create(['name' => 'Mt. Yosefu', 'kanda_id' => $kanda->id]);

        Sanctum::actingAs($this->makeUser('member', ['users', 'kanda']));

        $this->getJson('/api/users')->assertOk();
        $this->getJson('/api/roles')->assertOk();
        $this->getJson('/api/modules')->assertOk();
        $this->getJson("/api/jumuiyas/{$jumuiya->id}")->assertOk();
        $this->getJson("/api/kandas/{$kanda->id}")->assertOk();
    }

    public function test_short_passwords_are_rejected(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/users', [
            'name' => 'Neema',
            'username' => 'neema',
            'password' => 'short',
            'role' => 'member',
        ])->assertJsonValidationErrors('password');
    }

    public function test_changing_a_password_signs_the_user_out_everywhere(): void
    {
        $target = $this->makeUser('member');
        $target->createToken('cms');
        $target->createToken('cms');

        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/users/{$target->id}", [
            'name' => $target->name,
            'username' => $target->username,
            'role' => 'member',
            'password' => 'brand-new-pass',
        ])->assertOk();

        $this->assertSame(0, $target->tokens()->count());
    }

    public function test_tokens_expire(): void
    {
        $user = $this->makeUser('member');
        $token = $user->createToken('cms')->plainTextToken;

        $this->withToken($token)->getJson('/api/user')->assertOk();

        $this->travel(config('sanctum.expiration') + 1)->minutes();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_api_responses_carry_security_headers(): void
    {
        Sanctum::actingAs($this->makeUser('member'));

        $this->getJson('/api/user')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    }

    public function test_import_export_logs_require_the_matching_module(): void
    {
        Sanctum::actingAs($this->makeUser('member', ['kanda']));

        $this->postJson('/api/activity-logs', [
            'action' => 'exported',
            'subject' => '3 kandas',
            'subject_type' => 'kanda',
        ])->assertCreated();

        $this->postJson('/api/activity-logs', [
            'action' => 'exported',
            'subject' => '2 offerings',
            'subject_type' => 'offering',
        ])->assertForbidden();
    }
}
