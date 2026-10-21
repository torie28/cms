import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';
import { AuthService } from './auth';
import { translate } from './i18n';

export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DeletionSubjectType =
  | 'kanda'
  | 'jumuiya'
  | 'jumuiya_member'
  | 'user'
  | 'role'
  | 'offering'
  | 'activity_log';

export interface DeletionRequestPerson {
  id: number;
  name: string;
  username: string;
}

export interface DeletionRequest {
  id: number;
  requester_id: number;
  subject_type: DeletionSubjectType;
  subject_id: number;
  subject_label: string;
  payload: {
    move_to_kanda_id?: number | null;
    move_to_kanda_name?: string | null;
    jumuiya_id?: number | null;
    jumuiya_name?: string | null;
    subject_type?: string | null;
  } | null;
  reason: string | null;
  status: DeletionRequestStatus;
  reviewer_id: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  requester?: DeletionRequestPerson | null;
  reviewer?: DeletionRequestPerson | null;
}

export interface DeletionRequestPayload {
  subject_type: DeletionSubjectType;
  subject_id: number;
  reason?: string;
  move_to_kanda_id?: number;
  jumuiya_id?: number;
}

/** Non-admins with delete privilege must ask an admin before anything is removed. */
export function needsDeleteApproval(auth: AuthService): boolean {
  return !auth.isAdmin();
}

export function deletionRequestNotice(name: string): string {
  return translate(
    'Ombi la kufuta {name} limetumwa kwa msimamizi. Baada ya kuidhinishwa, kitafutwa kiotomatiki hata usipokuwepo.',
    { name },
  );
}

@Injectable({ providedIn: 'root' })
export class DeletionRequestsService {
  private readonly http = inject(HttpClient);

  list(status: DeletionRequestStatus | 'all' = 'pending'): Promise<DeletionRequest[]> {
    return firstValueFrom(
      this.http.get<DeletionRequest[]>(`${API_BASE}/deletion-requests`, { params: { status } }),
    );
  }

  request(payload: DeletionRequestPayload): Promise<{ pending: boolean; request: DeletionRequest; message: string }> {
    return firstValueFrom(
      this.http.post<{ pending: boolean; request: DeletionRequest; message: string }>(
        `${API_BASE}/deletion-requests`,
        payload,
      ),
    );
  }

  approve(id: number, reviewNote?: string): Promise<{ request: DeletionRequest; moved: number }> {
    return firstValueFrom(
      this.http.post<{ request: DeletionRequest; moved: number }>(
        `${API_BASE}/deletion-requests/${id}/approve`,
        reviewNote ? { review_note: reviewNote } : {},
      ),
    );
  }

  reject(id: number, reviewNote?: string): Promise<{ request: DeletionRequest }> {
    return firstValueFrom(
      this.http.post<{ request: DeletionRequest }>(
        `${API_BASE}/deletion-requests/${id}/reject`,
        reviewNote ? { review_note: reviewNote } : {},
      ),
    );
  }
}
