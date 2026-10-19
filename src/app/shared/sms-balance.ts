import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, TranslatePipe } from '../core/i18n';
import { SmsBalance } from '../core/messages';

/** "16 TZS" → the number that can count up, and the unit that stays put. */
function rateParts(rate: string | null): { value: number; suffix: string } | null {
  const match = rate?.trim().match(/^(\d[\d,]*(?:\.\d+)?)\s*(.*)$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? { value, suffix: match[2] } : null;
}

@Component({
  selector: 'app-sms-balance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, TranslatePipe],
  templateUrl: './sms-balance.html',
})
export class SmsBalanceCard {
  private readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Undefined while the provider has not answered yet. */
  readonly balance = input<SmsBalance | null | undefined>(undefined);
  readonly link = input<string | null>(null);

  protected readonly messages = signal('0');
  protected readonly amount = signal('—');

  constructor() {
    effect((onCleanup) => {
      const balance = this.balance();
      if (!balance || balance.available == null) {
        this.messages.set('—');
        this.amount.set(balance?.rate?.trim() || '—');
        return;
      }

      const messages = balance.available;
      const rate = rateParts(balance.rate);
      const reduce = this.isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const paint = (progress: number) => {
        this.messages.set(Math.round(messages * progress).toLocaleString(this.i18n.intlLocale()));
        if (!rate) {
          this.amount.set(balance.rate?.trim() || '—');
          return;
        }
        const shown = rate.value * progress;
        const text = Number.isInteger(rate.value)
          ? Math.round(shown).toLocaleString(this.i18n.intlLocale())
          : shown.toLocaleString(this.i18n.intlLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        this.amount.set(rate.suffix ? `${text} ${rate.suffix}` : text);
      };

      if (reduce) {
        paint(1);
        return;
      }

      const start = performance.now();
      let frame = 0;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 900);
        paint(1 - Math.pow(1 - progress, 3));
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }
}
