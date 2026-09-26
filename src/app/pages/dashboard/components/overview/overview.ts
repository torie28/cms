import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { ParishService } from '../../../../core/parish';

interface Metric {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'flat';
  caption: string;
}

interface AttendanceBar {
  label: string;
  value: number;
}

interface ChurchEvent {
  title: string;
  when: string;
  location: string;
  lead: string;
}

@Component({
  selector: 'app-overview',
  templateUrl: './overview.html',
})
export class Overview {
  private readonly parish = inject(ParishService);

  private readonly memberCount = signal<number | null>(null);
  private readonly jumuiyaCount = signal<number | null>(null);
  private readonly kandaCount = signal<number | null>(null);

  protected readonly loading = computed(() => this.memberCount() === null);

  constructor() {
    afterNextRender(() => {
      void this.loadParishCounts();
    });
  }

  protected readonly metrics = computed<Metric[]>(() => [
    {
      label: 'Waumini hai',
      value: this.memberCount()?.toLocaleString('sw-TZ') ?? '—',
      change: '',
      trend: 'flat',
      caption: 'katika jumuiya zote',
    },
    {
      label: 'Sadaka',
      value: 'TSh 486,200',
      change: '-2.3%',
      trend: 'down',
      caption: 'mwezi huu hadi leo',
    },
    {
      label: 'Jumuiya',
      value: this.jumuiyaCount()?.toString() ?? '—',
      change: '',
      trend: 'flat',
      caption: 'jumuiya zilizosajiliwa',
    },
    {
      label: 'Kanda',
      value: this.kandaCount()?.toString() ?? '—',
      change: '',
      trend: 'flat',
      caption: 'kanda za parokia',
    },
  ]);

  protected readonly attendance: AttendanceBar[] = [
    { label: 'Jul 06', value: 742 },
    { label: 'Jul 13', value: 688 },
    { label: 'Jul 20', value: 795 },
    { label: 'Jul 27', value: 810 },
    { label: 'Ago 03', value: 768 },
    { label: 'Ago 10', value: 828 },
    { label: 'Ago 17', value: 862 },
  ];

  protected readonly peakAttendance = computed(() =>
    Math.max(...this.attendance.map((week) => week.value)),
  );

  protected readonly events: ChurchEvent[] = [
    {
      title: 'Ibada ya Jumapili',
      when: 'Jumapili · Saa 3:00 asubuhi',
      location: 'Kanisa kuu',
      lead: 'Padre Daniel Mwangi',
    },
    {
      title: 'Mafundisho ya Biblia kwa Vijana',
      when: 'Jumatano · Saa 11:30 jioni',
      location: 'Ukumbi wa ushirika',
      lead: 'Sarah Njeri',
    },
    {
      title: 'Mazoezi ya Kwaya',
      when: 'Alhamisi · Saa 12:00 jioni',
      location: 'Chumba cha muziki',
      lead: 'Peter Otieno',
    },
    {
      title: 'Darasa la Ubatizo',
      when: 'Jumamosi · Saa 4:00 asubuhi',
      location: 'Kanisa dogo',
      lead: 'Shemasi Mary Wanjiru',
    },
  ];

  protected barHeight(value: number): number {
    const floor = 0.55;
    const ratio = floor + (1 - floor) * (value / this.peakAttendance());
    return Math.round(ratio * 160);
  }

  private async loadParishCounts(): Promise<void> {
    try {
      const [jumuiyas, kandas] = await Promise.all([
        this.parish.listJumuiyas(),
        this.parish.listKandas(),
      ]);
      this.memberCount.set(
        jumuiyas.reduce((total, group) => total + (group.members_count ?? 0), 0),
      );
      this.jumuiyaCount.set(jumuiyas.length);
      this.kandaCount.set(kandas.length);
    } catch {
      this.memberCount.set(0);
      this.jumuiyaCount.set(0);
      this.kandaCount.set(0);
    }
  }
}
