import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface ManagedUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

export interface NewUser {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

export const USER_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'kanda_leader', label: 'Kanda leader' },
  { value: 'jumuiya_leader', label: 'Jumuiya leader' },
  { value: 'member', label: 'Member' },
] as const;

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Promise<ManagedUser[]> {
    return firstValueFrom(this.http.get<ManagedUser[]>(`${API_BASE}/users`));
  }

  create(payload: NewUser): Promise<ManagedUser> {
    return firstValueFrom(this.http.post<ManagedUser>(`${API_BASE}/users`, payload));
  }
}
