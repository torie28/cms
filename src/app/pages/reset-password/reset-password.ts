import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { httpErrorMessage } from '../../core/http-error';
import { TranslatePipe } from '../../core/i18n';
import { LanguageToggle } from '../../shared/language-toggle';
import { ThemeToggle } from '../../shared/theme-toggle';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, password_confirmation } = group.value as Record<string, string>;
  return password === password_confirmation ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LanguageToggle, ReactiveFormsModule, RouterLink, ThemeToggle, TranslatePipe],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly token = this.query.get('token') ?? '';
  protected readonly email = this.query.get('email') ?? '';

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly year = new Date().getFullYear();

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    try {
      this.done.set(
        await this.auth.resetPassword({ token: this.token, email: this.email, ...this.form.getRawValue() }),
      );
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? 'Maombi mengi mno. Subiri dakika moja kisha ujaribu tena.'
          : httpErrorMessage(error, 'Imeshindwa kubadilisha nenosiri. Jaribu tena.'),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
