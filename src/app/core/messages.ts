import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';
import { translate } from './i18n';

export type MessageChannel = 'sms' | 'app' | 'both';
export type AudienceType = 'all' | 'kanda' | 'jumuiya' | 'users' | 'custom';
export type MessageStatus = 'sending' | 'sent' | 'partial' | 'failed';

export interface Message {
  id: number;
  sender: string;
  channel: MessageChannel;
  audience: AudienceType;
  audience_label: string;
  title: string | null;
  body: string;
  status: MessageStatus;
  sms_count: number;
  sms_sent: number;
  sms_failed: number;
  sms_segments: number;
  app_count: number;
  skipped_count: number;
  created_at: string;
  recipients?: MessageRecipient[];
}

export interface MessageRecipient {
  id: number;
  channel: 'sms' | 'app';
  recipient_type: 'member' | 'user' | 'phone';
  recipient_id: number | null;
  name: string | null;
  phone: string | null;
  group_name: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  read_at: string | null;
}

export interface ContactBook {
  kandas: { id: number; name: string }[];
  jumuiyas: { id: number; name: string; kanda_id: number; kanda?: { id: number; name: string } }[];
  members: { id: number; jumuiya_id: number; name: string; phone: string | null }[];
  users: { id: number; name: string; phone: string | null; role: string }[];
  gateway: { driver: string; sender_id: string };
}

export interface MessagePayload {
  channel: MessageChannel;
  audience: AudienceType;
  kanda_ids?: number[];
  jumuiya_ids?: number[];
  member_ids?: number[];
  user_ids?: number[];
  phones?: string[];
  title: string;
  body: string;
}

export interface InboxItem {
  id: number;
  read_at: string | null;
  created_at: string;
  sender: string | null;
  title: string | null;
  body: string;
}

export const NAME_PLACEHOLDER = '{jina}';

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  sms: 'SMS',
  app: 'Arifa ya mfumo',
  both: 'SMS na arifa',
};

export const STATUS_LABELS: Record<MessageStatus, string> = {
  sending: 'Inatumwa',
  sent: 'Imetumwa',
  partial: 'Baadhi zimeshindwa',
  failed: 'Imeshindwa',
};

/**
 * The API stores the audience as Swahili text (see API/app/Support/Sms/Audience.php);
 * its fixed patterns are re-translated here so old messages follow the UI language.
 */
export function audienceLabel(label: string): string {
  const counted = label.match(/^(Watumiaji|Watu) (\d+) (wa mfumo|waliochaguliwa)$/);
  if (counted) {
    return translate(`${counted[1]} {count} ${counted[3]}`, { count: counted[2] });
  }

  const named = label.match(/^(Kanda|Jumuiya): (.*?)(?: na nyingine (\d+))?$/);
  if (named) {
    const names = named[3] ? translate('{names} na nyingine {count}', { names: named[2], count: named[3] }) : named[2];
    return `${translate(named[1])}: ${names}`;
  }

  return translate(label);
}

/** Mirrors the API's normalizer so counts on screen match what will actually be sent. */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? '').replace(/\D+/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `255${digits.slice(1)}`;
  }
  if (digits.length === 9 && (digits[0] === '6' || digits[0] === '7')) {
    return `255${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15 && !digits.startsWith('0')) {
    return digits;
  }
  return null;
}

export function displayPhone(phone: string | null): string {
  if (!phone) {
    return '—';
  }
  return phone.startsWith('255') && phone.length === 12
    ? `+255 ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    : `+${phone}`;
}

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';

export interface SmsLength {
  characters: number;
  segments: number;
  perSegment: number;
  unicode: boolean;
  /** Characters left before another SMS part is needed. */
  remaining: number;
}

export function smsLength(text: string): SmsLength {
  let units = 0;
  let unicode = false;

  for (const char of text) {
    if (GSM_BASIC.includes(char)) {
      units++;
    } else if (GSM_EXTENDED.includes(char)) {
      units += 2;
    } else {
      unicode = true;
      break;
    }
  }

  if (unicode) {
    units = [...text].length;
  }

  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const perSegment = segments > 1 ? multi : single;

  return {
    characters: units,
    segments,
    perSegment,
    unicode,
    remaining: Math.max(0, (segments || 1) * perSegment - units),
  };
}

export function renderMessage(body: string, name: string | null): string {
  return body.replaceAll(NAME_PLACEHOLDER, name || 'Mpendwa');
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly http = inject(HttpClient);

  contacts(): Promise<ContactBook> {
    return firstValueFrom(this.http.get<ContactBook>(`${API_BASE}/messages/contacts`));
  }

  list(): Promise<Message[]> {
    return firstValueFrom(this.http.get<Message[]>(`${API_BASE}/messages`));
  }

  get(id: number): Promise<Message> {
    return firstValueFrom(this.http.get<Message>(`${API_BASE}/messages/${id}`));
  }

  send(payload: MessagePayload): Promise<Message> {
    return firstValueFrom(this.http.post<Message>(`${API_BASE}/messages`, payload));
  }

  retry(id: number): Promise<Message> {
    return firstValueFrom(this.http.post<Message>(`${API_BASE}/messages/${id}/retry`, {}));
  }

  inbox(): Promise<{ unread: number; items: InboxItem[] }> {
    return firstValueFrom(this.http.get<{ unread: number; items: InboxItem[] }>(`${API_BASE}/inbox`));
  }

  markRead(id: number): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${API_BASE}/inbox/${id}/read`, {}));
  }

  markAllRead(): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${API_BASE}/inbox/read-all`, {}));
  }
}
