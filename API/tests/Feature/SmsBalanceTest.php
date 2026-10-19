<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsBalanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_read_the_sms_balance(): void
    {
        $this->getJson('/api/sms/balance')->assertUnauthorized();
    }

    public function test_a_member_sees_the_nextsms_balance(): void
    {
        $this->actingAsMember();
        config([
            'services.sms.driver' => 'nextsms',
            'services.sms.sender_id' => 'STMATHIAS',
            'services.sms.nextsms.username' => 'user',
            'services.sms.nextsms.password' => 'secret',
            'services.sms.nextsms.environment' => 'live',
        ]);

        Http::fake([
            'messaging-service.co.tz/api/sms/v1/balance' => Http::response([
                'sms_balance' => 42,
                'display' => '16 TZS',
            ]),
        ]);

        $this->getJson('/api/sms/balance')
            ->assertOk()
            ->assertJson([
                'driver' => 'nextsms',
                'provider' => 'NextSMS',
                'sender_id' => 'STMATHIAS',
                'test_mode' => false,
                'available' => 42,
                'rate' => '16 TZS',
                'error' => null,
            ]);
    }

    public function test_beem_and_sewmr_balances_are_read_for_the_active_provider(): void
    {
        $this->actingAsMember();

        config([
            'services.sms.driver' => 'beem',
            'services.sms.sender_id' => 'STMATHIAS',
            'services.sms.beem.api_key' => 'key',
            'services.sms.beem.secret_key' => 'secret',
        ]);
        Http::fake([
            'apisms.beem.africa/public/v1/vendors/balance' => Http::response([
                'data' => ['credit_balance' => '100'],
            ]),
        ]);
        $this->getJson('/api/sms/balance')->assertOk()->assertJsonPath('available', 100)->assertJsonPath('provider', 'Beem Africa');

        config([
            'services.sms.driver' => 'sewmrsms',
            'services.sms.sewmrsms.api_token' => 'token',
        ]);
        Http::fake([
            'api.sewmrsms.co.tz/api/v1/sms/remaining-sms' => Http::response([
                'data' => ['remaining_sms' => 7],
            ]),
        ]);
        $this->getJson('/api/sms/balance')->assertOk()->assertJsonPath('available', 7)->assertJsonPath('provider', 'SEWMR SMS');
    }

    public function test_log_mode_has_no_balance_to_show(): void
    {
        $this->actingAsMember();
        config(['services.sms.driver' => 'log']);

        $this->getJson('/api/sms/balance')
            ->assertOk()
            ->assertJsonPath('available', null)
            ->assertJsonPath('error', 'Salio halipatikani katika hali ya majaribio.');
    }

    private function actingAsMember(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'member']));
    }
}
