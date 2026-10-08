import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../../core/auth';
import { httpErrorMessage } from '../../../../../core/http-error';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  AppModule,
  EMPTY_PRIVILEGES,
  MODULE_ACTIONS,
  ModuleAction,
  ModuleActionOption,
  ModulePrivileges,
} from '../../../../../core/modules';
import { Role } from '../../../../../core/roles';
import { Gender, GENDERS, ManagedUser, UserPayload, UsersService } from '../../../../../core/users';

/** Granted to everyone, so it is shown as always-on rather than as a choice. */
const ALWAYS_ON_MODULE = 'dashboard';

@Component({
  selector: 'app-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './user-dialog.html',
})
export class UserDialog implements OnInit {
  private readonly usersApi = inject(UsersService);
  private readonly auth = inject(AuthService);

  readonly roles = input.required<Role[]>();
  readonly modules = input.required<AppModule[]>();
  /** When set, the dialog edits this user instead of creating one. */
  readonly user = input<ManagedUser | null>(null);
  /** When set, the role is fixed (used when assigning users from the Roles page). */
  readonly lockedRole = input<Role | null>(null);

  readonly saved = output<ManagedUser>();
  readonly closed = output<void>();

  protected readonly genders = GENDERS;
  protected readonly alwaysOn = ALWAYS_ON_MODULE;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedModules = signal<ReadonlySet<string>>(new Set());
  protected readonly privileges = signal<Record<string, ModulePrivileges>>({});
  protected readonly selectedRole = signal('member');

  protected readonly isEdit = computed(() => this.user() !== null);
  protected readonly isAdminRole = computed(() => this.selectedRole() === 'admin');
  protected readonly assignableRoles = computed(() =>
    this.auth.isAdmin() ? this.roles() : this.roles().filter((role) => role.name !== 'admin'),
  );
  protected readonly availableModules = computed(() => {
    const enabled = this.modules().filter((module) => module.enabled);
    if (this.auth.isAdmin()) {
      return enabled;
    }
    const selected = this.selectedModules();
    return enabled.filter(
      (module) => module.key === ALWAYS_ON_MODULE || this.auth.canAccess(module.key) || selected.has(module.key),
    );
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    email: ['', Validators.email],
    password: [''],
    phone: ['', Validators.pattern(/^\+?[0-9 ]{7,20}$/)],
    gender: ['' as Gender | ''],
    role: ['member', Validators.required],
  });

  ngOnInit(): void {
    const user = this.user();
    const role = this.lockedRole()?.name ?? user?.role ?? 'member';

    this.form.reset({
      name: user?.name ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      password: '',
      phone: user?.phone ?? '',
      gender: user?.gender ?? '',
      role,
    });

    const password = this.form.controls.password;
    password.setValidators(user ? [Validators.minLength(4)] : [Validators.required, Validators.minLength(4)]);
    password.updateValueAndValidity();

    if (this.lockedRole()) {
      this.form.controls.role.disable();
    }

    this.selectedRole.set(role);
    this.selectedModules.set(new Set(user?.modules ?? []));
    const stored = user?.privileges ?? {};
    const initial: Record<string, ModulePrivileges> = {};
    for (const key of user?.modules ?? []) {
      initial[key] = { ...EMPTY_PRIVILEGES, ...stored[key] };
    }
    this.privileges.set(initial);
  }

  protected onRoleChange(value: string): void {
    this.selectedRole.set(value);
  }

  protected isSelected(key: string): boolean {
    return key === ALWAYS_ON_MODULE || this.isAdminRole() || this.selectedModules().has(key);
  }

  protected actionsFor(key: string): readonly ModuleActionOption[] {
    return MODULE_ACTIONS[key] ?? [];
  }

  protected hasPrivilege(key: string, action: ModuleAction): boolean {
    return !!this.privileges()[key]?.[action];
  }

  protected viewOnly(key: string): boolean {
    return this.actionsFor(key).every((option) => !this.hasPrivilege(key, option.action));
  }

  /** Add reads green, removal red, everything else brass, so the risky choices stand out. */
  protected actionClasses(option: ModuleActionOption, active: boolean): string {
    if (!active) {
      return 'border-line text-muted hover:border-line-strong hover:text-ink';
    }
    if (option.icon === 'trash') {
      return 'border-negative bg-negative/10 text-negative';
    }
    if (option.action === 'create') {
      return 'border-positive bg-positive/10 text-positive';
    }
    return 'border-brass bg-brass-tint text-brass-strong';
  }

  /** An action the editor cannot grant stays off, unless this account already has it. */
  protected privilegeLocked(key: string, action: ModuleAction): boolean {
    return !this.hasPrivilege(key, action) && !this.auth.isAdmin() && !this.auth.can(key, action);
  }

  protected toggleModule(key: string): void {
    const removing = this.selectedModules().has(key);
    this.selectedModules.update((current) => {
      const next = new Set(current);
      if (removing) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    this.privileges.update((current) => {
      const next = { ...current };
      if (removing) {
        delete next[key];
      } else {
        next[key] = this.defaultPrivileges(key);
      }
      return next;
    });
  }

  protected togglePrivilege(key: string, action: ModuleAction): void {
    if (this.privilegeLocked(key, action) && !this.hasPrivilege(key, action)) {
      return;
    }
    this.privileges.update((current) => {
      const entry = { ...EMPTY_PRIVILEGES, ...current[key], [action]: !current[key]?.[action] };
      return { ...current, [key]: entry };
    });
  }

  protected toggleAll(): void {
    const keys = this.availableModules()
      .map((module) => module.key)
      .filter((key) => key !== ALWAYS_ON_MODULE);
    const allSelected = keys.every((key) => this.selectedModules().has(key));
    this.selectedModules.set(allSelected ? new Set() : new Set(keys));
    this.privileges.update((current) => {
      if (allSelected) {
        return {};
      }
      const next = { ...current };
      for (const key of keys) {
        next[key] ??= this.defaultPrivileges(key);
      }
      return next;
    });
  }

  private defaultPrivileges(key: string): ModulePrivileges {
    const privileges = { ...EMPTY_PRIVILEGES };
    for (const option of this.actionsFor(key)) {
      if (this.auth.isAdmin() || this.auth.can(key, option.action)) {
        privileges[option.action] = true;
      }
    }
    return privileges;
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const modules = [...this.selectedModules()].filter((key) => key !== ALWAYS_ON_MODULE);
    const privileges = Object.fromEntries(
      modules.map((key) => [key, { ...EMPTY_PRIVILEGES, ...this.privileges()[key] }]),
    );
    const payload: UserPayload = {
      name: value.name.trim(),
      username: value.username.trim(),
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      gender: value.gender || null,
      password: value.password,
      role: value.role,
      modules,
      privileges,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const current = this.user();
      const result = current
        ? await this.usersApi.update(current.id, payload)
        : await this.usersApi.create(payload);
      this.saved.emit(result);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuhifadhi mtumiaji huyo.'));
    } finally {
      this.saving.set(false);
    }
  }
}
