import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth';
import { I18nService, LANGUAGES, TranslatePipe } from '../core/i18n';

/** One click anywhere on the pill flips between the two languages. */
@Component({
  selector: 'app-language-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="inline-flex cursor-pointer items-center rounded-full border border-line bg-surface p-0.5 hover:border-brass"
      [attr.aria-label]="('Lugha' | t) + ': ' + current().label"
      [title]="('Lugha' | t) + ': ' + current().label + ' → ' + next().label"
      (click)="toggle()"
    >
      @for (option of languages; track option.value) {
        <span
          class="flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors"
          [class]="i18n.lang() === option.value ? 'bg-brass-tint text-brass-strong' : 'text-faint'"
          [attr.lang]="option.value"
          aria-hidden="true"
        >
          {{ option.short }}
        </span>
      }
    </button>
  `,
})
export class LanguageToggle {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly languages = LANGUAGES;

  protected readonly current = computed(
    () => LANGUAGES.find((option) => option.value === this.i18n.lang()) ?? LANGUAGES[0],
  );
  protected readonly next = computed(
    () => LANGUAGES.find((option) => option.value !== this.i18n.lang()) ?? LANGUAGES[0],
  );

  protected toggle(): void {
    void this.auth.setLanguage(this.next().value);
  }
}
