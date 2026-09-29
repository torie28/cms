import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiField, ApiService, ApiServiceStatus, ApiSettingsService } from '../../../../../core/api-settings';
import { AuthService } from '../../../../../core/auth';
import { ConfirmService } from '../../../../../core/confirm';
import { httpErrorMessage } from '../../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../../core/i18n';

interface ServiceState {
  draft: Record<string, string>;
  revealed: ReadonlySet<string>;
  saving: boolean;
  error: string | null;
  notice: string | null;
  testTo: string;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
}

const STATUS: Record<ApiServiceStatus, { label: string; classes: string }> = {
  live: { label: 'Inatuma kweli', classes: 'border-positive/40 bg-positive/10 text-positive' },
  test: { label: 'Majaribio tu', classes: 'border-brass/40 bg-brass-tint text-brass-strong' },
  incomplete: { label: 'Haijakamilika', classes: 'border-negative/40 bg-negative/10 text-negative' },
};

@Component({
  selector: 'app-api-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './api-settings.html',
})
export class ApiSettings {
  private readonly api = inject(ApiSettingsService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly services = signal<ApiService[]>([]);
  protected readonly states = signal<Record<string, ServiceState>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected status(service: ApiService) {
    return STATUS[service.status];
  }

  protected state(service: ApiService): ServiceState {
    return this.states()[service.key] ?? this.freshState(service);
  }

  protected draftValue(service: ApiService, field: ApiField): string {
    return this.state(service).draft[field.key] ?? '';
  }

  protected isVisible(service: ApiService, field: ApiField): boolean {
    if (!field.show_when) {
      return true;
    }

    const current = this.state(service).draft[field.show_when.field] ?? '';
    const expected = field.show_when.value;
    return Array.isArray(expected) ? expected.includes(current) : current === expected;
  }

  protected isRevealed(service: ApiService, field: ApiField): boolean {
    return this.state(service).revealed.has(field.key);
  }

  protected isFieldDirty(service: ApiService, field: ApiField): boolean {
    return this.draftValue(service, field) !== this.initialValue(field);
  }

  protected isDirty(service: ApiService): boolean {
    return service.fields.some((field) => this.isFieldDirty(service, field));
  }

  protected setDraft(service: ApiService, field: ApiField, value: string): void {
    const state = this.state(service);
    this.patch(service, { draft: { ...state.draft, [field.key]: value }, notice: null, error: null });
  }

  protected toggleReveal(service: ApiService, field: ApiField): void {
    const revealed = new Set(this.state(service).revealed);
    if (revealed.has(field.key)) {
      revealed.delete(field.key);
    } else {
      revealed.add(field.key);
    }
    this.patch(service, { revealed });
  }

  protected discard(service: ApiService): void {
    this.patch(service, { draft: this.freshState(service).draft, error: null, notice: null });
  }

  protected async save(service: ApiService): Promise<void> {
    if (!this.isAdmin() || !this.isDirty(service) || this.state(service).saving) {
      return;
    }

    const values: Record<string, string | null> = {};
    for (const field of service.fields) {
      if (this.isFieldDirty(service, field)) {
        const value = this.draftValue(service, field).trim();
        values[field.key] = value === '' ? null : value;
      }
    }

    await this.submit(service, { values }, 'Mipangilio ya {label} imehifadhiwa.');
  }

  protected async resetToEnv(service: ApiService): Promise<void> {
    const reset = service.fields.filter((field) => field.source === 'database').map((field) => field.key);
    if (!this.isAdmin() || reset.length === 0) {
      return;
    }

    const confirmed = await this.confirm.ask({
      message: translate('Futa mipangilio ya {label} iliyohifadhiwa hapa na urudi kwenye ile ya faili la .env?', {
        label: translate(service.label),
      }),
      confirmLabel: 'Rudisha .env',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    await this.submit(service, { reset }, 'Mipangilio ya {label} imerudishwa kwenye .env.');
  }

  protected setTestTo(service: ApiService, value: string): void {
    this.patch(service, { testTo: value, testResult: null });
  }

  protected async sendTest(service: ApiService): Promise<void> {
    const state = this.state(service);
    const to = state.testTo.trim();
    if (!this.isAdmin() || !to || state.testing || this.isDirty(service)) {
      return;
    }

    this.patch(service, { testing: true, testResult: null });

    try {
      const result = await this.api.test(service.key, to);
      this.patch(service, { testResult: { ok: true, message: translate(result.message) } });
    } catch (error) {
      this.patch(service, {
        testResult: { ok: false, message: httpErrorMessage(error, 'Imeshindwa kutuma ujumbe wa majaribio.') },
      });
    } finally {
      this.patch(service, { testing: false });
    }
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const services = await this.api.list();
      this.services.set(services);
      this.states.set(Object.fromEntries(services.map((service) => [service.key, this.freshState(service)])));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia mipangilio ya API.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async submit(
    service: ApiService,
    changes: Parameters<ApiSettingsService['update']>[1],
    notice: string,
  ): Promise<void> {
    this.patch(service, { saving: true, error: null, notice: null });

    try {
      const updated = await this.api.update(service.key, changes);
      this.services.update((list) => list.map((item) => (item.key === updated.key ? updated : item)));
      const current = this.state(service);
      this.states.update((all) => ({
        ...all,
        [updated.key]: {
          ...this.freshState(updated),
          testTo: current.testTo,
          notice: translate(notice, { label: translate(updated.label) }),
        },
      }));
    } catch (error) {
      this.patch(service, {
        saving: false,
        error: httpErrorMessage(error, 'Imeshindwa kuhifadhi mipangilio.'),
      });
    }
  }

  private initialValue(field: ApiField): string {
    return field.type === 'secret' ? '' : String(field.value ?? '');
  }

  private freshState(service: ApiService): ServiceState {
    return {
      draft: Object.fromEntries(service.fields.map((field) => [field.key, this.initialValue(field)])),
      revealed: new Set(),
      saving: false,
      error: null,
      notice: null,
      testTo: '',
      testing: false,
      testResult: null,
    };
  }

  private patch(service: ApiService, changes: Partial<ServiceState>): void {
    this.states.update((all) => ({ ...all, [service.key]: { ...this.state(service), ...changes } }));
  }
}
