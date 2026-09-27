import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../../../../../core/http-error';
import { TranslatePipe } from '../../../../../core/i18n';
import { AppModule } from '../../../../../core/modules';
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
  protected readonly selectedRole = signal('member');

  protected readonly isEdit = computed(() => this.user() !== null);
  protected readonly isAdminRole = computed(() => this.selectedRole() === 'admin');
  protected readonly availableModules = computed(() => this.modules().filter((module) => module.enabled));

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
  }

  protected onRoleChange(value: string): void {
    this.selectedRole.set(value);
  }

  protected isSelected(key: string): boolean {
    return key === ALWAYS_ON_MODULE || this.isAdminRole() || this.selectedModules().has(key);
  }

  protected toggleModule(key: string): void {
    this.selectedModules.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected toggleAll(): void {
    const keys = this.availableModules()
      .map((module) => module.key)
      .filter((key) => key !== ALWAYS_ON_MODULE);
    const allSelected = keys.every((key) => this.selectedModules().has(key));
    this.selectedModules.set(allSelected ? new Set() : new Set(keys));
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
    const payload: UserPayload = {
      name: value.name.trim(),
      username: value.username.trim(),
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      gender: value.gender || null,
      password: value.password,
      role: value.role,
      modules: [...this.selectedModules()].filter((key) => key !== ALWAYS_ON_MODULE),
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
