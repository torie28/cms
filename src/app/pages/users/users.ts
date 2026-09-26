import { DatePipe, TitleCasePipe } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../../core/http-error';
import { ManagedUser, USER_ROLES, UsersService } from '../../core/users';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, TitleCasePipe],
  templateUrl: './users.html',
})
export class Users {
  private readonly usersApi = inject(UsersService);

  protected readonly roles = USER_ROLES;
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    role: ['member', Validators.required],
  });

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected openForm(): void {
    this.form.reset({ name: '', username: '', email: '', password: '', role: 'member' });
    this.error.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.users.set(await this.usersApi.list());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Unable to load users.'));
    } finally {
      this.loading.set(false);
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

    this.saving.set(true);
    this.error.set(null);

    try {
      const created = await this.usersApi.create(this.form.getRawValue());
      this.users.update((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.closeForm();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Unable to add that user.'));
    } finally {
      this.saving.set(false);
    }
  }
}
