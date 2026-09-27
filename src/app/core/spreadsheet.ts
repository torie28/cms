export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'print';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'print', label: 'Chapisha' },
];

export const FORMAT_NAMES: Record<ExportFormat, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  pdf: 'PDF',
  print: 'Chapisha',
};

export const SPREADSHEET_ACCEPT =
  '.xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

export interface SheetData {
  name: string;
  head: string[];
  rows: string[][];
}

export interface PdfSection {
  heading?: string;
  head: string[];
  rows: string[][];
  firstColumnWidth?: number;
}

export type ParsedRow<F extends string> = Record<F, string> & { line: number };

/**
 * Reads the first sheet whose header contains one of `preferredHeaders` (falling back to the first sheet)
 * and maps columns to fields via case-insensitive header aliases.
 */
export async function readSheet<F extends string>(
  file: File,
  aliases: Record<F, string[]>,
  preferredHeaders: string[],
): Promise<{ rows: ParsedRow<F>[]; found: Set<F> }> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const preferred = new Set(preferredHeaders.map((label) => label.toLowerCase()));

  const sheetName =
    workbook.SheetNames.find((name) => {
      const header = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 })[0] ?? [];
      return header.some((cell) => preferred.has(String(cell).trim().toLowerCase()));
    }) ?? workbook.SheetNames[0];

  if (!sheetName) {
    return { rows: [], found: new Set() };
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const [header = [], ...body] = grid;
  const fields = Object.keys(aliases) as F[];
  const columns = new Map<F, number>();

  header.forEach((cell, index) => {
    const label = String(cell).trim().toLowerCase();
    const field = fields.find((key) => !columns.has(key) && aliases[key].includes(label));
    if (field) {
      columns.set(field, index);
    }
  });

  const rows = body
    .map((row, index) => {
      const parsed = { line: index + 2 } as ParsedRow<F>;
      for (const field of fields) {
        const column = columns.get(field);
        (parsed as Record<string, string | number>)[field] =
          column === undefined ? '' : String(row[column] ?? '').trim();
      }
      return parsed;
    })
    .filter((row) => fields.some((field) => row[field] !== ''));

  return { rows, found: new Set(columns.keys()) };
}

export async function saveWorkbook(sheets: SheetData[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.head, ...sheet.rows]);
    worksheet['!cols'] = sheet.head.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  XLSX.writeFile(workbook, filename);
}

export async function saveCsv(sheet: SheetData, filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([sheet.head, ...sheet.rows]));
  saveBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function savePdf(
  title: string,
  subtitle: string,
  sections: PdfSection[],
  filename: string,
  print: boolean,
): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const accent: [number, number, number] = [138, 106, 42];
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;

  doc.setFontSize(16);
  doc.text(title, 40, 48);
  doc.setFontSize(9);
  doc.setTextColor(110);
  // I18nService mirrors the active language onto <html lang>; this helper runs outside DI.
  const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'sw-TZ';
  doc.text(`${subtitle} · ${new Date().toLocaleString(locale)}`, 40, 64);
  doc.setTextColor(0);

  sections.forEach((section, index) => {
    let startY = index === 0 ? 80 : (lastY() ?? 80) + 32;

    if (section.heading) {
      if (startY > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        startY = 48;
      }
      doc.setFontSize(12);
      doc.text(section.heading, 40, startY - 8);
    }

    autoTable(doc, {
      startY,
      head: [section.head],
      body: section.rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      columnStyles: section.firstColumnWidth ? { 0: { cellWidth: section.firstColumnWidth } } : {},
    });
  });

  if (print) {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

  doc.save(filename);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(value: string, fallback = 'faili'): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

export function datedFilename(title: string): string {
  return `${slug(title)}-${new Date().toISOString().slice(0, 10)}`;
}
