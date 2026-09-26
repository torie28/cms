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

  private readonly jumuiyaCount = signal<number | null>(null);
  private readonly kandaCount = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      void this.loadParishCounts();
    });
  }

  protected readonly metrics = computed<Metric[]>(() => [
    {
      label: 'Active members',
      value: '1,284',
      change: '+32',
      trend: 'up',
      caption: 'new registrations this month',
    },
    {
      label: 'Sadaka',
      value: 'TSh 486,200',
      change: '-2.3%',
      trend: 'down',
      caption: 'month to date',
    },
    {
      label: 'Jumuiya',
      value: this.jumuiyaCount()?.toString() ?? '—',
      change: '',
      trend: 'flat',
      caption: 'registered communities',
    },
    {
      label: 'Kanda',
      value: this.kandaCount()?.toString() ?? '—',
      change: '',
      trend: 'flat',
      caption: 'parish zones',
    },
  ]);

  protected readonly attendance: AttendanceBar[] = [
    { label: 'Jul 06', value: 742 },
    { label: 'Jul 13', value: 688 },
    { label: 'Jul 20', value: 795 },
    { label: 'Jul 27', value: 810 },
    { label: 'Aug 03', value: 768 },
    { label: 'Aug 10', value: 828 },
    { label: 'Aug 17', value: 862 },
  ];

  protected readonly peakAttendance = computed(() =>
    Math.max(...this.attendance.map((week) => week.value)),
  );

  protected readonly events: ChurchEvent[] = [
    {
      title: 'Sunday Worship Service',
      when: 'Sunday · 9:00 AM',
      location: 'Main Sanctuary',
      lead: 'Rev. Daniel Mwangi',
    },
    {
      title: 'Youth Bible Study',
      when: 'Wednesday · 5:30 PM',
      location: 'Fellowship Hall',
      lead: 'Sarah Njeri',
    },
    {
      title: 'Choir Rehearsal',
      when: 'Thursday · 6:00 PM',
      location: 'Music Room',
      lead: 'Peter Otieno',
    },
    {
      title: 'Baptism Class',
      when: 'Saturday · 10:00 AM',
      location: 'Chapel Annex',
      lead: 'Deacon Mary Wanjiru',
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
      this.jumuiyaCount.set(jumuiyas.length);
      this.kandaCount.set(kandas.length);
    } catch {
      this.jumuiyaCount.set(0);
      this.kandaCount.set(0);
    }
  }
}
