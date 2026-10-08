import { translate } from './i18n';
import { normalizePhone } from './messages';
import {
  Offering,
  OFFERING_CATEGORIES,
  OfferingCategory,
  OfferingPayload,
  PAYMENT_METHODS,
  PaymentMethod,
} from './offerings';
import { Jumuiya } from './parish';
import { readSheet, saveWorkbook, SheetData, slug } from './spreadsheet';

export const sumOfferings = (offerings: Offering[]) =>
  offerings.reduce((total, offering) => total + Number(offering.amount), 0);

/** Ledger of offerings closed by a grand-total row, as used by every module's export. */
export function offeringsSheet(offerings: Offering[], name = translate('Michango')): SheetData {
  const label = (list: readonly { value: string; label: string }[], value: string) =>
    translate(list.find((item) => item.value === value)?.label ?? value);

  return {
    name,
    head: ['Tarehe', 'Aina', 'Mtoaji', 'Jumuiya', 'Njia ya malipo', 'Namba ya risiti', 'Kiasi (TSh)', 'Maelezo'].map(
      (heading) => translate(heading),
    ),
    rows: [
      ...offerings.map((item) => [
        item.received_on,
        label(OFFERING_CATEGORIES, item.category),
        item.contributor ?? '',
        item.jumuiya?.name ?? '',
        label(PAYMENT_METHODS, item.payment_method),
        item.reference ?? '',
        Number(item.amount).toFixed(2),
        item.notes ?? '',
      ]),
      ...(offerings.length > 0
        ? [[translate('Jumla kuu'), '', '', '', '', '', sumOfferings(offerings).toFixed(2), '']]
        : []),
    ],
    totalRow: offerings.length > 0,
  };
}

const HEADERS = {
  contributor: 'Jina',
  amount: 'Kiasi',
  date: 'Tarehe',
  phone: 'Simu',
  jumuiya: 'Jumuiya',
  method: 'Njia ya malipo',
  reference: 'Namba ya risiti',
  notes: 'Maelezo',
} as const;

type Field = keyof typeof HEADERS;

const HEADER_ALIASES: Record<Field, string[]> = {
  contributor: ['jina', 'jina la mtoaji', 'jina kamili', 'mtoaji', 'muumini', 'name', 'full name', 'contributor', 'giver'],
  amount: ['kiasi', 'kiasi (tsh)', 'tsh', 'kiwango', 'amount', 'amount (tsh)'],
  date: ['tarehe', 'tarehe ya kupokea', 'date', 'received on'],
  phone: ['simu', 'namba ya simu', 'simu ya mtoaji', 'phone', 'phone number', 'mobile'],
  jumuiya: ['jumuiya', 'community'],
  method: ['njia ya malipo', 'njia', 'malipo', 'payment method', 'method', 'payment'],
  reference: ['namba ya risiti', 'risiti', 'namba ya muamala', 'muamala', 'reference', 'receipt', 'receipt no'],
  notes: ['maelezo', 'notes', 'note'],
};

const METHOD_ALIASES: Record<PaymentMethod, string[]> = {
  cash: ['taslimu', 'cash', 'fedha', 'pesa taslimu'],
  mobile: ['pesa kwa simu', 'simu', 'mobile', 'mobile money', 'm-pesa', 'mpesa', 'tigo pesa', 'tigopesa', 'airtel money', 'halopesa', 'mixx'],
  bank: ['benki', 'bank', 'bank transfer'],
  cheque: ['hundi', 'cheque', 'check'],
};

export interface OfferingImportRow {
  line: number;
  payload: OfferingPayload;
  jumuiyaName: string | null;
  /** Non-fatal notes shown next to the row, e.g. a dropped invalid phone. */
  warnings: string[];
}

export interface OfferingImportPlan {
  rows: OfferingImportRow[];
  /** Rows that cannot be imported, already phrased as "Mstari N: …". */
  errors: string[];
  total: number;
  withPhone: number;
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/tsh|tzs|\/=|\s|,/gi, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const amount = Number(cleaned);
  return amount >= 1 ? amount : null;
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Accepts ISO dates, day-first dates (29/09/2026, 29-9-26, 29.09.2026) and raw Excel serials. */
function parseDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const parts = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (parts) {
    let [day, month] = [Number(parts[1]), Number(parts[2])];
    const year = parts[3].length === 2 ? 2000 + Number(parts[3]) : Number(parts[3]);
    // Day-first is the local convention; swap only when the second number cannot be a month.
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    return isoDate(year, month, day);
  }

  if (/^\d{5}$/.test(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  return null;
}

function parseMethod(value: string): PaymentMethod | null {
  const key = value.trim().toLowerCase();
  if (!key) {
    return 'cash';
  }
  return (Object.keys(METHOD_ALIASES) as PaymentMethod[]).find((method) => METHOD_ALIASES[method].includes(key)) ?? null;
}

export async function readOfferingSheet(
  file: File,
  category: OfferingCategory,
  jumuiyas: Jumuiya[],
  today: string,
): Promise<OfferingImportPlan> {
  const { rows, found } = await readSheet(file, HEADER_ALIASES, HEADER_ALIASES.contributor);

  if (!found.has('contributor') || !found.has('amount')) {
    throw new Error(
      translate('Faili lazima liwe na safu za {name} na {amount}. Pakua kiolezo uone mpangilio.', {
        name: HEADERS.contributor,
        amount: HEADERS.amount,
      }),
    );
  }

  const byName = new Map(jumuiyas.map((group) => [group.name.trim().toLowerCase(), group]));
  const plan: OfferingImportPlan = { rows: [], errors: [], total: 0, withPhone: 0 };

  for (const row of rows) {
    const fail = (reason: string, params?: Record<string, string>) =>
      plan.errors.push(translate('Mstari {line}: {reason}', { line: row.line, reason: translate(reason, params) }));

    if (!row.contributor) {
      fail('jina la mtoaji halipo.');
      continue;
    }

    const amount = parseAmount(row.amount);
    if (amount === null) {
      fail('kiasi "{value}" si sahihi.', { value: row.amount || '—' });
      continue;
    }

    const receivedOn = row.date ? parseDate(row.date) : today;
    if (!receivedOn) {
      fail('tarehe "{value}" haieleweki; tumia mfano 2026-09-29 au 29/09/2026.', { value: row.date });
      continue;
    }
    if (receivedOn > today) {
      fail('tarehe {value} ni ya baadaye.', { value: receivedOn });
      continue;
    }

    const method = parseMethod(row.method);
    if (!method) {
      fail('njia ya malipo "{value}" haijulikani; tumia Taslimu, Pesa kwa simu, Benki au Hundi.', { value: row.method });
      continue;
    }

    const warnings: string[] = [];

    let phone = '';
    if (row.phone) {
      if (normalizePhone(row.phone)) {
        phone = row.phone;
      } else {
        warnings.push(translate('Namba ya simu "{value}" si sahihi, imeachwa.', { value: row.phone }));
      }
    }

    let jumuiya: Jumuiya | null = null;
    if (row.jumuiya) {
      jumuiya = byName.get(row.jumuiya.trim().toLowerCase()) ?? null;
      if (!jumuiya) {
        warnings.push(translate('Jumuiya "{value}" haipo, imeachwa.', { value: row.jumuiya }));
      }
    }

    plan.rows.push({
      line: row.line,
      jumuiyaName: jumuiya?.name ?? null,
      warnings,
      payload: {
        category,
        amount,
        received_on: receivedOn,
        payment_method: method,
        jumuiya_id: jumuiya?.id ?? null,
        contributor: row.contributor,
        contributor_phone: phone,
        send_thank_you: false,
        reference: row.reference,
        notes: row.notes,
      },
    });
    plan.total += amount;
    if (phone) {
      plan.withPhone++;
    }
  }

  return plan;
}

export async function downloadOfferingTemplate(categoryLabel: string, today: string): Promise<void> {
  const columns: Field[] = ['contributor', 'amount', 'date', 'phone', 'jumuiya', 'method', 'reference', 'notes'];
  await saveWorkbook(
    [
      {
        name: categoryLabel.slice(0, 31),
        head: columns.map((key) => HEADERS[key]),
        rows: [
          ['Maria Joseph', '20000', today, '0712345678', 'Mt. Yosefu', 'Taslimu', '', ''],
          ['Petro Paulo', '15000', today, '0754321098', '', 'Pesa kwa simu', 'QK12AB34CD', 'Septemba'],
        ],
        choices: { 5: ['Taslimu', 'Pesa kwa simu', 'Benki', 'Hundi'] },
      },
    ],
    `kiolezo-${slug(categoryLabel, 'michango')}.xlsx`,
    {
      title: categoryLabel,
      subtitle: translate('Kiolezo cha kuingiza michango · Tarehe kwa mfumo {format}', { format: 'YYYY-MM-DD' }),
      template: true,
    },
  );
}
