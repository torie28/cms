import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../../core/auth';
import { httpErrorMessage } from '../../../../../core/http-error';
import { translate, TranslatePipe } from '../../../../../core/i18n';
import { AppModule, ModulesService } from '../../../../../core/modules';

@Component({
  selector: 'app-system-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './system-settings.html',
})
export class SystemSettings {
  private readonly modulesApi = inject(ModulesService);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly modules = signal<AppModule[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<ReadonlySet<number>>(new Set());

  protected readonly enabledCount = computed(() => this.modules().filter((module) => module.enabled).length);

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected isPending(module: AppModule): boolean {
    return this.pending().has(module.id);
  }

  protected async toggle(module: AppModule): Promise<void> {
    if (!this.isAdmin() || module.is_core || this.isPending(module)) {
      return;
    }

    const enabled = !module.enabled;
    this.pending.update((ids) => new Set([...ids, module.id]));
    this.error.set(null);
    this.replace({ ...module, enabled });

    try {
      this.replace(await this.modulesApi.update(module.id, { enabled }));
      void this.auth.refresh();
    } catch (error) {
      this.replace(module);
      this.error.set(
        httpErrorMessage(
          error,
          translate('Imeshindwa kubadilisha moduli ya {label}.', { label: translate(module.label) }),
        ),
      );
    } finally {
      this.pending.update((ids) => new Set([...ids].filter((id) => id !== module.id)));
    }
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.modules.set(await this.modulesApi.list());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia moduli.'));
    } finally {
      this.loading.set(false);
    }
  }

  private replace(updated: AppModule): void {
    this.modules.update((list) => list.map((module) => (module.id === updated.id ? updated : module)));
  }
}
