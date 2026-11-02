<?php

namespace Tests\Feature;

use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Kanda;
use App\Models\User;
use App\Support\Sms\SmsGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PersonalizedMessageTest extends TestCase
{
    use RefreshDatabase;

    private const BODY = 'Tumsifu Yesu Kristu {jina}. Kutakuwa na mkutano wa jumuiya siku ya ___ saa ___. Karibu sana.';

    public function test_a_person_chosen_inside_a_jumuiya_is_addressed_by_their_registered_name(): void
    {
        $this->signIn();
        $parish = $this->parish();
        $amina = $this->member($parish['maria'], 'Amina Mushi', '0712000001');
        $this->member($parish['maria'], 'Neema Paulo', '0712000002');
        $outsider = $this->member($parish['yosefu'], 'Baraka Joseph', '0712000003');

        $gateway = $this->captureSms();

        $this->postJson('/api/messages', [
            'channel' => 'sms',
            'audience' => 'jumuiya',
            'jumuiya_ids' => [$parish['maria']->id],
            'member_ids' => [$amina->id, $outsider->id],
            'topic' => 'mkutano',
            'body' => self::BODY,
        ])->assertCreated()
            ->assertJsonPath('audience_label', 'Jumuiya: Jumuiya ya Maria · watu 1')
            ->assertJsonPath('sms_sent', 1);

        $this->assertDatabaseHas('message_recipients', ['name' => 'Amina Mushi', 'phone' => '255712000001']);
        $this->assertDatabaseMissing('message_recipients', ['name' => 'Neema Paulo']);
        $this->assertDatabaseMissing('message_recipients', ['name' => 'Baraka Joseph']);
        $this->assertSame([$this->rendered('Amina Mushi')], array_values($gateway->sent));
    }

    public function test_a_person_chosen_inside_a_kanda_is_addressed_by_their_registered_name(): void
    {
        $this->signIn();
        $parish = $this->parish();
        $this->member($parish['maria'], 'Amina Mushi', '0712000001');
        $daudi = $this->member($parish['anna'], 'Daudi Peter', '0712000004');
        $outsider = $this->member($parish['yosefu'], 'Baraka Joseph', '0712000003');

        $gateway = $this->captureSms();

        $this->postJson('/api/messages', [
            'channel' => 'sms',
            'audience' => 'kanda',
            'kanda_ids' => [$parish['kaskazini']->id],
            'member_ids' => [$daudi->id, $outsider->id],
            'topic' => 'mkutano',
            'body' => self::BODY,
        ])->assertCreated()
            ->assertJsonPath('audience_label', 'Kanda: Kanda ya Kaskazini · watu 1')
            ->assertJsonPath('sms_sent', 1);

        $this->assertDatabaseHas('message_recipients', ['name' => 'Daudi Peter']);
        $this->assertDatabaseMissing('message_recipients', ['name' => 'Amina Mushi']);
        $this->assertDatabaseMissing('message_recipients', ['name' => 'Baraka Joseph']);
        $this->assertSame([$this->rendered('Daudi Peter')], array_values($gateway->sent));
    }

    public function test_a_whole_jumuiya_still_gets_each_members_own_name(): void
    {
        $this->signIn();
        $parish = $this->parish();
        $this->member($parish['maria'], 'Amina Mushi', '0712000001');
        $this->member($parish['maria'], 'Neema Paulo', '0712000002');

        $gateway = $this->captureSms();

        $this->postJson('/api/messages', [
            'channel' => 'sms',
            'audience' => 'jumuiya',
            'jumuiya_ids' => [$parish['maria']->id],
            'topic' => 'mkutano',
            'body' => self::BODY,
        ])->assertCreated()
            ->assertJsonPath('sms_sent', 2);

        $this->assertEqualsCanonicalizing(
            [$this->rendered('Amina Mushi'), $this->rendered('Neema Paulo')],
            array_values($gateway->sent),
        );
    }

    public function test_the_sender_must_choose_what_the_message_is_about(): void
    {
        $this->signIn();
        $parish = $this->parish();
        $this->member($parish['maria'], 'Amina Mushi', '0712000001');

        $this->postJson('/api/messages', [
            'channel' => 'sms',
            'audience' => 'jumuiya',
            'jumuiya_ids' => [$parish['maria']->id],
            'body' => self::BODY,
        ])->assertUnprocessable()->assertJsonValidationErrors('topic');

        $this->postJson('/api/messages', [
            'channel' => 'sms',
            'audience' => 'jumuiya',
            'jumuiya_ids' => [$parish['maria']->id],
            'topic' => 'zaka',
            'body' => self::BODY,
        ])->assertCreated()
            ->assertJsonPath('topic', 'zaka')
            ->assertJsonPath('title', 'Zaka');

        $this->postJson('/api/messages', [
            'channel' => 'app',
            'audience' => 'users',
            'topic' => 'misa',
            'title' => 'Misa ya asubuhi',
            'body' => self::BODY,
        ])->assertCreated()
            ->assertJsonPath('topic', 'misa')
            ->assertJsonPath('title', 'Misa ya asubuhi');
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

    private function rendered(string $name): string
    {
        return 'Tumsifu Yesu Kristu '.$name.'. Kutakuwa na mkutano wa jumuiya siku ya ___ saa ___. Karibu sana.';
    }

    private function signIn(): void
    {
        config(['services.sms.driver' => 'log']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
    }

    /** @return array{kaskazini: Kanda, maria: Jumuiya, anna: Jumuiya, yosefu: Jumuiya} */
    private function parish(): array
    {
        $kaskazini = Kanda::factory()->create(['name' => 'Kanda ya Kaskazini']);
        $kusini = Kanda::factory()->create(['name' => 'Kanda ya Kusini']);

        return [
            'kaskazini' => $kaskazini,
            'maria' => Jumuiya::factory()->create(['name' => 'Jumuiya ya Maria', 'kanda_id' => $kaskazini->id]),
            'anna' => Jumuiya::factory()->create(['name' => 'Jumuiya ya Anna', 'kanda_id' => $kaskazini->id]),
            'yosefu' => Jumuiya::factory()->create(['name' => 'Jumuiya ya Yosefu', 'kanda_id' => $kusini->id]),
        ];
    }

    private function member(Jumuiya $jumuiya, string $name, string $phone): JumuiyaMember
    {
        return JumuiyaMember::query()->create([
            'jumuiya_id' => $jumuiya->id,
            'name' => $name,
            'phone' => $phone,
        ]);
    }
}
