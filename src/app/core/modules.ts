import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface AppModule {
  id: number;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  is_core: boolean;
  sort_order: number;
  users_count: number;
}

export type ModuleAction = 'create' | 'update' | 'delete';

export interface ModulePrivileges {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface ModuleActionOption {
  action: ModuleAction;
  label: string;
}

/** Write actions each module actually offers. Viewing the module is the access checkbox itself. */
export const MODULE_ACTIONS: Record<string, readonly ModuleActionOption[]> = {
  users: [
    { action: 'create', label: 'Ongeza' },
    { action: 'update', label: 'Hariri' },
    { action: 'delete', label: 'Futa' },
  ],
  sadaka: [
    { action: 'create', label: 'Ongeza' },
    { action: 'update', label: 'Hariri' },
    { action: 'delete', label: 'Futa' },
  ],
  jumuiya: [
    { action: 'create', label: 'Ongeza' },
    { action: 'update', label: 'Hariri' },
    { action: 'delete', label: 'Futa' },
  ],
  kanda: [{ action: 'create', label: 'Ongeza' }],
  notifications: [{ action: 'create', label: 'Tuma' }],
  settings: [{ action: 'update', label: 'Hariri' }],
  api_settings: [{ action: 'update', label: 'Hariri' }],
  activity_logs: [
    { action: 'update', label: 'Rejesha' },
    { action: 'delete', label: 'Futa kabisa' },
  ],
};

export const EMPTY_PRIVILEGES: ModulePrivileges = { create: false, update: false, delete: false };

export type ModuleChanges = Partial<Pick<AppModule, 'label' | 'description' | 'enabled'>>;

@Injectable({ providedIn: 'root' })
export class ModulesService {
  private readonly http = inject(HttpClient);

  list(): Promise<AppModule[]> {
    return firstValueFrom(this.http.get<AppModule[]>(`${API_BASE}/modules`));
  }

  update(id: number, changes: ModuleChanges): Promise<AppModule> {
    return firstValueFrom(this.http.put<AppModule>(`${API_BASE}/modules/${id}`, changes));
  }
}
