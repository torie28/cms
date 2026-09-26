import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Icon, IconName } from '../../shared/icon';
import { ThemeToggle } from '../../shared/theme-toggle';

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

interface ActivityEntry {
  actor: string;
  action: string;
  target: string;
  at: string;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ThemeToggle],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly sidebarOpen = signal(false);

  protected readonly today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  protected readonly navigation: { label: string; icon: IconName; active: boolean }[] = [
    { label: 'Overview', icon: 'grid', active: true },
    { label: 'Members', icon: 'users', active: false },
    { label: 'Attendance', icon: 'check', active: false },
    { label: 'Giving', icon: 'coin', active: false },
    { label: 'Events', icon: 'calendar', active: false },
    { label: 'Ministries', icon: 'heart', active: false },
    { label: 'Sermons', icon: 'book', active: false },
    { label: 'Settings', icon: 'gear', active: false },
  ];

  protected readonly metrics: Metric[] = [
    {
      label: 'Active members',
      value: '1,284',
      change: '+32',
      trend: 'up',
      caption: 'new registrations this month',
    },
    {
      label: 'Sunday attendance',
      value: '862',
      change: '+4.1%',
      trend: 'up',
      caption: 'compared with last Sunday',
    },
    {
      label: 'Tithes & offerings',
      value: 'KSh 486,200',
      change: '-2.3%',
      trend: 'down',
      caption: 'month to date',
    },
    {
      label: 'Small groups',
      value: '37',
      change: '+2',
      trend: 'up',
      caption: 'meeting weekly',
    },
  ];

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

  protected readonly activity: ActivityEntry[] = [
    { actor: 'Sarah Njeri', action: 'registered', target: '3 new members', at: '18 minutes ago' },
    { actor: 'Finance office', action: 'recorded', target: 'Sunday offering', at: '2 hours ago' },
    { actor: 'Peter Otieno', action: 'scheduled', target: 'Choir rehearsal', at: 'Yesterday' },
    { actor: 'Deacon Mary', action: 'updated', target: 'Baptism roster', at: 'Yesterday' },
    { actor: 'Rev. Daniel', action: 'published', target: 'Sermon notes', at: '2 days ago' },
  ];

  protected readonly initials = computed(() => {
    const name = this.user()?.name ?? 'Guest';
    return name
      .replace(/^(Rev\.|Pastor|Deacon)\s+/i, '')
      .split(' ')
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  /** Bars are sized in pixels so they do not depend on a resolved parent height. */
  protected barHeight(value: number): number {
    const floor = 0.55;
    const ratio = floor + (1 - floor) * (value / this.peakAttendance());
    return Math.round(ratio * 160);
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected signOut(): void {
    void this.auth.signOut().then(() => this.router.navigate(['/login']));
  }
}
