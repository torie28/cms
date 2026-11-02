<?php

namespace Tests\Feature;

use App\Models\Jumuiya;
use App\Models\MessageTemplate;
use App\Models\Offering;
use App\Models\User;
use App\Support\Sms\SmsGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MessageTemplateTest extends TestCase
{
    use RefreshDatabase;

    public function test_system_thank_you_templates_are_seeded_for_offering_topics(): void
    {
        $this->signIn();

        $this->getJson('/api/message-templates?kind=thank_you')
            ->assertOk()
            ->assertJsonCount(6)
            ->assertJsonFragment(['topic' => 'zaka', 'kind' => 'thank_you', 'is_default' => true]);
    }

    public function test_a_user_can_create_and_use_a_compose_template(): void
    {
        $this->signIn();

        $created = $this->postJson('/api/message-templates', [
            'topic' => 'zaka',
            'kind' => 'compose',
            'name' => 'Shukrani fupi',
            'body' => 'Asante {jina} kwa zaka yako.',
            'is_default' => true,
        ])->assertCreated()
            ->json();

        $this->assertFalse($created['is_system']);
        $this->assertTrue($created['is_default']);
        $this->assertDatabaseHas('message_templates', [
            'id' => $created['id'],
            'name' => 'Shukrani fupi',
            'is_default' => true,
        ]);

        // Creating a new default clears the previous default for the same topic+kind.
        $this->assertDatabaseMissing('message_templates', [
            'topic' => 'zaka',
            'kind' => 'compose',
            'is_system' => true,
            'is_default' => true,
        ]);
    }

    public function test_system_templates_can_be_edited_but_not_deleted(): void
    {
        $this->signIn();
        $system = MessageTemplate::query()
            ->where('topic', 'zaka')
            ->where('kind', 'thank_you')
            ->where('is_system', true)
            ->firstOrFail();

        $this->putJson('/api/message-templates/'.$system->id, [
            'topic' => 'zaka',
            'kind' => 'thank_you',
            'name' => $system->name,
            'body' => 'Asante {jina}. Zaka {kiasi} ya {tarehe} imepokelewa.',
            'is_default' => true,
        ])->assertOk()
            ->assertJsonPath('body', 'Asante {jina}. Zaka {kiasi} ya {tarehe} imepokelewa.');

        $this->deleteJson('/api/message-templates/'.$system->id)
            ->assertStatus(422);
    }

    public function test_recording_zaka_uses_the_default_thank_you_template(): void
    {
        $user = $this->signIn();
        $gateway = $this->captureSms();

        MessageTemplate::query()
            ->where('topic', 'zaka')
            ->where('kind', 'thank_you')
            ->update([
                'body' => 'Asante {jina}. Zaka yako ya TSh {kiasi} ya tarehe {tarehe} imepokelewa.',
                'is_default' => true,
            ]);

        $this->postJson('/api/offerings', [
            'category' => 'zaka',
            'amount' => 25000,
            'received_on' => '2026-10-20',
            'payment_method' => 'cash',
            'contributor' => 'Amina Mushi',
            'contributor_phone' => '0712000001',
            'send_thank_you' => true,
        ])->assertCreated();

        $this->assertSame(
            ['255712000001' => 'Asante Amina Mushi. Zaka yako ya TSh 25,000 ya tarehe 20/10/2026 imepokelewa.'],
            $gateway->sent,
        );
        $this->assertDatabaseHas('offerings', [
            'contributor' => 'Amina Mushi',
            'category' => 'zaka',
        ]);
        $this->assertNotNull(Offering::query()->where('contributor', 'Amina Mushi')->value('thank_you_message_id'));
        $this->assertSame($user->id, Offering::query()->where('contributor', 'Amina Mushi')->value('user_id'));
    }

    public function test_sadaka_with_a_phone_also_gets_a_thank_you_sms(): void
    {
        $this->signIn();
        $gateway = $this->captureSms();
        $jumuiya = Jumuiya::factory()->create();

        $this->postJson('/api/offerings', [
            'category' => 'sadaka',
            'amount' => 5000,
            'received_on' => '2026-10-21',
            'payment_method' => 'cash',
            'jumuiya_id' => $jumuiya->id,
            'contributor' => 'Neema Paulo',
            'contributor_phone' => '0712000002',
            'send_thank_you' => true,
        ])->assertCreated();

        $this->assertCount(1, $gateway->sent);
        $this->assertStringContainsString('Neema Paulo', array_values($gateway->sent)[0]);
        $this->assertStringContainsString('5,000', array_values($gateway->sent)[0]);
    }

    private function captureSms(): SmsGateway
    {
        $gateway = new class extends SmsGateway
        {
            /** @var array<string, string> */
            public array $sent = [];

            public function send(array $messages): array
            {
                foreach ($messages as $phone => $text) {
                    $this->sent[(string) $phone] = $text;
                }

                return array_fill_keys(array_keys($this->sent), null);
            }
        };

        $this->app->instance(SmsGateway::class, $gateway);

        return $gateway;
    }

    private function signIn(): User
    {
        config(['services.sms.driver' => 'log']);
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        return $user;
    }
}
