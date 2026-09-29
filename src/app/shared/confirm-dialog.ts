import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmService } from '../core/confirm';
import { TranslatePipe } from '../core/i18n';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (confirm.request(); as request) {
      <div
        class="fixed inset-0 z-[900] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        animate.enter="backdrop-in"
        animate.leave="backdrop-out"
        (click)="confirm.answer(false)"
      >
        <section
          class="relative w-full max-w-sm overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          (click)="$event.stopPropagation()"
        >
          <div class="h-1" [class]="request.tone === 'danger' ? 'bg-negative' : 'bg-brass'"></div>

          <button
            type="button"
            class="absolute top-3 right-3 cursor-pointer rounded-full p-1.5 text-faint hover:bg-sunken hover:text-ink"
            [attr.aria-label]="'Funga' | t"
            (click)="confirm.answer(false)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div class="px-6 pt-7 pb-6 text-center">
            <div
              class="confirm-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-8"
              [class]="
                request.tone === 'danger'
                  ? 'bg-negative/10 text-negative ring-negative/5'
                  : 'bg-brass-tint text-brass-strong ring-brass-tint/40'
              "
            >
              @if (request.tone === 'danger') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7" aria-hidden="true">
                  <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9.5v4.5" />
                  <circle cx="12" cy="17" r="0.6" fill="currentColor" />
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7" />
                  <circle cx="12" cy="17" r="0.6" fill="currentColor" />
                </svg>
              }
            </div>

            <h2 id="confirm-title" class="font-serif text-xl text-ink">{{ request.title | t }}</h2>
            <p id="confirm-message" class="mt-2 text-sm leading-relaxed text-muted">{{ request.message }}</p>
          </div>

          <div class="flex gap-3 border-t border-line bg-sunken/50 px-6 py-4">
            <button
              #cancelButton
              type="button"
              class="flex-1 cursor-pointer rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-line-strong hover:bg-canvas"
              (click)="confirm.answer(false)"
            >
              {{ 'Ghairi' | t }}
            </button>
            <button
              #confirmButton
              type="button"
              class="flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-canvas shadow-sm hover:opacity-90"
              [class]="request.tone === 'danger' ? 'bg-negative' : 'bg-brass-strong'"
              (click)="confirm.answer(true)"
            >
              {{ request.confirmLabel | t }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .confirm-icon {
      animation: confirm-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.08s both;
    }

    @keyframes confirm-pop {
      from {
        opacity: 0;
        transform: scale(0.5);
      }
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  private previousFocus: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const request = this.confirm.request();
      if (!request) {
        this.previousFocus?.focus();
        this.previousFocus = null;
        return;
      }
      if (!this.previousFocus && document.activeElement instanceof HTMLElement) {
        this.previousFocus = document.activeElement;
      }
      // Destructive actions start on Cancel so a stray Enter does not delete anything.
      const target = request.tone === 'danger' ? this.cancelButton() : this.confirmButton();
      target?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.confirm.request()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.confirm.answer(false);
    } else if (event.key === 'Tab') {
      // Keep focus inside the two buttons.
      const cancel = this.cancelButton()?.nativeElement;
      const ok = this.confirmButton()?.nativeElement;
      if (!cancel || !ok) {
        return;
      }
      event.preventDefault();
      (document.activeElement === cancel ? ok : cancel).focus();
    }
  }
}
