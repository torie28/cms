import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface Kanda {
  id: number;
  name: string;
  leader: string | null;
  notes: string | null;
  jumuiyas_count: number;
}

export interface Jumuiya {
  id: number;
  name: string;
  kanda_id: number;
  chairperson: string | null;
  notes: string | null;
  members_count?: number;
  members?: JumuiyaMember[];
  kanda?: { id: number; name: string };
}

export interface JumuiyaMember {
  id: number;
  jumuiya_id: number;
  name: string;
  phone: string | null;
  gender: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParishService {
  private readonly http = inject(HttpClient);

  listKandas(): Promise<Kanda[]> {
    return firstValueFrom(this.http.get<Kanda[]>(`${API_BASE}/kandas`));
  }

  createKanda(payload: { name: string; leader: string; notes: string }): Promise<Kanda> {
    return firstValueFrom(this.http.post<Kanda>(`${API_BASE}/kandas`, payload));
  }

  importKandas(
    kandas: { name: string; leader: string; notes: string }[],
    file: string,
  ): Promise<{ created: number; skipped: string[]; kandas: Kanda[] }> {
    return firstValueFrom(
      this.http.post<{ created: number; skipped: string[]; kandas: Kanda[] }>(
        `${API_BASE}/kandas/import`,
        { kandas, file },
      ),
    );
  }

  listJumuiyas(): Promise<Jumuiya[]> {
    return firstValueFrom(this.http.get<Jumuiya[]>(`${API_BASE}/jumuiyas`));
  }

  createJumuiya(payload: JumuiyaPayload): Promise<Jumuiya> {
    return firstValueFrom(this.http.post<Jumuiya>(`${API_BASE}/jumuiyas`, payload));
  }

  getJumuiya(id: number): Promise<Jumuiya> {
    return firstValueFrom(this.http.get<Jumuiya>(`${API_BASE}/jumuiyas/${id}`));
  }

  updateJumuiya(id: number, payload: JumuiyaPayload): Promise<Jumuiya> {
    return firstValueFrom(this.http.put<Jumuiya>(`${API_BASE}/jumuiyas/${id}`, payload));
  }

  deleteJumuiya(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/jumuiyas/${id}`));
  }

  listJumuiyaMembers(jumuiyaId: number): Promise<JumuiyaMember[]> {
    return firstValueFrom(
      this.http.get<JumuiyaMember[]>(`${API_BASE}/jumuiyas/${jumuiyaId}/members`),
    );
  }

  addJumuiyaMember(
    jumuiyaId: number,
    payload: JumuiyaMemberPayload,
  ): Promise<{ member: JumuiyaMember; jumuiya: Jumuiya }> {
    return firstValueFrom(
      this.http.post<{ member: JumuiyaMember; jumuiya: Jumuiya }>(
        `${API_BASE}/jumuiyas/${jumuiyaId}/members`,
        payload,
      ),
    );
  }

  addJumuiyaMembers(
    jumuiyaId: number,
    members: JumuiyaMemberPayload[],
  ): Promise<{ members: JumuiyaMember[]; jumuiya: Jumuiya }> {
    return firstValueFrom(
      this.http.post<{ members: JumuiyaMember[]; jumuiya: Jumuiya }>(
        `${API_BASE}/jumuiyas/${jumuiyaId}/members`,
        { members },
      ),
    );
  }

  updateJumuiyaMember(
    jumuiyaId: number,
    memberId: number,
    payload: JumuiyaMemberPayload,
  ): Promise<{ member: JumuiyaMember; jumuiya: Jumuiya }> {
    return firstValueFrom(
      this.http.put<{ member: JumuiyaMember; jumuiya: Jumuiya }>(
        `${API_BASE}/jumuiyas/${jumuiyaId}/members/${memberId}`,
        payload,
      ),
    );
  }

  deleteJumuiyaMember(jumuiyaId: number, memberId: number): Promise<{ jumuiya: Jumuiya }> {
    return firstValueFrom(
      this.http.delete<{ jumuiya: Jumuiya }>(`${API_BASE}/jumuiyas/${jumuiyaId}/members/${memberId}`),
    );
  }
}

export interface JumuiyaPayload {
  name: string;
  kanda_id: number;
  chairperson: string;
  notes: string;
  members?: JumuiyaMemberPayload[];
}

export interface JumuiyaMemberPayload {
  name: string;
  phone: string;
  gender: string;
}
