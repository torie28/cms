import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/i18n';
import { Icon } from '../../../../shared/icon';

@Component({
  selector: 'app-matukio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, TranslatePipe],
  template: `
    <main class="flex-1 space-y-6 p-5 lg:p-7">
      <div>
        <h1 class="font-serif text-2xl">{{ 'Matukio' | t }}</h1>
        <p class="mt-1 text-sm text-muted">{{ 'Matukio na ratiba za parokia.' | t }}</p>
      </div>

      <section
        class="flex min-h-[55vh] items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface p-8"
        aria-labelledby="matukio-soon"
      >
        <div class="max-w-md text-center">
          <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brass-tint text-brass-strong">
            <app-icon name="calendar" class="h-7 w-7" />
          </span>
          <p class="mt-5 text-xs font-medium tracking-[0.25em] text-brass-strong uppercase">{{ 'Inakuja hivi karibuni' | t }}</p>
          <h2 id="matukio-soon" class="mt-2 font-serif text-xl">{{ 'Moduli ya matukio inaandaliwa' | t }}</h2>
          <p class="mt-3 text-sm leading-relaxed text-muted">
            {{ 'Hivi karibuni utaweza kupanga matukio ya parokia, kama misa maalum, mikutano na sherehe, na kuwatumia waumini taarifa zake.' | t }}
          </p>
          <a
            routerLink="/dashboard"
            class="mt-6 inline-block rounded-full bg-brass-strong px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
          >
            {{ 'Nenda kwenye muhtasari' | t }}
          </a>
        </div>
      </section>
    </main>
  `,
})
export class Matukio {}
