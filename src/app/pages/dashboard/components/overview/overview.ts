import { DatePipe } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth';
import { I18nService, translate, TranslatePipe } from '../../../../core/i18n';
import { MessagesService } from '../../../../core/messages';
import { Offering, OFFERING_CATEGORIES, OfferingService } from '../../../../core/offerings';
import { Jumuiya, Kanda, ParishService } from '../../../../core/parish';
import { UsersService } from '../../../../core/users';
import { FilterPanel } from '../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

const RESULT_LIMIT = 5;
const CHART_MONTHS = 6;

interface Metric {
  label: string;
  value: string;
  caption: string;
  link: string;
  change?: string;
  trend?: 'up' | 'down';
}

interface MonthBar {
  key: string;
  label: string;
  total: number;
  from: string;
  to: string;
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-overview',
  imports: [RouterLink, DatePipe, SearchBox, FilterPanel, TranslatePipe],
  templateUrl: './overview.html',
})
export class Overview {
  private readonly parish = inject(ParishService);
  private readonly offeringsApi = inject(OfferingService);
  private readonly usersApi = inject(UsersService);
  private readonly messagesApi = inject(MessagesService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly can = {
    sadaka: this.auth.canAccess('sadaka'),
    jumuiya: this.auth.canAccess('jumuiya'),
    kanda: this.auth.canAccess('kanda'),
    users: this.auth.canAccess('users'),
    notifications: this.auth.canAccess('notifications'),
  };

  private readonly jumuiyas = signal<Jumuiya[] | null>(null);
  protected readonly kandas = signal<Kanda[]>([]);
  private readonly offerings = signal<Offering[] | null>(null);
  private readonly userCount = signal<number | null>(null);
  private readonly unreadCount = signal<number | null>(null);

  protected readonly loading = computed(() => this.jumuiyas() === null);
  protected readonly offeringsLoading = computed(() => this.can.sadaka && this.offerings() === null);
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly search = signal('');
  protected readonly kandaFilter = signal(0);
  protected readonly showKandas = signal(true);
  protected readonly showJumuiyas = signal(true);

  private readonly now = new Date();
  private readonly today = isoDay(this.now);
  private readonly monthStart = isoDay(new Date(this.now.getFullYear(), this.now.getMonth(), 1));

  protected readonly activeFilters = computed(
    () =>
      (this.kandaFilter() ? 1 : 0) +
      [this.showKandas(), this.showJumuiyas()].filter((shown) => !shown).length,
  );

  protected readonly searchResults = computed(() => {
    const query = this.search();
    const kandaId = this.kandaFilter();

    if (!query.trim() && kandaId === 0) {
      return null;
    }

    const kandas =
      this.showKandas() && this.can.kanda
        ? this.kandas().filter(
            (kanda) =>
              (kandaId === 0 || kanda.id === kandaId) &&
              matchesSearch(query, [kanda.name, kanda.leader, kanda.notes]),
          )
        : [];
    const jumuiyas =
      this.showJumuiyas() && this.can.jumuiya
        ? (this.jumuiyas() ?? []).filter(
            (group) =>
              (kandaId === 0 || group.kanda_id === kandaId) &&
              matchesSearch(query, [group.name, group.kanda?.name, group.chairperson, group.notes]),
          )
        : [];

    return {
      kandas: kandas.slice(0, RESULT_LIMIT),
      jumuiyas: jumuiyas.slice(0, RESULT_LIMIT),
      kandaTotal: kandas.length,
      jumuiyaTotal: jumuiyas.length,
      total: kandas.length + jumuiyas.length,
    };
  });

  private readonly currency = computed(
    () =>
      new Intl.NumberFormat(this.i18n.intlLocale(), {
        style: 'currency',
        currency: 'TZS',
        maximumFractionDigits: 0,
      }),
  );

  private readonly monthOfferings = computed(() =>
    (this.offerings() ?? []).filter((item) => item.received_on >= this.monthStart),
  );

  protected readonly monthTotal = computed(() =>
    this.monthOfferings().reduce((sum, item) => sum + Number(item.amount), 0),
  );

  /** Last month up to the same day of the month, so a partial month is compared fairly. */
  private readonly lastMonthToDate = computed(() => {
    const start = isoDay(new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1));
    const lastDay = new Date(this.now.getFullYear(), this.now.getMonth(), 0).getDate();
    const end = isoDay(
      new Date(this.now.getFullYear(), this.now.getMonth() - 1, Math.min(this.now.getDate(), lastDay)),
    );

    return (this.offerings() ?? [])
      .filter((item) => item.received_on >= start && item.received_on <= end)
      .reduce((sum, item) => sum + Number(item.amount), 0);
  });

  protected readonly metrics = computed<Metric[]>(() => {
    const locale = this.i18n.intlLocale();
    const jumuiyas = this.jumuiyas();
    const cards: Metric[] = [];

    if (this.can.jumuiya) {
      cards.push({
        label: translate('Waumini hai'),
        value:
          jumuiyas?.reduce((total, group) => total + (group.members_count ?? 0), 0).toLocaleString(locale) ??
          '—',
        caption: translate('katika jumuiya zote'),
        link: '/jumuiya',
      });
    }

    if (this.can.sadaka) {
      const previous = this.lastMonthToDate();
      const change = previous > 0 ? ((this.monthTotal() - previous) / previous) * 100 : null;
      cards.push({
        label: translate('Sadaka'),
        value: this.offerings() === null ? '—' : this.money(this.monthTotal()),
        caption: translate('mwezi huu hadi leo'),
        link: '/sadaka',
        change: change === null ? undefined : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
        trend: change === null ? undefined : change >= 0 ? 'up' : 'down',
      });
    }

    if (this.can.jumuiya) {
      cards.push({
        label: translate('Jumuiya'),
        value: jumuiyas?.length.toString() ?? '—',
        caption: translate('jumuiya zilizosajiliwa'),
        link: '/jumuiya',
      });
    }

    if (this.can.kanda) {
      cards.push({
        label: translate('Kanda'),
        value: jumuiyas === null ? '—' : this.kandas().length.toString(),
        caption: translate('kanda za parokia'),
        link: '/kanda',
      });
    }

    if (this.can.users && this.userCount() !== null) {
      cards.push({
        label: translate('Watumiaji'),
        value: String(this.userCount()),
        caption: translate('akaunti za mfumo'),
        link: '/users',
      });
    }

    if (this.can.notifications && this.unreadCount() !== null) {
      cards.push({
        label: translate('Arifa mpya'),
        value: String(this.unreadCount()),
        caption: translate('hazijasomwa'),
        link: '/notifications',
      });
    }

    return cards;
  });

  protected readonly months = computed<MonthBar[]>(() => {
    const format = new Intl.DateTimeFormat(this.i18n.intlLocale(), { month: 'short' });
    const bars: MonthBar[] = [];

    for (let offset = CHART_MONTHS - 1; offset >= 0; offset--) {
      const start = new Date(this.now.getFullYear(), this.now.getMonth() - offset, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const key = isoDay(start).slice(0, 7);
      bars.push({
        key,
        label: format.format(start),
        from: isoDay(start),
        to: offset === 0 ? this.today : isoDay(end),
        total: (this.offerings() ?? [])
          .filter((item) => item.received_on.startsWith(key))
          .reduce((sum, item) => sum + Number(item.amount), 0),
      });
    }

    return bars;
  });

  protected readonly peakMonth = computed(() => Math.max(1, ...this.months().map((bar) => bar.total)));

  protected readonly monthByCategory = computed(() => {
    const total = this.monthTotal();

    return OFFERING_CATEGORIES.map((category) => {
      const sum = this.monthOfferings()
        .filter((item) => item.category === category.value)
        .reduce((acc, item) => acc + Number(item.amount), 0);
      return { ...category, total: sum, share: total > 0 ? (sum / total) * 100 : 0 };
    });
  });

  protected readonly recentOfferings = computed(() => (this.offerings() ?? []).slice(0, RESULT_LIMIT));

  protected readonly topJumuiyas = computed(() =>
    [...(this.jumuiyas() ?? [])]
      .sort((a, b) => (b.members_count ?? 0) - (a.members_count ?? 0))
      .slice(0, RESULT_LIMIT),
  );

  protected readonly topKandas = computed(() =>
    [...this.kandas()].sort((a, b) => b.jumuiyas_count - a.jumuiyas_count).slice(0, RESULT_LIMIT),
  );

  constructor() {
    afterNextRender(() => {
      void this.loadParish();
      if (this.can.sadaka) {
        void this.loadOfferings();
      }
      if (this.can.users) {
        void this.loadUsers();
      }
      if (this.can.notifications) {
        void this.loadInbox();
      }
    });
  }

  protected money(value: number | string): string {
    return this.currency().format(Number(value));
  }

  protected categoryLabel(value: string): string {
    return OFFERING_CATEGORIES.find((category) => category.value === value)?.label ?? value;
  }

  protected barHeight(total: number): number {
    return total > 0 ? Math.max(6, Math.round((total / this.peakMonth()) * 160)) : 2;
  }

  protected clearFilters(): void {
    this.kandaFilter.set(0);
    this.showKandas.set(true);
    this.showJumuiyas.set(true);
  }

  protected setKandaFilter(value: string): void {
    this.kandaFilter.set(Number(value) || 0);
  }

  private async loadParish(): Promise<void> {
    try {
      const [jumuiyas, kandas] = await Promise.all([
        this.parish.listJumuiyas(),
        this.parish.listKandas(),
      ]);
      this.kandas.set(kandas);
      this.jumuiyas.set(jumuiyas);
    } catch {
      this.jumuiyas.set([]);
    }
  }

  private async loadOfferings(): Promise<void> {
    const from = isoDay(new Date(this.now.getFullYear(), this.now.getMonth() - (CHART_MONTHS - 1), 1));

    try {
      this.offerings.set(await this.offeringsApi.list({ from, to: this.today }));
    } catch {
      this.offerings.set([]);
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      this.userCount.set((await this.usersApi.list()).length);
    } catch {
      // The card is simply left out.
    }
  }

  private async loadInbox(): Promise<void> {
    try {
      this.unreadCount.set((await this.messagesApi.inbox()).unread);
    } catch {
      // The card is simply left out.
    }
  }
}
