import { DatePipe, formatDate } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { AuthService } from '../../../../../core/auth';
import { ConfirmService } from '../../../../../core/confirm';
import { httpErrorMessage } from '../../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../../core/i18n';
import { AppModule, MODULE_ACTIONS, ModulesService } from '../../../../../core/modules';
import { Role, roleLabel, RolesService } from '../../../../../core/roles';
import { genderLabel, ManagedUser, UsersService } from '../../../../../core/users';
import { FilterPanel, withinDateRange } from '../../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../../shared/search-box';
import { UserDialog } from '../user-dialog/user-dialog';

type UserSort = 'name' | 'name-desc' | 'newest' | 'oldest';

@Component({
  selector: 'app-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FilterPanel, SearchBox, TranslatePipe, UserDialog],
  templateUrl: './user-list.html',
})
export class UserList {
  private readonly usersApi = inject(UsersService);
  private readonly rolesApi = inject(RolesService);
  private readonly modulesApi = inject(ModulesService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LOCALE_ID);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly canCreate = computed(() => this.auth.can('users', 'create'));
  protected readonly canUpdate = computed(() => this.auth.can('users', 'update'));
  protected readonly canDelete = computed(() => this.auth.can('users', 'delete'));
  protected readonly currentUserId = computed(() => this.auth.user()?.id);
  protected readonly genderLabel = genderLabel;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly modules = signal<AppModule[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<ManagedUser | null>(null);

  protected readonly search = signal('');
  protected readonly roleFilter = signal('');
  protected readonly addedFrom = signal('');
  protected readonly addedTo = signal('');
  protected readonly sort = signal<UserSort>('name');

  protected readonly activeFilters = computed(
    () =>
      [this.roleFilter(), this.addedFrom(), this.addedTo()].filter(Boolean).length +
      (this.sort() === 'name' ? 0 : 1),
  );

  protected readonly filteredUsers = computed(() => {
    const role = this.roleFilter();
    const rows = this.users().filter(
      (person) =>
        (role === '' || person.role === role) &&
        withinDateRange(
          formatDate(person.created_at, 'yyyy-MM-dd', this.locale),
          this.addedFrom(),
          this.addedTo(),
        ) &&
        matchesSearch(this.search(), [
          person.name,
          person.username,
          person.email,
          person.phone,
          this.roleName(person.role),
        ]),
    );

    const sort = this.sort();
    return rows.sort((a, b) => {
      if (sort === 'newest' || sort === 'oldest') {
        const diff = a.created_at.localeCompare(b.created_at);
        return sort === 'newest' ? -diff : diff;
      }

      const diff = a.name.localeCompare(b.name);
      return sort === 'name-desc' ? -diff : diff;
    });
  });

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('Watumiaji {shown} kati ya {total}', {
          shown: this.filteredUsers().length,
          total: this.users().length,
        })
      : '',
  );

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected roleName(role: string): string {
    return translate(roleLabel(this.roles(), role));
  }

  protected moduleNames(person: ManagedUser): string {
    if (person.role === 'admin') {
      return translate('Zote');
    }

    const labels = this.modules()
      .filter((module) => person.modules.includes(module.key))
      .map((module) => {
        const options = MODULE_ACTIONS[module.key] ?? [];
        const granted = options.filter((option) => person.privileges?.[module.key]?.[option.action]);
        const label = translate(module.label);
        if (options.length === 0 || granted.length === options.length) {
          return label;
        }
        if (granted.length === 0) {
          return `${label} (${translate('kuona tu')})`;
        }
        return `${label} (${granted.map((option) => translate(option.label)).join(', ')})`;
      });

    return labels.length ? labels.join(', ') : translate('Muhtasari tu');
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(person: ManagedUser): void {
    this.editing.set(person);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
  }

  protected onSaved(saved: ManagedUser): void {
    this.users.update((current) => [...current.filter((person) => person.id !== saved.id), saved]);
    this.closeDialog();

    if (saved.id === this.currentUserId()) {
      void this.auth.refresh();
    }
  }

  protected async remove(person: ManagedUser): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: translate('Futa akaunti ya {name}? Hataweza kuingia tena.', { name: person.name }),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.usersApi.remove(person.id);
      this.users.update((current) => current.filter((item) => item.id !== person.id));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kumfuta mtumiaji huyo.'));
    }
  }

  protected clearFilters(): void {
    this.roleFilter.set('');
    this.addedFrom.set('');
    this.addedTo.set('');
    this.sort.set('name');
  }

  protected setSort(value: string): void {
    this.sort.set(value as UserSort);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [users, roles, modules] = await Promise.all([
        this.usersApi.list(),
        this.rolesApi.list(),
        this.modulesApi.list(),
      ]);
      this.users.set(users);
      this.roles.set(roles);
      this.modules.set(modules);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia watumiaji.'));
    } finally {
      this.loading.set(false);
    }
  }
}
