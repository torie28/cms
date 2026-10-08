import { translate } from './i18n';
import { genderText } from './jumuiya-transfer';
import { offeringsSheet, sumOfferings } from './offering-transfer';
import { Offering } from './offerings';
import { Jumuiya, Kanda, KandaDetail } from './parish';
import {
  datedFilename,
  ExportFormat,
  readSheet,
  saveCsv,
  savePdf,
  saveReport,
  saveWorkbook,
  SheetData,
} from './spreadsheet';

export type KandaRow = { line: number; name: string; leader: string; notes: string };

const HEADER_ALIASES = {
  name: ['kanda', 'jina', 'jina la kanda', 'name', 'zone'],
  leader: ['kiongozi', 'leader', 'mwenyekiti'],
  notes: ['maelezo', 'notes'],
};

const HEAD = ['Kanda', 'Kiongozi', 'Maelezo'];

export async function readKandaSpreadsheet(file: File): Promise<KandaRow[]> {
  const { rows, found } = await readSheet(file, HEADER_ALIASES, ['kiongozi', 'leader']);

  if (!found.has('name')) {
    throw new Error(
      translate('Faili halina safu ya jina la kanda. Tumia vichwa: {headers}.', { headers: HEAD.join(', ') }),
    );
  }

  return rows;
}

export async function downloadKandaTemplate(): Promise<void> {
  await saveWorkbook(
    [
      {
        name: 'Kanda',
        head: HEAD,
        rows: [
          ['Kanda ya Kati', 'Yohana Petro', 'Inahusisha mitaa ya katikati'],
          ['Kanda ya Kaskazini', 'Anna Mushi', ''],
        ],
      },
    ],
    'kiolezo-kanda.xlsx',
    { title: translate('Kiolezo cha Kanda'), subtitle: translate('Kanda za parokia'), template: true },
  );
}

/**
 * Everything known about one kanda: details, its jumuiyas, every member and the jumuiyas' offerings.
 * `groups` are the kanda's jumuiyas loaded with members; `offerings` is null when the user cannot see Sadaka.
 */
export async function exportKandaProfile(
  kanda: KandaDetail,
  groups: Jumuiya[],
  offerings: Offering[] | null,
  format: ExportFormat,
): Promise<void> {
  const showYear = kanda.offerings_year !== null;
  const membersOf = new Map(groups.map((group) => [group.id, group.members ?? []]));
  const jumuiyas = kanda.jumuiyas;

  const details: SheetData = {
    name: translate('Taarifa'),
    head: [translate('Kipengele'), translate('Taarifa')],
    labelColumn: true,
    rows: [
      [translate('Jina la kanda'), kanda.name],
      [translate('Kiongozi'), kanda.leader ?? ''],
      [translate('Jumuiya'), String(jumuiyas.length)],
      [translate('Jumuiya zilizogawanywa'), String(jumuiyas.filter((group) => group.parent).length)],
      [translate('Wanajumuiya'), String(kanda.members_count)],
      [translate('Wanaume'), String(kanda.male_count)],
      [translate('Wanawake'), String(kanda.female_count)],
      ...(showYear ? [[translate('Michango ya jumuiya mwaka huu (TSh)'), Number(kanda.offerings_year).toFixed(2)]] : []),
      ...(offerings
        ? [
            [translate('Idadi ya michango yote'), String(offerings.length)],
            [translate('Jumla ya michango yote (TSh)'), sumOfferings(offerings).toFixed(2)],
          ]
        : []),
      [translate('Maelezo'), kanda.notes ?? ''],
    ],
  };

  const sum = (pick: (group: (typeof jumuiyas)[number]) => number) =>
    jumuiyas.reduce((total, group) => total + pick(group), 0);

  const jumuiyaSheet: SheetData = {
    name: translate('Jumuiya'),
    head: [
      translate('Jumuiya'),
      translate('Mwenyekiti'),
      translate('Imetokana na'),
      translate('Wanajumuiya'),
      translate('Wanaume'),
      translate('Wanawake'),
      ...(showYear ? [translate('Michango mwaka huu (TSh)')] : []),
    ],
    rows: [
      ...jumuiyas.map((group) => [
        group.name,
        group.chairperson ?? '',
        group.parent?.name ?? '',
        String(group.members_count),
        String(group.male_count),
        String(group.female_count),
        ...(showYear ? [Number(group.offerings_year ?? 0).toFixed(2)] : []),
      ]),
      ...(jumuiyas.length > 0
        ? [
            [
              translate('Jumla kuu'),
              '',
              '',
              String(sum((group) => group.members_count)),
              String(sum((group) => group.male_count)),
              String(sum((group) => group.female_count)),
              ...(showYear ? [sum((group) => Number(group.offerings_year ?? 0)).toFixed(2)] : []),
            ],
          ]
        : []),
    ],
    totalRow: jumuiyas.length > 0,
  };

  const memberSheet: SheetData = {
    name: translate('Wanajumuiya'),
    head: ['#', 'Jumuiya', 'Mwanajumuiya', 'Simu', 'Jinsia'],
    rows: jumuiyas
      .flatMap((group) => (membersOf.get(group.id) ?? []).map((member) => ({ group, member })))
      .map(({ group, member }, index) => [
        String(index + 1),
        group.name,
        member.name,
        member.phone ?? '',
        genderText(member.gender),
      ]),
  };

  await saveReport(
    format,
    [details, jumuiyaSheet, memberSheet, ...(offerings ? [offeringsSheet(offerings)] : [])],
    {
      title: /^kanda\b/i.test(kanda.name) ? kanda.name : translate('Kanda ya {name}', { name: kanda.name }),
      subtitle: translate('Taarifa kamili ya kanda'),
      csvSheet: 2,
    },
  );
}

export async function exportKandas(
  kandas: Kanda[],
  jumuiyas: Jumuiya[],
  format: ExportFormat,
  title = 'Kanda zote',
): Promise<void> {
  const byKanda = new Map<number, Jumuiya[]>();
  for (const group of jumuiyas) {
    byKanda.set(group.kanda_id, [...(byKanda.get(group.kanda_id) ?? []), group]);
  }

  const summary = {
    name: 'Kanda',
    head: ['Kanda', 'Kiongozi', 'Jumuiya', 'Wanajumuiya', 'Maelezo'],
    rows: kandas.map((kanda) => {
      const groups = byKanda.get(kanda.id) ?? [];
      return [
        kanda.name,
        kanda.leader ?? '',
        String(kanda.jumuiyas_count),
        String(groups.reduce((total, group) => total + (group.members_count ?? 0), 0)),
        kanda.notes ?? '',
      ];
    }),
  };

  const detail = {
    name: 'Jumuiya',
    head: ['Kanda', 'Jumuiya', 'Mwenyekiti', 'Wanajumuiya'],
    rows: kandas.flatMap((kanda) =>
      (byKanda.get(kanda.id) ?? []).map((group) => [
        kanda.name,
        group.name,
        group.chairperson ?? '',
        String(group.members_count ?? 0),
      ]),
    ),
  };

  const filename = datedFilename(title);
  const subtitle = `Kanda ${kandas.length} · Jumuiya ${detail.rows.length}`;

  if (format === 'csv') {
    await saveCsv(summary, `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    await saveWorkbook([summary, detail], `${filename}.xlsx`, { title, subtitle });
    return;
  }

  const sections = [
    { head: summary.head, rows: summary.rows },
    ...kandas
      .filter((kanda) => (byKanda.get(kanda.id) ?? []).length > 0)
      .map((kanda) => ({
        heading: `${kanda.name}${kanda.leader ? ` · ${kanda.leader}` : ''}`,
        head: ['#', 'Jumuiya', 'Mwenyekiti', 'Wanajumuiya'],
        rows: (byKanda.get(kanda.id) ?? []).map((group, index) => [
          String(index + 1),
          group.name,
          group.chairperson ?? '',
          String(group.members_count ?? 0),
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
