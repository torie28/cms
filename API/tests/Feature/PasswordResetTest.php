<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $attributes = []): User
    {
        return User::query()->create([
            'name' => 'Maria',
            'username' => 'maria',
            'email' => 'maria@example.com',
            'role' => 'member',
            'password' => 'old-password',
            ...$attributes,
        ]);
    }

    public function test_a_reset_link_pointing_at_the_frontend_is_emailed(): void
    {
        Notification::fake();
        config(['app.frontend_url' => 'http://cms.test']);
        $user = $this->makeUser();

        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;

            return str_starts_with($url, 'http://cms.test/reset-password?token=')
                && str_contains($url, 'email=maria%40example.com');
        });
    }

    public function test_unknown_emails_get_the_same_answer(): void
    {
        Notification::fake();
        $this->makeUser();

        $known = $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk()->json();
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->json();

        $this->assertSame($known, $unknown);
        Notification::assertSentTimes(ResetPasswordNotification::class, 1);
    }

    public function test_the_password_can_be_reset_with_a_valid_token(): void
    {
        $user = $this->makeUser();
        $user->createToken('cms');
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'maria@example.com',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-password', $user->password));
        $this->assertSame(0, $user->tokens()->count());

        $this->postJson('/api/login', ['username' => 'maria', 'password' => 'new-password'])->assertOk();
    }

    public function test_a_token_only_works_once(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);
        $payload = [
            'token' => $token,
            'email' => 'maria@example.com',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ];

        $this->postJson('/api/reset-password', $payload)->assertOk();
        $this->postJson('/api/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_an_invalid_token_is_rejected(): void
    {
        $user = $this->makeUser();

        $this->postJson('/api/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'maria@example.com',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertTrue(Hash::check('old-password', $user->fresh()->password));
    }

    public function test_the_new_password_must_be_confirmed_and_long_enough(): void
    {
        $user = $this->makeUser();
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'maria@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_reset_requests_are_rate_limited(): void
    {
        Notification::fake();

        foreach (range(1, 3) as $attempt) {
            $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk();
        }

        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertTooManyRequests();
    }
}
