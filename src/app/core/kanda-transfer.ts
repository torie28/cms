import { translate } from './i18n';
import { Jumuiya, Kanda } from './parish';
import { datedFilename, ExportFormat, readSheet, saveCsv, savePdf, saveWorkbook } from './spreadsheet';

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

  if (format === 'csv') {
    await saveCsv(summary, `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    await saveWorkbook([summary, detail], `${filename}.xlsx`);
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
    `Kanda ${kandas.length} · Jumuiya ${detail.rows.length}`,
    sections,
    `${filename}.pdf`,
    format === 'print',
  );
}
