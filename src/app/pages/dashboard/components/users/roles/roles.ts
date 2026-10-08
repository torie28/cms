import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../../core/auth';
import { ConfirmService } from '../../../../../core/confirm';
import { httpErrorMessage } from '../../../../../core/http-error';
import { translate, TranslatePipe } from '../../../../../core/i18n';
import { AppModule, ModulesService } from '../../../../../core/modules';
import { Role, RolesService } from '../../../../../core/roles';
import { ManagedUser, UsersService } from '../../../../../core/users';
import { matchesSearch, SearchBox } from '../../../../../shared/search-box';
import { UserDialog } from '../user-dialog/user-dialog';

const PREVIEW_MEMBERS = 4;

@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SearchBox, TranslatePipe, UserDialog],
  templateUrl: './roles.html',
})
export class Roles {
  private readonly rolesApi = inject(RolesService);
  private readonly usersApi = inject(UsersService);
  private readonly modulesApi = inject(ModulesService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  protected readonly canCreate = computed(() => this.auth.can('users', 'create'));
  protected readonly canUpdate = computed(() => this.auth.can('users', 'update'));
  protected readonly canDelete = computed(() => this.auth.can('users', 'delete'));
  protected readonly previewCount = PREVIEW_MEMBERS;
  protected readonly skeletonCards = [1, 2, 3];

  protected readonly roles = signal<Role[]>([]);
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly modules = signal<AppModule[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly roleFormOpen = signal(false);
  protected readonly editingRole = signal<Role | null>(null);
  protected readonly savingRole = signal(false);
  protected readonly roleError = signal<string | null>(null);

  /** The role a new user is being assigned to; opens the user dialog. */
  protected readonly assigningRole = signal<Role | null>(null);

  protected readonly filteredRoles = computed(() =>
    this.roles().filter((role) => matchesSearch(this.search(), [
      role.label,
      translate(role.label),
      role.name,
      role.description,
    ])),
  );

  protected readonly membersByRole = computed(() => {
    const groups = new Map<string, ManagedUser[]>();
    for (const person of this.users()) {
      groups.set(person.role, [...(groups.get(person.role) ?? []), person]);
    }
    return groups;
  });

  protected readonly roleForm = inject(FormBuilder).nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
  });

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected members(role: Role): ManagedUser[] {
    return this.membersByRole().get(role.name) ?? [];
  }

  protected openCreateRole(): void {
    this.editingRole.set(null);
    this.roleForm.reset({ label: '', description: '' });
    this.roleError.set(null);
    this.roleFormOpen.set(true);
  }

  protected openEditRole(role: Role): void {
    this.editingRole.set(role);
    this.roleForm.reset({ label: role.label, description: role.description ?? '' });
    this.roleError.set(null);
    this.roleFormOpen.set(true);
  }

  protected closeRoleForm(): void {
    if (!this.savingRole()) {
      this.roleFormOpen.set(false);
    }
  }

  protected async submitRole(): Promise<void> {
    if (this.savingRole()) {
      return;
    }

    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const value = this.roleForm.getRawValue();
    const payload = { label: value.label.trim(), description: value.description.trim() || null };

    this.savingRole.set(true);
    this.roleError.set(null);

    try {
      const current = this.editingRole();
      const saved = current
        ? await this.rolesApi.update(current.id, payload)
        : await this.rolesApi.create(payload);
      this.roles.update((list) => [...list.filter((role) => role.id !== saved.id), saved]);
      this.roleFormOpen.set(false);
    } catch (error) {
      this.roleError.set(httpErrorMessage(error, 'Imeshindwa kuhifadhi wadhifa huo.'));
    } finally {
      this.savingRole.set(false);
    }
  }

  protected async removeRole(role: Role): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: translate('Futa wadhifa wa {role}?', { role: translate(role.label) }),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.rolesApi.remove(role.id);
      this.roles.update((list) => list.filter((item) => item.id !== role.id));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kufuta wadhifa huo.'));
    }
  }

  protected openAssign(role: Role): void {
    this.assigningRole.set(role);
  }

  protected closeAssign(): void {
    this.assigningRole.set(null);
  }

  protected onUserSaved(saved: ManagedUser): void {
    this.users.update((list) => [...list, saved]);
    this.roles.update((list) =>
      list.map((role) => (role.name === saved.role ? { ...role, users_count: role.users_count + 1 } : role)),
    );
    this.closeAssign();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [roles, users, modules] = await Promise.all([
        this.rolesApi.list(),
        this.usersApi.list(),
        this.modulesApi.list(),
      ]);
      this.roles.set(roles);
      this.users.set(users);
      this.modules.set(modules);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia nyadhifa.'));
    } finally {
      this.loading.set(false);
    }
  }
}
