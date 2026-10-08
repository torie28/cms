import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export type OfferingCategory =
  | 'sadaka'
  | 'zaka'
  | 'fungu_la_kumi'
  | 'majitoleo'
  | 'shukrani'
  | 'ujenzi'
  | 'mengineyo';

export type PaymentMethod = 'cash' | 'mobile' | 'bank' | 'cheque';

export interface CategoryDefinition {
  value: OfferingCategory;
  label: string;
  hint: string;
  /** Given by one person, so the giver's name is required (mirrors Offering::PERSONAL_CATEGORIES). */
  personal?: boolean;
  /** Always belongs to a jumuiya (mirrors Offering::JUMUIYA_CATEGORIES). */
  jumuiya?: boolean;
  /** Giver gets an automatic thank-you SMS when a phone is given (mirrors Offering::THANK_YOU_CATEGORIES). */
  thankYou?: boolean;
}

export const OFFERING_CATEGORIES: readonly CategoryDefinition[] = [
  { value: 'sadaka', label: 'Sadaka ya ibada', hint: 'Sadaka inayokusanywa wakati wa misa na ibada.' },
  { value: 'zaka', label: 'Zaka', hint: 'Zaka ya muumini kwa parokia.', personal: true, thankYou: true },
  { value: 'fungu_la_kumi', label: 'Fungu la kumi', hint: 'Sehemu ya kumi ya mapato ya muumini.', personal: true, thankYou: true },
  {
    value: 'majitoleo',
    label: 'Majitoleo ya jumuiya',
    hint: 'Thamani ya vipaji kutoka jumuiya ndogo ndogo.',
    jumuiya: true,
  },
  { value: 'shukrani', label: 'Shukrani', hint: 'Sadaka ya shukrani kwa Mungu.', thankYou: true },
  { value: 'ujenzi', label: 'Mchango wa ujenzi', hint: 'Michango ya ujenzi na miradi ya parokia.' },
  { value: 'mengineyo', label: 'Matoleo mengineyo', hint: 'Matoleo mengine yoyote; eleza kwenye maelezo.' },
];

export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Taslimu' },
  { value: 'mobile', label: 'Pesa kwa simu' },
  { value: 'bank', label: 'Benki' },
  { value: 'cheque', label: 'Hundi' },
];

export interface Offering {
  id: number;
  category: OfferingCategory;
  /** Decimal string as sent by Laravel, e.g. "15000.00". */
  amount: string;
  received_on: string;
  payment_method: PaymentMethod;
  jumuiya_id: number | null;
  jumuiya?: { id: number; name: string } | null;
  contributor: string | null;
  /** Normalised, e.g. 255712345678. */
  contributor_phone: string | null;
  thank_you_message_id: number | null;
  thank_you_message?: { id: number; status: 'sending' | 'sent' | 'partial' | 'failed' } | null;
  reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface OfferingPayload {
  category: OfferingCategory;
  amount: number;
  received_on: string;
  payment_method: PaymentMethod;
  jumuiya_id: number | null;
  contributor: string;
  contributor_phone: string;
  send_thank_you: boolean;
  reference: string;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class OfferingService {
  private readonly http = inject(HttpClient);

  list(range: { from: string; to: string; jumuiyaIds?: number[] }): Promise<Offering[]> {
    const params: Record<string, string | string[]> = {};
    if (range.from) {
      params['from'] = range.from;
    }
    if (range.to) {
      params['to'] = range.to;
    }
    if (range.jumuiyaIds?.length) {
      params['jumuiya_ids[]'] = range.jumuiyaIds.map(String);
    }

    return firstValueFrom(this.http.get<Offering[]>(`${API_BASE}/offerings`, { params }));
  }

  create(payload: OfferingPayload): Promise<Offering> {
    return firstValueFrom(this.http.post<Offering>(`${API_BASE}/offerings`, payload));
  }

  update(id: number, payload: OfferingPayload): Promise<Offering> {
    return firstValueFrom(this.http.put<Offering>(`${API_BASE}/offerings/${id}`, payload));
  }

  delete(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/offerings/${id}`));
  }
}
