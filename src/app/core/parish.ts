import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

/** The five leadership posts, held at the community and the zone level independently. */
export type Role = 'chair' | 'vice_chair' | 'secretary' | 'vice_secretary' | 'treasurer';

/** Blank (ordinary member) plus the five posts, with both languages' labels. */
export const ROLE_OPTIONS: { value: Role; sw: string; en: string }[] = [
  { value: 'chair', sw: 'Mwenyekiti', en: 'Chairperson' },
  { value: 'vice_chair', sw: 'M/Mwenyekiti', en: 'V/Chairperson' },
  { value: 'secretary', sw: 'Katibu', en: 'Secretary' },
  { value: 'vice_secretary', sw: 'M/Katibu', en: 'V/Secretary' },
  { value: 'treasurer', sw: 'Mweka Hazina', en: 'Treasurer' },
];

export interface Kanda {
  id: number;
  name: string;
  notes: string | null;
  parent_id?: number | null;
  parent?: { id: number; name: string } | null;
  children_count?: number;
  jumuiyas_count: number;
  members_count?: number;
}

export interface KandaJumuiya extends Jumuiya {
  members_count: number;
  male_count: number;
  female_count: number;
  children_count: number;
  /** Sum of offerings since 1 January; absent when the user cannot see Sadaka. */
  offerings_year?: string | number | null;
}

export interface KandaDetail extends Kanda {
  members_count: number;
  male_count: number;
  female_count: number;
  jumuiyas: KandaJumuiya[];
  offerings_year: number | null;
}

export interface Jumuiya {
  id: number;
  name: string;
  kanda_id: number;
  parent_id?: number | null;
  notes: string | null;
  members_count?: number;
  members?: JumuiyaMember[];
  kanda?: { id: number; name: string };
  parent?: { id: number; name: string } | null;
}

export interface JumuiyaMember {
  id: number;
  jumuiya_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  /** Full name, built by the API from the three parts. */
  name: string;
  phone: string | null;
  gender: string | null;
  community_role: Role | null;
  zone_role: Role | null;
}

/** A person with their community and zone attached, for the whole-parish directory. */
export interface DirectoryPerson extends JumuiyaMember {
  jumuiya: { id: number; name: string; kanda_id: number; kanda?: { id: number; name: string } };
}

export interface JumuiyaMemberPayload {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone?: string | null;
  gender?: string | null;
  community_role?: Role | null;
  zone_role?: Role | null;
}

export interface JumuiyaPayload {
  name: string;
  kanda_id: number;
  notes?: string;
  members?: JumuiyaMemberPayload[];
}

@Injectable({ providedIn: 'root' })
export class ParishService {
  private readonly http = inject(HttpClient);

  listKandas(): Promise<Kanda[]> {
    return firstValueFrom(this.http.get<Kanda[]>(`${API_BASE}/kandas`));
  }

  createKanda(payload: { name: string; notes?: string }): Promise<Kanda> {
    return firstValueFrom(this.http.post<Kanda>(`${API_BASE}/kandas`, payload));
  }

  getKanda(id: number): Promise<KandaDetail> {
    return firstValueFrom(this.http.get<KandaDetail>(`${API_BASE}/kandas/${id}`));
  }

  updateKanda(id: number, payload: { name: string; notes?: string }): Promise<Kanda> {
    return firstValueFrom(this.http.put<Kanda>(`${API_BASE}/kandas/${id}`, payload));
  }

  deleteKanda(id: number, moveToKandaId?: number): Promise<{ moved: number }> {
    return firstValueFrom(
      this.http.delete<{ moved: number }>(`${API_BASE}/kandas/${id}`, {
        body: moveToKandaId ? { move_to_kanda_id: moveToKandaId } : {},
      }),
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

  updateJumuiya(id: number, payload: { name: string; kanda_id: number; notes?: string }): Promise<Jumuiya> {
    return firstValueFrom(this.http.put<Jumuiya>(`${API_BASE}/jumuiyas/${id}`, payload));
  }

  /** Moves a community, with all its people, into another zone. */
  moveJumuiya(id: number, kandaId: number): Promise<Jumuiya> {
    return firstValueFrom(this.http.post<Jumuiya>(`${API_BASE}/jumuiyas/${id}/move`, { kanda_id: kandaId }));
  }

  deleteJumuiya(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/jumuiyas/${id}`));
  }

  /** Every person in the parish with their community and zone, for search and the people list. */
  listPeople(): Promise<DirectoryPerson[]> {
    return firstValueFrom(this.http.get<DirectoryPerson[]>(`${API_BASE}/people`));
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
