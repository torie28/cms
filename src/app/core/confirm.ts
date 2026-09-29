import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'danger' | 'default';

export interface ConfirmOptions {
  /** Already-translated question shown in the dialog body. */
  message: string;
  /** Translation key for the heading. */
  title?: string;
  /** Translation key for the confirm button. */
  confirmLabel?: string;
  tone?: ConfirmTone;
}

export interface ConfirmRequest extends Required<ConfirmOptions> {
  resolve: (answer: boolean) => void;
}

/** In-app replacement for window.confirm(); rendered by <app-confirm-dialog> in the root template. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<ConfirmRequest | null>(null);
  readonly request = this.pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // A second request while one is open cancels the first rather than stacking dialogs.
    this.pending()?.resolve(false);

    const tone = options.tone ?? 'default';
    return new Promise<boolean>((resolve) => {
      this.pending.set({
        message: options.message,
        title: options.title ?? (tone === 'danger' ? 'Una uhakika?' : 'Thibitisha'),
        confirmLabel: options.confirmLabel ?? (tone === 'danger' ? 'Futa' : 'Endelea'),
        tone,
        resolve,
      });
    });
  }

  answer(value: boolean): void {
    const request = this.pending();
    if (!request) {
      return;
    }
    this.pending.set(null);
    request.resolve(value);
  }
}
