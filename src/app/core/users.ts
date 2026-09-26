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
  { value: 'admin', label: 'Msimamizi' },
  { value: 'secretary', label: 'Katibu' },
  { value: 'treasurer', label: 'Mweka hazina' },
  { value: 'kanda_leader', label: 'Kiongozi wa kanda' },
  { value: 'jumuiya_leader', label: 'Kiongozi wa jumuiya' },
  { value: 'member', label: 'Mwanachama' },
] as const;

export function roleLabel(role: string): string {
  return USER_ROLES.find((item) => item.value === role)?.label ?? role.replaceAll('_', ' ');
}

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
