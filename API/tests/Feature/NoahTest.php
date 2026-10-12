<?php

namespace Tests\Feature;

use App\Models\Module;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NoahTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, array $modules = []): User
    {
        Modules::sync();

        $user = User::query()->create([
            'name' => ucfirst($role).' Mtumiaji',
            'username' => $role.fake()->unique()->numberBetween(1, 9999),
            'role' => $role,
            'password' => 'secret',
        ]);

        foreach ($modules as $key => $privileges) {
            $user->modules()->attach(Module::query()->where('key', $key)->value('id'), [
                'can_create' => in_array('create', $privileges, true),
                'can_update' => in_array('update', $privileges, true),
                'can_delete' => in_array('delete', $privileges, true),
            ]);
        }

        return $user;
    }

    private function ask(User $user, string $message, string $lang = 'sw', array $extra = []): array
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/noah/ask', ['message' => $message, ...$extra], ['Accept-Language' => $lang])
            ->assertOk()
            ->json();
    }

    public function test_admin_gets_steps_for_adding_a_user(): void
    {
        $reply = $this->ask($this->makeUser('admin'), 'Nawezaje kuongeza mtumiaji mpya?');

        $this->assertSame('users.create', $reply['topic']);
        $this->assertSame('ok', $reply['status']);
        $this->assertStringContainsString('Ongeza mtumiaji', $reply['reply']);
        $this->assertSame('/users', $reply['links'][0]['path']);
    }

    public function test_view_only_user_is_told_they_cannot_delete(): void
    {
        $admin = $this->makeUser('admin');
        $user = $this->makeUser('treasurer', ['sadaka' => []]);

        $reply = $this->ask($user, 'naweza kufuta sadaka?');

        $this->assertSame('restricted', $reply['status']);
        $this->assertSame('sadaka.delete', $reply['topic']);
        $this->assertStringContainsString('kufuta', $reply['reply']);
        $this->assertStringContainsString($admin->name, $reply['reply']);
        $this->assertStringNotContainsString('thibitishe', $reply['reply']);
    }

    public function test_user_without_module_gets_the_limitation_not_the_steps(): void
    {
        $user = $this->makeUser('secretary', ['sadaka' => ['create']]);

        $reply = $this->ask($user, 'How do I add a new user?', 'en');

        $this->assertSame('restricted', $reply['status']);
        $this->assertSame('users', $reply['module']);
        $this->assertStringContainsString("doesn't have access to the **Users** module", $reply['reply']);
        $this->assertStringNotContainsString('Add user', $reply['reply']);
    }

    public function test_user_with_privilege_gets_a_yes(): void
    {
        $user = $this->makeUser('treasurer', ['sadaka' => ['create']]);

        $reply = $this->ask($user, 'naweza kurekodi mchango?');

        $this->assertSame('ok', $reply['status']);
        $this->assertSame('sadaka.create', $reply['topic']);
        $this->assertStringStartsWith('Ndiyo', $reply['reply']);
    }

    public function test_disabled_module_is_explained(): void
    {
        $admin = $this->makeUser('admin');
        Module::query()->where('key', 'kanda')->update(['enabled' => false]);

        $reply = $this->ask($admin, 'jinsi ya kuongeza kanda');

        $this->assertSame('disabled', $reply['status']);
        $this->assertStringContainsString('Mipangilio ya mfumo', $reply['reply']);
    }

    public function test_access_report_lists_what_the_user_has_and_lacks(): void
    {
        $user = $this->makeUser('secretary', ['jumuiya' => ['create', 'update']]);

        $reply = $this->ask($user, 'ruhusa zangu ni zipi?');

        $this->assertSame('noah.access', $reply['topic']);
        $this->assertStringContainsString('kuona, kuongeza na kuhariri', $reply['reply']);
        $this->assertStringContainsString('Huna ruhusa ya', $reply['reply']);
    }

    public function test_follow_up_uses_the_page_the_user_is_on(): void
    {
        $user = $this->makeUser('secretary', ['jumuiya' => ['create']]);

        $reply = $this->ask($user, 'nifanyeje kuongeza hapa?', 'sw', ['path' => '/jumuiya']);

        $this->assertSame('jumuiya', $reply['module']);
        $this->assertSame('ok', $reply['status']);
    }

    public function test_general_questions_need_no_module(): void
    {
        $reply = $this->ask($this->makeUser('member'), 'how do I change the language to English?', 'en');

        $this->assertSame('general.language', $reply['topic']);
        $this->assertSame('ok', $reply['status']);
    }

    public function test_questions_reach_the_right_topic(): void
    {
        $admin = $this->makeUser('admin');

        $cases = [
            ['sw', 'nani alifuta jumuiya?', 'activity_logs.overview'],
            ['en', 'restore a deleted user', 'general.recycle'],
            ['sw', 'nimefuta sadaka kwa bahati mbaya', 'general.recycle'],
            ['en', 'how do I record a tithe', 'sadaka.create'],
            ['en', 'how to send a message to all members', 'notifications.send'],
            ['sw', 'jinsi ya kutuma sms kwa jumuiya', 'notifications.send'],
            ['sw', 'ongeza mwanajumuiya', 'jumuiya.members'],
            ['sw', 'gawanya jumuiya', 'jumuiya.split'],
            ['sw', 'hamisha jumuiya kwenda kanda nyingine', 'jumuiya.move'],
            ['sw', 'ninawezaje kuingiza zaka kutoka excel', 'sadaka.import'],
            ['sw', 'sms hazifiki', 'notifications.testmode'],
            ['sw', 'weka nextsms', 'api_settings.sms'],
            ['sw', 'zima moduli ya kanda', 'settings.modules'],
            ['sw', 'nimesahau nenosiri', 'general.password'],
            ['en', 'create a role', 'users.roles'],
            ['en', 'split a zone', 'kanda.split'],
        ];

        foreach ($cases as [$lang, $question, $topic]) {
            $this->assertSame($topic, $this->ask($admin, $question, $lang)['topic'], $question);
        }
    }

    public function test_intro_and_unknown(): void
    {
        $user = $this->makeUser('member');
        Sanctum::actingAs($user);

        $this->getJson('/api/noah', ['Accept-Language' => 'sw'])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonFragment(['topic' => 'noah.access']);

        $this->assertSame('unknown', $this->ask($user, 'xyzzy plugh')['status']);
    }

    public function test_events_is_a_module_that_is_coming_soon(): void
    {
        $admin = $this->makeUser('admin');
        $reply = $this->ask($admin, 'matukio yanafanyaje kazi?');

        $this->assertSame('matukio.overview', $reply['topic']);
        $this->assertStringContainsString('inakuja hivi karibuni', $reply['reply']);
        $this->assertSame('/matukio', $reply['links'][0]['path']);

        $member = $this->makeUser('member', ['sadaka' => []]);
        $this->assertSame('restricted', $this->ask($member, 'how do events work?', 'en')['status']);
        $this->assertSame('unknown', $this->ask($member, 'mahudhurio')['status']);
    }

    public function test_noah_addresses_the_user_by_username(): void
    {
        $user = User::query()->create([
            'name' => 'Victoria Mushi',
            'username' => 'torie',
            'role' => 'member',
            'password' => 'secret',
        ]);

        $this->assertStringContainsString('Salama, torie!', $this->ask($user, 'habari')['reply']);
        $this->assertStringContainsString('Sorry torie,', $this->ask($user, 'how do I add a user?', 'en')['reply']);

        $this->getJson('/api/noah', ['Accept-Language' => 'sw'])
            ->assertOk()
            ->assertJsonPath('reply', fn (string $reply) => str_contains($reply, 'Tumsifu Yesu Kristu, torie!'));
    }

    public function test_guests_cannot_ask(): void
    {
        $this->postJson('/api/noah/ask', ['message' => 'habari'])->assertUnauthorized();
    }
}
