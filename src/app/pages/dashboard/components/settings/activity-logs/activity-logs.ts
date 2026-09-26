import { DatePipe, TitleCasePipe } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { ActivityEntry, ActivityService } from '../../../../../core/activity';
import { httpErrorMessage } from '../../../../../core/http-error';

@Component({
  selector: 'app-activity-logs',
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './activity-logs.html',
})
export class ActivityLogs {
  private readonly activity = inject(ActivityService);

  protected readonly logs = signal<ActivityEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.logs.set(await this.activity.list());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Unable to load activity logs.'));
    } finally {
      this.loading.set(false);
    }
  }
}
