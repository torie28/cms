import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export type Gender = 'male' | 'female';

export interface ManagedUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  role: string;
  modules: string[];
  created_at: string;
}

export interface UserPayload {
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  password: string;
  role: string;
  modules: string[];
}

export const GENDERS: readonly { value: Gender; label: string }[] = [
  { value: 'male', label: 'Mwanaume' },
  { value: 'female', label: 'Mwanamke' },
];

export function genderLabel(gender: string | null): string {
  return GENDERS.find((item) => item.value === gender)?.label ?? '—';
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Promise<ManagedUser[]> {
    return firstValueFrom(this.http.get<ManagedUser[]>(`${API_BASE}/users`));
  }

  create(payload: UserPayload): Promise<ManagedUser> {
    return firstValueFrom(this.http.post<ManagedUser>(`${API_BASE}/users`, payload));
  }

  update(id: number, payload: UserPayload): Promise<ManagedUser> {
    return firstValueFrom(this.http.put<ManagedUser>(`${API_BASE}/users/${id}`, payload));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/users/${id}`));
  }
}
