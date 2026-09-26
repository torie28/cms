import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface ActivityEntry {
  id: number;
  actor: string;
  action: string;
  subject: string;
  subject_type: string | null;
  ip_address: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

  list(): Promise<ActivityEntry[]> {
    return firstValueFrom(this.http.get<ActivityEntry[]>(`${API_BASE}/activity-logs`));
  }
}
