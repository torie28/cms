import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

/** `restricted` and `disabled` mean Noah explained a limitation instead of giving steps. */
export type NoahStatus = 'ok' | 'restricted' | 'disabled' | 'unknown';

export interface NoahLink {
  label: string;
  path: string;
}

export interface NoahSuggestion {
  label: string;
  topic: string;
}

export interface NoahReply {
  reply: string;
  status: NoahStatus;
  topic: string | null;
  module: string | null;
  links: NoahLink[];
  suggestions: NoahSuggestion[];
}

export interface NoahQuestion {
  message?: string;
  /** Asks for a known topic directly, as the suggestion chips do. */
  topic?: string;
  /** Current page, so "how do I add here?" knows which module "here" is. */
  path?: string;
  /** Module of the previous answer, for follow-ups like "and delete?". */
  last_module?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NoahService {
  private readonly http = inject(HttpClient);

  intro(): Promise<NoahReply> {
    return firstValueFrom(this.http.get<NoahReply>(`${API_BASE}/noah`));
  }

  ask(question: NoahQuestion): Promise<NoahReply> {
    return firstValueFrom(this.http.post<NoahReply>(`${API_BASE}/noah/ask`, question));
  }
}
