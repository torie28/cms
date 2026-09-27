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
