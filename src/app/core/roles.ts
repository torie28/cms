import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface Role {
  id: number;
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  users_count: number;
}

export interface RolePayload {
  label: string;
  description: string | null;
}

export function roleLabel(roles: readonly Role[], name: string): string {
  return roles.find((role) => role.name === name)?.label ?? name.replaceAll('_', ' ');
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  list(): Promise<Role[]> {
    return firstValueFrom(this.http.get<Role[]>(`${API_BASE}/roles`));
  }

  create(payload: RolePayload): Promise<Role> {
    return firstValueFrom(this.http.post<Role>(`${API_BASE}/roles`, payload));
  }

  update(id: number, payload: RolePayload): Promise<Role> {
    return firstValueFrom(this.http.put<Role>(`${API_BASE}/roles/${id}`, payload));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/roles/${id}`));
  }
}
