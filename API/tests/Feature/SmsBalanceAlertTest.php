<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\Module;
use App\Models\SystemNotice;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsBalanceAlertTest extends TestCase
{
    use RefreshDatabase;

    /** Latest balance the NextSMS stub should return. One stub is registered and reads this live. */
    private int $credits = 0;

    private bool $balanceStubbed = false;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_a_low_nextsms_balance_appears_in_the_notification_panel(): void
    {
        $admin = $this->admin();
        $outsider = User::factory()->create(['role' => 'member']);
        $this->fakeBalance(8);

        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 20])
            ->assertOk()
            ->assertJsonPath('provider', 'NextSMS')
            ->assertJsonPath('available', 8)
            ->assertJsonPath('alert.enabled', true)
            ->assertJsonPath('alert.threshold', 20)
            ->assertJsonPath('alert.low', true);

        $inbox = $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 1);
        $inbox->assertJsonPath('items.0.kind', 'sms_balance');
        $inbox->assertJsonPath('items.0.sender', 'NextSMS');
        $inbox->assertJsonPath('items.0.alert.available', 8);
        $inbox->assertJsonPath('items.0.alert.threshold', 20);
        $inbox->assertJsonPath('items.0.alert.empty', false);
        $this->assertSame(1, SystemNotice::query()->count());

        Sanctum::actingAs($outsider);
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 0)->assertJsonPath('items', []);

        Sanctum::actingAs($admin);
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 1);
        $this->assertSame(1, SystemNotice::query()->count());
    }

    public function test_the_reminder_repeats_the_next_day_and_after_the_balance_recovers(): void
    {
        $this->admin();
        Carbon::setTestNow('2026-10-19 09:00:00');
        $this->fakeBalance(4);
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 10])->assertOk();
        $this->assertSame(1, SystemNotice::query()->count());

        Carbon::setTestNow('2026-10-20 09:00:00');
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 2);
        $this->assertSame(2, SystemNotice::query()->count());

        $this->fakeBalance(40);
        $this->getJson('/api/sms/balance')->assertOk()->assertJsonPath('alert.low', false);

        $this->fakeBalance(2);
        $this->getJson('/api/sms/balance')->assertOk()->assertJsonPath('alert.low', true);
        $this->assertSame(3, SystemNotice::query()->count());
    }

    public function test_an_empty_balance_is_marked_as_finished(): void
    {
        $this->admin();
        $this->fakeBalance(0);

        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 0])
            ->assertOk()
            ->assertJsonPath('alert.low', true);

        $this->getJson('/api/inbox')
            ->assertOk()
            ->assertJsonPath('items.0.alert.empty', true)
            ->assertJsonPath('items.0.title', 'Salio la SMS limeisha');
    }

    public function test_a_balance_above_the_limit_does_not_notify(): void
    {
        $this->admin();
        $this->fakeBalance(50);

        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 10])
            ->assertOk()
            ->assertJsonPath('alert.low', false);

        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 0);
        $this->assertSame(0, SystemNotice::query()->count());
    }

    public function test_a_disabled_alert_and_test_mode_stay_quiet(): void
    {
        $this->admin();
        $this->fakeBalance(1);

        $this->putJson('/api/sms/alert', ['enabled' => false, 'threshold' => 100])
            ->assertOk()
            ->assertJsonPath('alert.enabled', false)
            ->assertJsonPath('alert.low', false);

        $this->assertSame(0, SystemNotice::query()->count());

        config(['services.sms.driver' => 'log']);
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 5])
            ->assertOk()
            ->assertJsonPath('available', null)
            ->assertJsonPath('alert.low', false);

        $this->assertSame(0, SystemNotice::query()->count());
    }

    public function test_reading_clears_the_balance_reminder_and_ordinary_messages_together(): void
    {
        $admin = $this->admin();
        $this->fakeBalance(3);
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 5])->assertOk();

        $message = Message::query()->create([
            'user_id' => $admin->id,
            'sender' => 'Parokia',
            'channel' => 'app',
            'audience' => 'users',
            'audience_label' => 'Watumiaji wa mfumo',
            'title' => 'Mkutano',
            'body' => 'Habari {jina}',
            'status' => 'sent',
        ]);
        MessageRecipient::query()->create([
            'message_id' => $message->id,
            'channel' => 'app',
            'recipient_type' => 'user',
            'recipient_id' => $admin->id,
            'name' => $admin->name,
            'status' => 'sent',
        ]);

        $inbox = $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 2);
        $notice = collect($inbox->json('items'))->firstWhere('kind', 'sms_balance');
        $messageItem = collect($inbox->json('items'))->firstWhere('kind', 'message');
        $this->assertNotNull($notice);
        $this->assertSame('Habari '.$admin->name, $messageItem['body']);

        $this->postJson('/api/inbox/read', ['id' => $notice['id']])->assertOk();
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 1);

        $this->postJson('/api/inbox/read', ['id' => 'notice:999999'])->assertNotFound();
        $this->postJson('/api/inbox/read-all')->assertOk();
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 0);
    }

    public function test_only_someone_who_can_open_notifications_may_set_the_limit(): void
    {
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 5])->assertUnauthorized();

        $member = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($member);
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 5])->assertForbidden();

        Modules::sync();
        $member->modules()->attach(Module::query()->where('key', 'notifications')->value('id'), [
            'can_create' => false,
            'can_update' => false,
            'can_delete' => false,
        ]);

        $this->fakeBalance(12);
        $this->putJson('/api/sms/alert', ['enabled' => true, 'threshold' => 15])->assertOk();
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('unread', 1);

        $this->putJson('/api/sms/alert', ['enabled' => true])->assertJsonValidationErrors('threshold');
    }

    private function admin(): User
    {
        $user = User::factory()->create(['role' => 'admin', 'name' => 'Askofu']);
        Sanctum::actingAs($user);

        return $user;
    }

    private function fakeBalance(int $available): void
    {
        $this->credits = $available;
        config([
            'services.sms.driver' => 'nextsms',
            'services.sms.sender_id' => 'STMATHIAS',
            'services.sms.nextsms.username' => 'user',
            'services.sms.nextsms.password' => 'secret',
            'services.sms.nextsms.environment' => 'live',
        ]);

        if ($this->balanceStubbed) {
            return;
        }

        $this->balanceStubbed = true;
        Http::fake([
            'messaging-service.co.tz/api/sms/v1/balance' => function () {
                return Http::response([
                    'sms_balance' => $this->credits,
                    'display' => '16 TZS',
                ]);
            },
        ]);
    }
}
