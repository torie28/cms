import { translate } from './i18n';
import { Jumuiya } from './parish';
import { datedFilename, ExportFormat, readSheet, saveCsv, savePdf, saveWorkbook, slug } from './spreadsheet';

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

export async function readSpreadsheet(file: File): Promise<ImportedRow[]> {
  const { rows, found } = await readSheet(file, HEADER_ALIASES, HEADER_ALIASES.member);

  if (!found.has('jumuiya') && !found.has('member')) {
    throw new Error(
      translate('Faili halina safu zinazotambulika. Tumia vichwa: {headers}.', {
        headers: MEMBER_COLUMNS.map((key) => HEADERS[key]).join(', '),
      }),
    );
  }

  return rows.filter((row) => row.jumuiya || row.member || row.phone);
}

export async function downloadTemplate(forJumuiya?: string): Promise<void> {
  if (forJumuiya) {
    await saveWorkbook(
      [
        {
          name: 'Wanajumuiya',
          head: [HEADERS.member, HEADERS.phone, HEADERS.gender],
          rows: [
            ['Maria Joseph', '0712345678', 'Mwanamke'],
            ['Petro Paulo', '0754321098', 'Mwanaume'],
          ],
        },
      ],
      `kiolezo-${slug(forJumuiya, 'jumuiya')}.xlsx`,
    );
    return;
  }

  await saveWorkbook(
    [
      {
        name: 'Wanajumuiya',
        head: MEMBER_COLUMNS.map((key) => HEADERS[key]),
        rows: [
          ['Mt. Yosefu', 'Kanda ya Kati', 'Yohana Petro', 'Maria Joseph', '0712345678', 'Mwanamke'],
          ['Mt. Yosefu', 'Kanda ya Kati', 'Yohana Petro', 'Petro Paulo', '0754321098', 'Mwanaume'],
        ],
      },
    ],
    'kiolezo-jumuiya.xlsx',
  );
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

  if (format === 'csv') {
    await saveCsv(members, `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    await saveWorkbook([summary, members], `${filename}.xlsx`);
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
    translate('Jumuiya {groups} · Wanajumuiya {members}', {
      groups: jumuiyas.length,
      members: members.rows.length,
    }),
    sections,
    `${filename}.pdf`,
    format === 'print',
  );
}
