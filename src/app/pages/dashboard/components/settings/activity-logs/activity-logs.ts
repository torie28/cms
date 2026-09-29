import { DatePipe, formatDate } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { ActivityEntry, ActivityService, isDeletion, isPendingDeletion } from '../../../../../core/activity';
import { AuthService } from '../../../../../core/auth';
import { ConfirmService } from '../../../../../core/confirm';
import { httpErrorMessage } from '../../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../../core/i18n';
import { FilterPanel, withinDateRange } from '../../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../../shared/search-box';

const ACTION_LABELS: Record<string, string> = {
  'logged in': 'Aliingia',
  'logged out': 'Alitoka',
  created: 'Aliongeza',
  updated: 'Alihariri',
  deleted: 'Alifuta',
  imported: 'Aliingiza (Excel)',
  exported: 'Alipakua',
  restored: 'Alirejesha',
  purged: 'Alifuta kabisa',
  enabled: 'Aliwasha',
  disabled: 'Alizima',
  sent: 'Alituma ujumbe',
};

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  user: 'Mtumiaji',
  role: 'Wadhifa',
  jumuiya: 'Jumuiya',
  jumuiya_member: 'Mwanajumuiya',
  kanda: 'Kanda',
  offering: 'Sadaka na michango',
  module: 'Moduli',
  message: 'Ujumbe',
  session: 'Kuingia/kutoka',
};

type LogView = 'all' | 'deleted';

export const RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

export type DeletionStatus = 'pending' | 'restored' | 'purged' | 'expired';

const LIVE_INTERVAL_MS = 5000;
const FRESH_HIGHLIGHT_MS = 6000;
const MAX_ENTRIES = 500;

@Component({
  selector: 'app-activity-logs',
  imports: [DatePipe, SearchBox, FilterPanel, TranslatePipe],
  templateUrl: './activity-logs.html',
})
export class ActivityLogs {
  private readonly activity = inject(ActivityService);
  private readonly locale = inject(LOCALE_ID);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  private polling = false;

  protected readonly isAdmin = inject(AuthService).isAdmin;
  protected readonly retentionDays = RETENTION_DAYS;
  protected readonly pendingCount = computed(
    () => this.deletedLogs().filter((entry) => isPendingDeletion(entry, this.now())).length,
  );
  protected readonly view = signal<LogView>('all');
  protected readonly deletedLogs = signal<ActivityEntry[]>([]);
  protected readonly selected = signal<ActivityEntry | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly logs = signal<ActivityEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly live = signal(true);
  protected readonly lastSync = signal<number | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly freshIds = signal<ReadonlySet<number>>(new Set());

  protected readonly search = signal('');
  protected readonly actionFilter = signal('');
  protected readonly actorFilter = signal('');
  protected readonly typeFilter = signal('');
  protected readonly statusFilter = signal<DeletionStatus | ''>('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly oldestFirst = signal(false);

  private readonly source = computed(() => (this.view() === 'deleted' ? this.deletedLogs() : this.logs()));

  protected readonly actions = computed(() => this.distinct((entry) => entry.action));
  protected readonly actors = computed(() => this.distinct((entry) => entry.actor));
  protected readonly types = computed(() => this.distinct((entry) => entry.subject_type));

  protected readonly datePresets = [
    { days: 0, label: 'Leo' },
    { days: 6, label: 'Siku {days}' },
    { days: 29, label: 'Siku {days}' },
  ];

  protected readonly statusOptions: { value: DeletionStatus | ''; label: string }[] = [
    { value: '', label: 'Zote' },
    { value: 'pending', label: 'Zinazoweza kurejeshwa' },
    { value: 'restored', label: 'Zilizorejeshwa' },
    { value: 'purged', label: 'Zilizofutwa kabisa' },
    { value: 'expired', label: 'Muda umepita' },
  ];

  protected readonly statusCounts = computed(() => {
    const counts: Record<string, number> = { '': this.deletedLogs().length };
    for (const entry of this.deletedLogs()) {
      const status = this.deletionStatus(entry) ?? '';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  });
  protected readonly latest = computed(() => this.logs()[0] ?? null);

  protected readonly activeFilters = computed(
    () =>
      [
        this.actionFilter(),
        this.actorFilter(),
        this.typeFilter(),
        this.statusFilter(),
        this.dateFrom(),
        this.dateTo(),
      ].filter(Boolean).length + (this.oldestFirst() ? 1 : 0),
  );

  protected readonly filteredLogs = computed(() => {
    const action = this.actionFilter();
    const actor = this.actorFilter();
    const type = this.typeFilter();
    const status = this.view() === 'deleted' ? this.statusFilter() : '';
    const rows = this.source().filter(
      (entry) =>
        (action === '' || entry.action === action) &&
        (actor === '' || entry.actor === actor) &&
        (type === '' || entry.subject_type === type) &&
        (status === '' || this.deletionStatus(entry) === status) &&
        withinDateRange(this.localDay(entry.created_at), this.dateFrom(), this.dateTo()) &&
        matchesSearch(this.search(), [
          entry.actor,
          entry.action,
          this.actionLabel(entry.action),
          this.subjectLabel(entry.subject),
          this.typeLabel(entry.subject_type),
          entry.ip_address,
          entry.created_at,
          formatDate(entry.created_at, 'd MMM y, HH:mm:ss', this.i18n.dateLocale()),
        ]),
    );

    return rows.sort((a, b) => (this.oldestFirst() ? a.id - b.id : b.id - a.id));
  });

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('{shown} kati ya {total}', { shown: this.filteredLogs().length, total: this.source().length })
      : '',
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      void this.refresh();

      const timer = setInterval(() => {
        this.now.set(Date.now());
        if (this.live() && document.visibilityState === 'visible') {
          void this.poll();
        }
      }, LIVE_INTERVAL_MS);

      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  protected toggleLive(): void {
    this.live.update((live) => !live);
    if (this.live()) {
      void this.poll();
    }
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [logs, deleted] = await Promise.all([this.activity.list(), this.activity.listDeleted()]);
      this.logs.set(logs);
      this.deletedLogs.set(deleted);
      this.lastSync.set(Date.now());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kumbukumbu za shughuli.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.actionFilter.set('');
    this.actorFilter.set('');
    this.typeFilter.set('');
    this.statusFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.oldestFirst.set(false);
  }

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ? translate(ACTION_LABELS[action]) : action;
  }

  protected subjectLabel(subject: string): string {
    return subject === 'the system' ? translate('mfumo') : subject;
  }

  protected typeLabel(type: string | null): string {
    if (!type) {
      return '';
    }
    return SUBJECT_TYPE_LABELS[type] ? translate(SUBJECT_TYPE_LABELS[type]) : type.replaceAll('_', ' ');
  }

  protected isPendingDeletion(entry: ActivityEntry): boolean {
    return isPendingDeletion(entry, this.now());
  }

  protected deletionStatus(entry: ActivityEntry): DeletionStatus | null {
    if (!isDeletion(entry)) {
      return null;
    }
    if (entry.restored_at) {
      return 'restored';
    }
    if (entry.purged_at) {
      return 'purged';
    }
    return this.isPendingDeletion(entry) ? 'pending' : 'expired';
  }

  /** Whole days left to restore, rounded up so "less than a day" still reads as 1. */
  protected daysLeft(entry: ActivityEntry): number {
    const deadline = entry.restore_deadline ? new Date(entry.restore_deadline).getTime() : 0;
    return Math.max(0, Math.ceil((deadline - this.now()) / DAY_MS));
  }

  /** Shared by the table and the details popup so both say the same thing. */
  protected statusText(entry: ActivityEntry): string {
    switch (this.deletionStatus(entry)) {
      case 'pending': {
        const days = this.daysLeft(entry);
        return days === 1
          ? translate('Siku 1 imebaki kurejesha')
          : translate('Siku {days} zimebaki kurejesha', { days });
      }
      case 'restored':
        return translate('Kimerejeshwa na {name}', { name: entry.restored_by });
      case 'purged':
        return entry.purged_by?.startsWith('Mfumo')
          ? translate('Kimefutwa kabisa baada ya siku {days} · kinaangaliwa tu', { days: RETENTION_DAYS })
          : translate('Kimefutwa kabisa na {name} · kinaangaliwa tu', { name: entry.purged_by });
      case 'expired':
        return translate('Siku {days} zimepita · kinaangaliwa tu', { days: RETENTION_DAYS });
      default:
        return '';
    }
  }

  protected hasDetails(entry: ActivityEntry): boolean {
    return !!(entry.details?.snapshot || entry.details?.changes);
  }

  protected entries(record: Record<string, unknown> | undefined): { key: string; value: unknown }[] {
    return Object.entries(record ?? {}).map(([key, value]) => ({ key, value }));
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  /** Sets the date range to the last `days` days, today included (0 = today only). */
  protected setDatePreset(days: number): void {
    const today = new Date();
    const from = new Date(today.getTime() - days * DAY_MS);
    this.dateFrom.set(formatDate(from, 'yyyy-MM-dd', this.locale));
    this.dateTo.set(formatDate(today, 'yyyy-MM-dd', this.locale));
  }

  protected isDatePreset(days: number): boolean {
    const today = new Date();
    return (
      this.dateTo() === formatDate(today, 'yyyy-MM-dd', this.locale) &&
      this.dateFrom() === formatDate(new Date(today.getTime() - days * DAY_MS), 'yyyy-MM-dd', this.locale)
    );
  }

  protected setView(view: LogView): void {
    this.view.set(view);
    this.clearFilters();
  }

  protected openDetails(entry: ActivityEntry): void {
    this.selected.set(entry);
  }

  protected closeDetails(): void {
    if (this.busyId() === null) {
      this.selected.set(null);
    }
  }

  protected async restore(entry: ActivityEntry): Promise<void> {
    const question = translate('Rejesha {type} "{subject}"?', {
      type: this.typeLabel(entry.subject_type).toLowerCase(),
      subject: entry.subject,
    });
    if (!(await this.confirm.ask({ message: question, confirmLabel: 'Rejesha' }))) {
      return;
    }

    await this.resolveDeletion(entry, () => this.activity.restore(entry.id), '"{subject}" kimerejeshwa.');
  }

  protected async purge(entry: ActivityEntry): Promise<void> {
    const question = translate(
      'Futa kabisa "{subject}"? Hatua hii haiwezi kutenduliwa, ingawa maelezo yake yatabaki kwenye kumbukumbu.',
      { subject: entry.subject },
    );
    if (!(await this.confirm.ask({ message: question, confirmLabel: 'Futa kabisa', tone: 'danger' }))) {
      return;
    }

    await this.resolveDeletion(entry, () => this.activity.purge(entry.id), '"{subject}" kimefutwa kabisa.');
  }

  /** `outcome` is a translation key with a `{subject}` placeholder. */
  private async resolveDeletion(
    entry: ActivityEntry,
    action: () => Promise<ActivityEntry>,
    outcome: string,
  ): Promise<void> {
    this.busyId.set(entry.id);
    this.error.set(null);
    this.notice.set(null);

    try {
      const updated = { ...entry, ...(await action()) };
      this.logs.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      this.deletedLogs.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      if (this.selected()?.id === updated.id) {
        this.selected.set(updated);
      }
      this.notice.set(translate(outcome, { subject: entry.subject }));
      void this.poll();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kukamilisha kitendo hicho.'));
    } finally {
      this.busyId.set(null);
    }
  }

  protected timeAgo(timestamp: string | number): string {
    const seconds = Math.max(0, Math.round((this.now() - new Date(timestamp).getTime()) / 1000));

    if (seconds < 10) {
      return translate('sasa hivi');
    }
    if (seconds < 60) {
      return translate('sekunde {n} zilizopita', { n: seconds });
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return minutes === 1 ? translate('dakika 1 iliyopita') : translate('dakika {n} zilizopita', { n: minutes });
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return hours === 1 ? translate('saa 1 iliyopita') : translate('saa {n} zilizopita', { n: hours });
    }

    const days = Math.floor(seconds / 86400);
    return days === 1 ? translate('jana') : translate('siku {n} zilizopita', { n: days });
  }

  private async poll(): Promise<void> {
    if (this.polling || this.loading()) {
      return;
    }

    this.polling = true;

    try {
      const latestId = this.logs().reduce((max, entry) => Math.max(max, entry.id), 0);
      const incoming = await this.activity.list(latestId || undefined);
      this.lastSync.set(Date.now());
      this.error.set(null);

      const known = new Set(this.logs().map((entry) => entry.id));
      const fresh = incoming.filter((entry) => !known.has(entry.id));

      if (fresh.length === 0) {
        return;
      }

      this.logs.update((current) =>
        [...fresh, ...current].sort((a, b) => b.id - a.id).slice(0, MAX_ENTRIES),
      );

      const newDeletions = fresh.filter(isDeletion);
      if (newDeletions.length) {
        this.deletedLogs.update((current) => [...newDeletions, ...current]);
      }

      const ids = fresh.map((entry) => entry.id);
      this.freshIds.update((current) => new Set([...current, ...ids]));
      setTimeout(() => {
        this.freshIds.update((current) => new Set([...current].filter((id) => !ids.includes(id))));
      }, FRESH_HIGHLIGHT_MS);
    } catch {
      // Transient network errors shouldn't interrupt the feed; the next tick retries.
    } finally {
      this.polling = false;
    }
  }

  private distinct(pick: (entry: ActivityEntry) => string | null): string[] {
    return [...new Set(this.source().map(pick).filter((value): value is string => !!value))].sort();
  }

  /** Date pickers work in the viewer's calendar, so compare against the local day, not UTC. */
  private localDay(timestamp: string): string {
    return formatDate(timestamp, 'yyyy-MM-dd', this.locale);
  }
}
