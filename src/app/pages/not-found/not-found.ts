import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <!-- bg-canvas: the fade-in isolates this box, so the image can only blend with a background set here. -->
      <div class="alert-in w-full max-w-xl bg-canvas text-center">
        <img
          src="404.jpeg"
          width="576"
          height="288"
          class="mx-auto h-auto w-full max-w-lg select-none mix-blend-multiply dark:mix-blend-screen dark:invert"
          [alt]="'404 — Ukurasa haukupatikana' | t"
          draggable="false"
        />

        <h1 class="-mt-6 font-serif text-2xl text-ink">{{ 'Ukurasa haukupatikana' | t }}</h1>
        <p class="mx-auto mt-2 max-w-md text-sm text-muted">
          {{ 'Anwani uliyofungua haipo au imehamishwa. Hakikisha kiungo ni sahihi, au rudi ulipotoka.' | t }}
        </p>
        <p class="mt-3 inline-block rounded bg-sunken px-2.5 py-1 font-mono text-xs break-all text-faint">{{ path }}</p>

        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="rounded border border-line px-4 py-2 text-sm hover:bg-sunken"
            (click)="back()"
          >
            ← {{ 'Rudi nyuma' | t }}
          </button>
          <a
            routerLink="/dashboard"
            class="rounded bg-brass-strong px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
          >
            {{ 'Nenda kwenye muhtasari' | t }}
          </a>
        </div>
      </div>
    </main>
  `,
})
export class NotFound {
  private readonly location = inject(Location);
  protected readonly path = this.location.path() || '/';

  constructor() {
    // During server rendering this makes the response a real 404 instead of 200.
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) {
      response.status = 404;
      response.statusText = 'Not Found';
    }
  }

  protected back(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      window.location.assign('/dashboard');
    }
  }
}
