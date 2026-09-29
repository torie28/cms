import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n';
import { APP_NAV } from '../../layout/nav';
import { SETTINGS_SECTIONS } from '../dashboard/components/settings/settings.sections';

/** Label of the module behind the guarded route, e.g. "Sadaka" or "Kumbukumbu za shughuli". */
function moduleLabel(keys: string[]): string | null {
  if (keys.length === 1) {
    const section = SETTINGS_SECTIONS.find((s) => s.module === keys[0]);
    if (section) {
      return section.label;
    }
  }

  const item = APP_NAV.find((nav) => nav.module && [nav.module].flat().some((k) => keys.includes(k)));
  return item?.label ?? null;
}

@Component({
  selector: 'app-forbidden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="flex min-h-[70vh] items-center justify-center py-10" aria-labelledby="forbidden-title">
      <div class="alert-in w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <div class="mx-auto mb-6 w-[312px] max-w-full overflow-hidden rounded-xl border border-line">
          <img
            src="no-access.gif"
            alt=""
            width="416"
            height="256"
            class="block h-auto w-full [image-rendering:pixelated]"
            aria-hidden="true"
          />
        </div>

        <p class="text-xs font-medium tracking-[0.2em] text-negative uppercase">403</p>
        <h1 id="forbidden-title" class="mt-1 font-serif text-2xl text-ink">{{ 'Huna ruhusa' | t }}</h1>

        <p class="mx-auto mt-3 max-w-sm text-sm text-muted">
          @if (module(); as label) {
            {{ 'Nafasi yako haina ruhusa ya kufungua moduli ya {module}.' | t: { module: (label | t) } }}
          } @else {
            {{ 'Nafasi yako haina ruhusa ya kufungua ukurasa huu.' | t }}
          }
          {{ 'Ikiwa unahitaji kuitumia, wasiliana na msimamizi wa mfumo akupe ruhusa.' | t }}
        </p>

        <dl class="mx-auto mt-5 grid max-w-sm gap-2 rounded-lg bg-sunken p-3 text-left text-xs">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-faint">{{ 'Ukurasa' | t }}</dt>
            <dd class="truncate font-mono text-muted" [title]="path()">{{ path() }}</dd>
          </div>
          @if (role(); as role) {
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-faint">{{ 'Nafasi yako' | t }}</dt>
              <dd class="font-medium text-ink">{{ role }}</dd>
            </div>
          }
        </dl>

        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-brass"
            (click)="back()"
          >
            ← {{ 'Rudi nyuma' | t }}
          </button>
          <a
            routerLink="/dashboard"
            class="rounded-full bg-brass-strong px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
          >
            {{ 'Nenda kwenye muhtasari' | t }}
          </a>
        </div>
      </div>
    </section>
  `,
})
export class Forbidden {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  /** The guard keeps the requested address in the bar, so this is the page that was refused. */
  protected readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.location.path() || '/'),
    ),
    { initialValue: this.location.path() || '/' },
  );

  protected readonly module = computed(() => {
    const keys = (this.params().get('module') ?? '').split(',').filter(Boolean);
    return keys.length ? moduleLabel(keys) : null;
  });

  protected readonly role = computed(() => {
    const user = this.auth.user();
    return user?.role_label || user?.role || null;
  });

  protected back(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/dashboard');
    }
  }
}
