import { DatePipe } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DeletionRequest,
  DeletionRequestStatus,
  DeletionRequestsService,
} from '../../../../../core/deletion-requests';
import { httpErrorMessage } from '../../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../../core/i18n';

const STATUS_LABELS: Record<DeletionRequestStatus, string> = {
  pending: 'Linasubiri',
  approved: 'Limeidhinishwa',
  rejected: 'Limekataliwa',
  cancelled: 'Limeghairiwa',
};

const TYPE_LABELS: Record<string, string> = {
  kanda: 'Kanda',
  jumuiya: 'Jumuiya',
  jumuiya_member: 'Mwanajumuiya',
  user: 'Mtumiaji',
  role: 'Wadhifa',
  offering: 'Sadaka/mchango',
  activity_log: 'Futa kabisa (kumbukumbu)',
};

@Component({
  selector: 'app-deletion-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './deletion-requests.html',
})
export class DeletionRequestsSettings {
  private readonly api = inject(DeletionRequestsService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<DeletionRequestStatus | 'all'>('pending');
  protected readonly items = signal<DeletionRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly noteDraft = signal('');

  protected readonly statusOptions: { value: DeletionRequestStatus | 'all'; label: string }[] = [
    { value: 'pending', label: 'Yanayosubiri' },
    { value: 'approved', label: 'Yaliyoidhinishwa' },
    { value: 'rejected', label: 'Yaliyokataliwa' },
    { value: 'all', label: 'Yote' },
  ];

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected statusLabel(status: DeletionRequestStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  protected async setStatus(value: DeletionRequestStatus | 'all'): Promise<void> {
    this.status.set(value);
    await this.refresh();
  }

  protected async approve(item: DeletionRequest): Promise<void> {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(item.id);
    this.error.set(null);
    try {
      await this.api.approve(item.id, this.noteDraft().trim() || undefined);
      this.notice.set(
        translate('{name} imefutwa baada ya idhini. Ombi limekamilika hata kama mwombaji hayupo.', {
          name: item.subject_label,
        }),
      );
      this.noteDraft.set('');
      await this.refresh();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuidhinisha ombi hilo.'));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async reject(item: DeletionRequest): Promise<void> {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(item.id);
    this.error.set(null);
    try {
      await this.api.reject(item.id, this.noteDraft().trim() || undefined);
      this.notice.set(translate('Ombi la kufuta {name} limekataliwa.', { name: item.subject_label }));
      this.noteDraft.set('');
      await this.refresh();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kukataa ombi hilo.'));
    } finally {
      this.busyId.set(null);
    }
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.api.list(this.status()));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia maombi ya kufuta.'));
    } finally {
      this.loading.set(false);
    }
  }
}
