<?php

namespace Tests\Feature;

use App\Models\DeletionRequest;
use App\Models\Jumuiya;
use App\Models\Kanda;
use App\Models\Module;
use App\Models\Offering;
use App\Models\SystemNotice;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeletionRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_privileged_user_requests_kanda_delete_and_admin_approval_deletes_it(): void
    {
        [$admin, $secretary] = $this->adminAndPrivilegedUser('kanda');
        $kanda = Kanda::factory()->create(['name' => 'Kanda ya Mtihani']);

        Sanctum::actingAs($secretary);

        $this->deleteJson("/api/kandas/{$kanda->id}")->assertForbidden();

        $created = $this->postJson('/api/deletion-requests', [
            'subject_type' => 'kanda',
            'subject_id' => $kanda->id,
            'reason' => 'Haifai tena',
        ])->assertStatus(202);

        $requestId = $created->json('request.id');
        $this->assertTrue(
            SystemNotice::query()
                ->where('user_id', $admin->id)
                ->where('kind', 'deletion_request')
                ->exists(),
        );

        Sanctum::actingAs($admin);

        $this->postJson("/api/deletion-requests/{$requestId}/approve")
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');

        $this->assertSoftDeleted('kandas', ['id' => $kanda->id]);
        $this->assertTrue(
            SystemNotice::query()
                ->where('user_id', $secretary->id)
                ->where('kind', 'deletion_approved')
                ->exists(),
        );
    }

    public function test_privileged_user_must_request_jumuiya_and_offering_deletes(): void
    {
        [, $user] = $this->adminAndPrivilegedUser('jumuiya', 'sadaka');
        $kanda = Kanda::factory()->create();
        $jumuiya = Jumuiya::query()->create([
            'name' => 'Jumuiya ya Ombi',
            'kanda_id' => $kanda->id,
            'chairperson' => 'Neema',
        ]);
        $offering = Offering::query()->create([
            'category' => 'sadaka',
            'amount' => 5000,
            'received_on' => now()->toDateString(),
            'payment_method' => 'cash',
            'recorded_by' => 'Tester',
            'user_id' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/jumuiyas/{$jumuiya->id}")->assertForbidden();
        $this->deleteJson("/api/offerings/{$offering->id}")->assertForbidden();

        $this->postJson('/api/deletion-requests', [
            'subject_type' => 'jumuiya',
            'subject_id' => $jumuiya->id,
        ])->assertStatus(202);

        $this->postJson('/api/deletion-requests', [
            'subject_type' => 'offering',
            'subject_id' => $offering->id,
        ])->assertStatus(202);
    }

    public function test_admin_can_delete_kanda_immediately(): void
    {
        Modules::sync();

        $admin = User::query()->create([
            'name' => 'Admin',
            'username' => 'admin2',
            'role' => 'admin',
            'password' => 'secret',
        ]);
        $kanda = Kanda::factory()->create(['name' => 'Kanda ya Admin']);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/kandas/{$kanda->id}")
            ->assertOk()
            ->assertJsonPath('moved', 0);

        $this->assertSoftDeleted('kandas', ['id' => $kanda->id]);
    }

    public function test_admin_can_reject_deletion_request(): void
    {
        [$admin, $user] = $this->adminAndPrivilegedUser('kanda');
        $kanda = Kanda::factory()->create(['name' => 'Kanda Iliyokataliwa']);

        $request = DeletionRequest::query()->create([
            'requester_id' => $user->id,
            'subject_type' => DeletionRequest::TYPE_KANDA,
            'subject_id' => $kanda->id,
            'subject_label' => $kanda->name,
            'payload' => ['move_to_kanda_id' => null],
            'status' => DeletionRequest::STATUS_PENDING,
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/deletion-requests/{$request->id}/reject", [
            'review_note' => 'Bado inahitajika',
        ])->assertOk()->assertJsonPath('request.status', 'rejected');

        $this->assertDatabaseHas('kandas', ['id' => $kanda->id, 'deleted_at' => null]);
        $this->assertTrue(
            SystemNotice::query()
                ->where('user_id', $user->id)
                ->where('kind', 'deletion_rejected')
                ->exists(),
        );
    }

    /** @return array{0: User, 1: User} */
    private function adminAndPrivilegedUser(string ...$modules): array
    {
        Modules::sync();

        $admin = User::query()->create([
            'name' => 'Admin',
            'username' => 'admin_'.uniqid(),
            'role' => 'admin',
            'password' => 'secret',
        ]);

        $user = User::query()->create([
            'name' => 'Clerk',
            'username' => 'clerk_'.uniqid(),
            'role' => 'member',
            'password' => 'secret',
        ]);

        foreach ($modules as $key) {
            $module = Module::query()->where('key', $key)->firstOrFail();
            $user->modules()->attach($module->id, [
                'can_create' => false,
                'can_update' => false,
                'can_delete' => true,
            ]);
        }

        return [$admin, $user];
    }
}
