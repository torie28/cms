import { httpErrorMessage } from './http-error';
import { translate } from './i18n';
import { offeringsSheet, sumOfferings } from './offering-transfer';
import { Offering } from './offerings';
import { Jumuiya, JumuiyaMemberPayload, Kanda, ParishService } from './parish';
import {
  datedFilename,
  ExportFormat,
  readSheet,
  saveCsv,
  savePdf,
  saveReport,
  saveWorkbook,
  SheetData,
  slug,
} from './spreadsheet';

export type { ExportFormat } from './spreadsheet';

const HEADERS = {
  jumuiya: 'Jumuiya',
  kanda: 'Kanda',
  chairperson: 'Mwenyekiti',
  notes: 'Maelezo',
  member: 'Mwanajumuiya',
  phone: 'Simu',
  gender: 'Jinsia',
} as const;

type Field = keyof typeof HEADERS;

export type ImportedRow = Record<Field, string> & { line: number };

const HEADER_ALIASES: Record<Field, string[]> = {
  jumuiya: ['jumuiya', 'jina la jumuiya', 'community', 'jumuiya name'],
  kanda: ['kanda', 'zone'],
  chairperson: ['mwenyekiti', 'chairperson', 'chair'],
  notes: ['maelezo', 'notes'],
  member: ['mwanajumuiya', 'jina la mwanajumuiya', 'jina', 'jina kamili', 'member', 'name', 'full name'],
  phone: ['simu', 'namba ya simu', 'phone', 'phone number', 'mobile'],
  gender: ['jinsia', 'gender', 'sex'],
};

const MEMBER_COLUMNS: Field[] = ['jumuiya', 'kanda', 'chairperson', 'member', 'phone', 'gender'];

export function normalizeGender(value: string): string {
  const key = value.trim().toLowerCase();

  if (['male', 'm', 'mwanaume', 'me', 'mume', 'kiume'].includes(key)) {
    return 'male';
  }

  if (['female', 'f', 'mwanamke', 'ke', 'kike'].includes(key)) {
    return 'female';
  }

  return key === '' ? '' : 'invalid';
}

export function genderText(gender: string | null): string {
  if (gender === 'male') {
    return 'Mwanaume';
  }

  if (gender === 'female') {
    return 'Mwanamke';
  }

  return '';
}

/**
 * Reads a jumuiya + members sheet (such as a kanda's fill-in template), or returns null when the file has
 * no Jumuiya and Mwanajumuiya columns and so is some other kind of sheet.
 */
export async function readJumuiyaMemberSheet(file: File): Promise<ImportedRow[] | null> {
  const { rows, found } = await readSheet(file, HEADER_ALIASES, HEADER_ALIASES.member);
  return found.has('jumuiya') && found.has('member') ? keepFilledRows(rows) : null;
}

/** Template rows that only carry a pre-filled Kanda are blanks, not data. */
function keepFilledRows(rows: ImportedRow[]): ImportedRow[] {
  return rows.filter((row) => row.jumuiya || row.member || row.phone);
}

export interface ImportGroup {
  name: string;
  existing: Jumuiya | null;
  kandaId: number;
  kandaName: string;
  chairperson: string;
  notes: string;
  members: JumuiyaMemberPayload[];
}

export interface ImportPlan {
  groups: ImportGroup[];
  issues: string[];
  memberCount: number;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Groups spreadsheet rows by jumuiya. Rows for an existing jumuiya add members to it; other names become new
 * jumuiyas in the kanda named on their rows. With `target`, every row is a member of that jumuiya; with
 * `kanda`, every row belongs to that kanda whatever its Kanda column says.
 */
export function buildImportPlan(
  rows: ImportedRow[],
  context: { jumuiyas: Jumuiya[]; kandas: Kanda[]; target?: Jumuiya | null; kanda?: Kanda | null },
): ImportPlan {
  const { jumuiyas, kandas, target = null, kanda: forKanda = null } = context;
  const issues: string[] = [];
  const groups = new Map<string, ImportGroup>();
  const warnedKanda = new Set<string>();

  for (const sheetRow of rows) {
    const row = forKanda ? { ...sheetRow, kanda: forKanda.name } : sheetRow;
    const name = target ? target.name : row.jumuiya;

    if (!name) {
      issues.push(translate('Mstari {line}: jina la jumuiya halipo, umerukwa.', { line: row.line }));
      continue;
    }

    const key = name.trim().toLowerCase();
    let group = groups.get(key);

    if (!group) {
      const existing = target ?? jumuiyas.find((item) => sameName(item.name, key)) ?? null;
      group = {
        name: existing?.name ?? name,
        existing,
        kandaId: existing?.kanda_id ?? 0,
        kandaName: existing?.kanda?.name ?? row.kanda,
        chairperson: '',
        notes: '',
        members: [],
      };
      groups.set(key, group);
    }

    if (!target && row.kanda && group.kandaName && !sameName(row.kanda, group.kandaName) && !warnedKanda.has(key)) {
      warnedKanda.add(key);
      issues.push(
        translate('Mstari {line}: {name} haiwezi kuwa kwenye kanda mbili; itabaki kwenye {kanda}, si {other}.', {
          line: row.line,
          name: group.name,
          kanda: group.kandaName,
          other: row.kanda,
        }),
      );
    }

    if (!group.existing) {
      group.kandaName ||= row.kanda;
      group.chairperson ||= row.chairperson;
      group.notes ||= row.notes;
    }

    if (!row.member) {
      if (row.phone || row.gender) {
        issues.push(translate('Mstari {line}: jina la mwanajumuiya halipo, umerukwa.', { line: row.line }));
      }
      continue;
    }

    if (row.member.length > 255 || row.phone.length > 40) {
      issues.push(translate('Mstari {line}: jina au simu ni ndefu mno, umerukwa.', { line: row.line }));
      continue;
    }

    let gender = normalizeGender(row.gender);
    if (gender === 'invalid') {
      issues.push(
        translate('Mstari {line}: jinsia "{gender}" haitambuliki, imeachwa wazi.', {
          line: row.line,
          gender: row.gender,
        }),
      );
      gender = '';
    }

    group.members.push({ name: row.member, phone: row.phone, gender });
  }

  const valid: ImportGroup[] = [];

  for (const group of groups.values()) {
    if (!group.existing) {
      const kanda = group.kandaName ? kandas.find((item) => sameName(item.name, group.kandaName)) : undefined;

      if (!kanda) {
        issues.push(
          group.kandaName
            ? translate('{name}: kanda "{kanda}" haipo, jumuiya imerukwa.', { name: group.name, kanda: group.kandaName })
            : translate('{name}: kanda haijatajwa, jumuiya imerukwa.', { name: group.name }),
        );
        continue;
      }

      group.kandaId = kanda.id;
      group.kandaName = kanda.name;

      const chair = group.chairperson.trim().toLowerCase();
      if (chair) {
        const leads =
          jumuiyas.find((item) => item.chairperson && sameName(item.chairperson, chair))?.name ??
          valid.find((other) => !other.existing && sameName(other.chairperson, chair))?.name;
        if (leads) {
          issues.push(
            translate('{name}: {chair} tayari ni mwenyekiti wa {other}; mwenyekiti ameachwa wazi.', {
              name: group.name,
              chair: group.chairperson,
              other: leads,
            }),
          );
          group.chairperson = '';
        }
      }
    } else if (group.members.length === 0) {
      continue;
    }

    valid.push(group);
  }

  return {
    groups: valid,
    issues,
    memberCount: valid.reduce((total, group) => total + group.members.length, 0),
  };
}

/** Saves an import plan one jumuiya at a time so one failure does not stop the rest. */
export interface ImportResult {
  created: number;
  added: number;
  failures: string[];
  /** Jumuiyas that were created or received members. */
  saved: ImportGroup[];
}

const NOTICE_NAME_LIMIT = 5;

/** "A, B, C" — or the first few names followed by how many more there are. */
function nameList(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length <= NOTICE_NAME_LIMIT) {
    return unique.join(', ');
  }
  return translate('{names} na nyingine {count}', {
    names: unique.slice(0, NOTICE_NAME_LIMIT).join(', '),
    count: unique.length - NOTICE_NAME_LIMIT,
  });
}

/** Success message naming the kanda(s) and jumuiya(s) an import went into. */
export function importNotice({ created, added, saved }: ImportResult): string {
  if (saved.length === 1) {
    const [group] = saved;
    return group.existing
      ? translate('Wanajumuiya {added} wameingizwa kwenye jumuiya {jumuiya} ({kanda}).', {
          added,
          jumuiya: group.name,
          kanda: group.kandaName || '—',
        })
      : translate('Jumuiya {jumuiya} imeongezwa kwenye {kanda} ikiwa na wanajumuiya {added}.', {
          jumuiya: group.name,
          kanda: group.kandaName || '—',
          added,
        });
  }

  return translate('Uingizaji kwenye {kanda} umekamilika: jumuiya mpya {created}, wanajumuiya {added}. Jumuiya: {names}.', {
    kanda: nameList(saved.map((group) => group.kandaName)) || '—',
    created,
    added,
    names: nameList(saved.map((group) => group.name)),
  });
}

export async function runImportPlan(plan: ImportPlan, parish: ParishService): Promise<ImportResult> {
  const failures: string[] = [];
  const saved: ImportGroup[] = [];
  let created = 0;
  let added = 0;

  for (const group of plan.groups) {
    try {
      if (group.existing) {
        if (group.members.length > 0) {
          await parish.addJumuiyaMembers(group.existing.id, group.members);
          added += group.members.length;
          saved.push(group);
        }
      } else {
        await parish.createJumuiya({
          name: group.name,
          kanda_id: group.kandaId,
          chairperson: group.chairperson,
          notes: group.notes,
          members: group.members,
        });
        created++;
        added += group.members.length;
        saved.push(group);
      }
    } catch (error) {
      failures.push(`${group.name}: ${httpErrorMessage(error, 'imeshindwa kuhifadhiwa.')}`);
    }
  }

  return { created, added, failures, saved };
}

export async function readSpreadsheet(file: File): Promise<ImportedRow[]> {
  const { rows, found } = await readSheet(file, HEADER_ALIASES, HEADER_ALIASES.member);

  if (!found.has('jumuiya') && !found.has('member')) {
    throw new Error(
      translate('Faili halina safu zinazotambulika. Tumia vichwa: {headers}.', {
        headers: MEMBER_COLUMNS.map((key) => HEADERS[key]).join(', '),
      }),
    );
  }

  return keepFilledRows(rows);
}

const GENDER_CHOICES = ['Mwanamke', 'Mwanaume'];

const jumuiyaTitle = (name: string) =>
  /^jumuiya\b/i.test(name) ? name : translate('Jumuiya ya {name}', { name });

/** Excel caps an inline dropdown list at 255 characters and splits it on commas. */
const EXCEL_LIST_LIMIT = 255;

function dropdown(values: string[]): string[] | undefined {
  const usable = values.filter((value) => value && !value.includes(',') && !value.includes('"'));
  return usable.length > 0 && usable.join(',').length + 2 <= EXCEL_LIST_LIMIT ? usable : undefined;
}

/** `forJumuiya` gives a members-only template for that jumuiya; otherwise jumuiyas and members together. */
export async function downloadTemplate(forJumuiya?: string, kandaName?: string): Promise<void> {
  if (forJumuiya) {
    await saveWorkbook(
      [
        {
          name: 'Wanajumuiya',
          head: [HEADERS.member, HEADERS.phone, HEADERS.gender],
          rows: [],
          choices: { 2: GENDER_CHOICES },
        },
      ],
      `kiolezo-${slug(forJumuiya, 'jumuiya')}.xlsx`,
      {
        title: jumuiyaTitle(forJumuiya),
        subtitle: [kandaName, translate('Kiolezo cha kuingiza wanajumuiya')].filter(Boolean).join(' · '),
        template: true,
      },
    );
    return;
  }

  await saveWorkbook(
    [
      {
        name: 'Wanajumuiya',
        head: MEMBER_COLUMNS.map((key) => HEADERS[key]),
        rows: [],
        choices: { 5: GENDER_CHOICES },
      },
    ],
    'kiolezo-jumuiya.xlsx',
    {
      title: translate('Kiolezo cha Jumuiya'),
      subtitle: translate('Jumuiya na wanajumuiya wake'),
      template: true,
    },
  );
}

/**
 * A template for one kanda: the Kanda column is already filled in and the Jumuiya column offers the
 * kanda's jumuiyas. New jumuiya names can also be typed; they are created in this kanda on import.
 */
export async function downloadKandaJumuiyaTemplate(kandaName: string, jumuiyaNames: string[]): Promise<void> {
  const jumuiyaChoices = dropdown([...jumuiyaNames].sort((a, b) => a.localeCompare(b)));
  const choices: Record<number, string[]> = { 5: GENDER_CHOICES };
  if (jumuiyaChoices) {
    choices[0] = jumuiyaChoices;
  }

  await saveWorkbook(
    [
      {
        name: 'Wanajumuiya',
        head: MEMBER_COLUMNS.map((key) => HEADERS[key]),
        rows: [],
        fill: { 1: kandaName },
        choices,
      },
    ],
    `kiolezo-${slug(kandaName, 'kanda')}.xlsx`,
    {
      title: /^kanda\b/i.test(kandaName) ? kandaName : translate('Kanda ya {name}', { name: kandaName }),
      subtitle: translate('Kiolezo cha kuingiza jumuiya na wanajumuiya'),
      template: true,
    },
  );
}

export interface JumuiyaProfileExtras {
  /** All offerings recorded for the jumuiya, or null when the user cannot see Sadaka. */
  offerings: Offering[] | null;
  /** Jumuiyas that were split off from this one. */
  children: Jumuiya[];
}

/** Everything known about one jumuiya: details, members and its offerings. */
export async function exportJumuiyaProfile(
  group: Jumuiya,
  format: ExportFormat,
  { offerings, children }: JumuiyaProfileExtras,
): Promise<void> {
  const members = group.members ?? [];
  const count = (gender: string | null) => members.filter((member) => member.gender === gender).length;
  const unknown = members.length - count('male') - count('female');

  const details: SheetData = {
    name: translate('Taarifa'),
    head: [translate('Kipengele'), translate('Taarifa')],
    labelColumn: true,
    rows: [
      [translate('Jina la jumuiya'), group.name],
      [translate('Kanda'), group.kanda?.name ?? ''],
      [translate('Mwenyekiti'), group.chairperson ?? ''],
      ...(group.parent ? [[translate('Imetokana na'), group.parent.name]] : []),
      ...(children.length > 0
        ? [[translate('Jumuiya zilizotokana nayo'), children.map((child) => child.name).join(', ')]]
        : []),
      [translate('Wanajumuiya'), String(members.length)],
      [translate('Wanaume'), String(count('male'))],
      [translate('Wanawake'), String(count('female'))],
      ...(unknown > 0 ? [[translate('Jinsia haijajazwa'), String(unknown)]] : []),
      ...(offerings
        ? [
            [translate('Idadi ya michango'), String(offerings.length)],
            [translate('Jumla ya michango (TSh)'), sumOfferings(offerings).toFixed(2)],
          ]
        : []),
      [translate('Maelezo'), group.notes ?? ''],
    ],
  };

  const memberSheet: SheetData = {
    name: translate('Wanajumuiya'),
    head: ['#', HEADERS.member, HEADERS.phone, HEADERS.gender],
    rows: members.map((member, index) => [
      String(index + 1),
      member.name,
      member.phone ?? '',
      genderText(member.gender),
    ]),
  };

  await saveReport(format, [details, memberSheet, ...(offerings ? [offeringsSheet(offerings)] : [])], {
    title: jumuiyaTitle(group.name),
    subtitle: [group.kanda?.name, translate('Taarifa kamili ya jumuiya')].filter(Boolean).join(' · '),
    csvSheet: 1,
  });
}

export async function exportJumuiyas(
  jumuiyas: Jumuiya[],
  format: ExportFormat,
  title = translate('Jumuiya zote'),
): Promise<void> {
  const summary = {
    name: 'Jumuiya',
    head: ['Jina', 'Kanda', 'Mwenyekiti', 'Wanajumuiya', 'Maelezo'],
    rows: jumuiyas.map((group) => [
      group.name,
      group.kanda?.name ?? '',
      group.chairperson ?? '',
      String(group.members?.length ?? group.members_count ?? 0),
      group.notes ?? '',
    ]),
  };

  const members = {
    name: 'Wanajumuiya',
    head: MEMBER_COLUMNS.map((key) => HEADERS[key]),
    rows: jumuiyas.flatMap((group) =>
      (group.members ?? []).map((member) => [
        group.name,
        group.kanda?.name ?? '',
        group.chairperson ?? '',
        member.name,
        member.phone ?? '',
        genderText(member.gender),
      ]),
    ),
  };

  const filename = datedFilename(title);
  const subtitle = translate('Jumuiya {groups} · Wanajumuiya {members}', {
    groups: jumuiyas.length,
    members: members.rows.length,
  });

  if (format === 'csv') {
    await saveCsv(members, `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    await saveWorkbook([summary, members], `${filename}.xlsx`, { title, subtitle });
    return;
  }

  const sections = [
    { head: summary.head, rows: summary.rows },
    ...jumuiyas
      .filter((group) => (group.members ?? []).length > 0)
      .map((group) => ({
        heading: `${group.name}${group.kanda?.name ? ` · ${group.kanda.name}` : ''}`,
        head: ['#', 'Jina', 'Simu', 'Jinsia'],
        rows: (group.members ?? []).map((member, index) => [
          String(index + 1),
          member.name,
          member.phone ?? '',
          genderText(member.gender),
        ]),
        firstColumnWidth: 28,
      })),
  ];

  await savePdf(
    title,
    subtitle,
    sections,
    `${filename}.pdf`,
    format === 'print',
  );
}
