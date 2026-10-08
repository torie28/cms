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

export type ModuleActionIcon = 'plus' | 'edit' | 'trash' | 'send' | 'restore';

export interface ModuleActionOption {
  action: ModuleAction;
  label: string;
  icon: ModuleActionIcon;
}

const CRUD: readonly ModuleActionOption[] = [
  { action: 'create', label: 'Ongeza', icon: 'plus' },
  { action: 'update', label: 'Hariri', icon: 'edit' },
  { action: 'delete', label: 'Futa', icon: 'trash' },
];

/** Write actions each module actually offers. Viewing the module is the access checkbox itself. */
export const MODULE_ACTIONS: Record<string, readonly ModuleActionOption[]> = {
  users: CRUD,
  sadaka: CRUD,
  jumuiya: CRUD,
  kanda: [{ action: 'create', label: 'Ongeza', icon: 'plus' }],
  notifications: [{ action: 'create', label: 'Tuma', icon: 'send' }],
  settings: [{ action: 'update', label: 'Hariri', icon: 'edit' }],
  api_settings: [{ action: 'update', label: 'Hariri', icon: 'edit' }],
  activity_logs: [
    { action: 'update', label: 'Rejesha', icon: 'restore' },
    { action: 'delete', label: 'Futa kabisa', icon: 'trash' },
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
