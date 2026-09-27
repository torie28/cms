import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export type ApiFieldType = 'text' | 'secret' | 'select' | 'number' | 'email';

export interface ApiField {
  key: string;
  label: string;
  type: ApiFieldType;
  required: boolean;
  help: string | null;
  placeholder: string | null;
  max: number | null;
  options: { value: string; label: string }[] | null;
  /** Field is only relevant when another field in the same service has this value. */
  show_when: { field: string; value: string | string[] } | null;
  /** Always null for secrets. */
  value: string | number | null;
  has_value: boolean;
  /** Masked tail of a secret, e.g. "••••a1b2". */
  preview: string | null;
  /** "database" = saved from this screen, "env" = comes from API/.env. */
  source: 'database' | 'env' | null;
}

export type ApiServiceStatus = 'live' | 'test' | 'incomplete';

export interface ApiService {
  key: string;
  label: string;
  description: string;
  test: 'phone' | 'email';
  status: ApiServiceStatus;
  missing: string[];
  overridden: boolean;
  updated_at: string | null;
  updated_by: string | null;
  fields: ApiField[];
}

export interface ApiServiceChanges {
  values?: Record<string, string | number | null>;
  /** Field keys whose saved value is removed so API/.env applies again. */
  reset?: string[];
}

export interface ApiTestResult {
  ok: boolean;
  test_mode: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ApiSettingsService {
  private readonly http = inject(HttpClient);

  list(): Promise<ApiService[]> {
    return firstValueFrom(this.http.get<ApiService[]>(`${API_BASE}/api-settings`));
  }

  update(service: string, changes: ApiServiceChanges): Promise<ApiService> {
    return firstValueFrom(this.http.put<ApiService>(`${API_BASE}/api-settings/${service}`, changes));
  }

  test(service: string, to: string): Promise<ApiTestResult> {
    return firstValueFrom(this.http.post<ApiTestResult>(`${API_BASE}/api-settings/${service}/test`, { to }));
  }
}
