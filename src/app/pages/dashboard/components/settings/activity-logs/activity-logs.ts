import { DatePipe } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { ActivityEntry, ActivityService } from '../../../../../core/activity';
import { httpErrorMessage } from '../../../../../core/http-error';

const ACTION_LABELS: Record<string, string> = {
  'logged in': 'Aliingia',
  'logged out': 'Alitoka',
  created: 'Aliongeza',
  updated: 'Alihariri',
  deleted: 'Alifuta',
};

const TYPE_LABELS: Record<string, string> = {
  session: 'Kikao',
  user: 'Mtumiaji',
  kanda: 'Kanda',
  jumuiya: 'Jumuiya',
  jumuiya_member: 'Mwanajumuiya',
};

@Component({
  selector: 'app-activity-logs',
  imports: [DatePipe],
  templateUrl: './activity-logs.html',
})
export class ActivityLogs {
  private readonly activity = inject(ActivityService);

  protected readonly logs = signal<ActivityEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type.replaceAll('_', ' ');
  }

  protected subjectLabel(subject: string): string {
    return subject === 'the system' ? 'mfumo' : subject;
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.logs.set(await this.activity.list());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kumbukumbu za shughuli.'));
    } finally {
      this.loading.set(false);
    }
  }
}
