import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { httpErrorMessage } from '../../core/http-error';
import { TranslatePipe } from '../../core/i18n';
import { LanguageToggle } from '../../shared/language-toggle';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LanguageToggle, ReactiveFormsModule, RouterLink, ThemeToggle, TranslatePipe],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<string | null>(null);
  protected readonly year = new Date().getFullYear();

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
      this.sent.set(await this.auth.requestPasswordReset(this.form.getRawValue().email.trim()));
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? 'Maombi mengi mno. Subiri dakika moja kisha ujaribu tena.'
          : httpErrorMessage(error, 'Imeshindwa kutuma kiungo. Jaribu tena.'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected tryAgain(): void {
    this.sent.set(null);
  }
}
