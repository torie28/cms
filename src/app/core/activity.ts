import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export interface ActivityDetails {
  /** What a deleted record looked like at the moment it was deleted. */
  snapshot?: Record<string, unknown>;
  /** Field-by-field edits: label => { from, to }. */
  changes?: Record<string, FieldChange>;
  restored_from_log?: number;
  purged_from_log?: number;
}

export interface ActivityEntry {
  id: number;
  actor: string;
  action: string;
  subject: string;
  subject_type: string | null;
  subject_id: number | null;
  details: ActivityDetails | null;
  ip_address: string | null;
  created_at: string;
  restored_at: string | null;
  restored_by: string | null;
  purged_at: string | null;
  purged_by: string | null;
  /** Deletions only: after this moment the record is removed for good and can only be viewed. */
  restore_deadline: string | null;
}

export function isDeletion(entry: ActivityEntry): boolean {
  return entry.action === 'deleted' && entry.subject_id !== null;
}

/** A deletion still inside its restore window that nobody has acted on yet. */
export function isPendingDeletion(entry: ActivityEntry, now = Date.now()): boolean {
  return (
    isDeletion(entry) &&
    !entry.restored_at &&
    !entry.purged_at &&
    !!entry.restore_deadline &&
    new Date(entry.restore_deadline).getTime() > now
  );
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

  list(afterId?: number): Promise<ActivityEntry[]> {
    const params: Record<string, number> = afterId ? { after_id: afterId } : {};
    return firstValueFrom(this.http.get<ActivityEntry[]>(`${API_BASE}/activity-logs`, { params }));
  }

  /** Every recorded deletion, including restored and permanently removed ones (still viewable). */
  listDeleted(): Promise<ActivityEntry[]> {
    return firstValueFrom(
      this.http.get<ActivityEntry[]>(`${API_BASE}/activity-logs`, { params: { deleted: 1 } }),
    );
  }

  restore(id: number): Promise<ActivityEntry> {
    return firstValueFrom(this.http.post<ActivityEntry>(`${API_BASE}/activity-logs/${id}/restore`, {}));
  }

  purge(id: number): Promise<ActivityEntry> {
    return firstValueFrom(this.http.delete<ActivityEntry>(`${API_BASE}/activity-logs/${id}/purge`));
  }

  /** Audit-logs actions that never hit a resource endpoint. Failures are swallowed so they never block the user. */
  async record(entry: {
    action: 'imported' | 'exported';
    subject: string;
    subject_type?: 'kanda' | 'jumuiya' | 'jumuiya_member' | 'offering';
  }): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/activity-logs`, entry));
    } catch {
      // The action itself already succeeded.
    }
  }
}
