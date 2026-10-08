import { translate } from './i18n';

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
  /** Overrides the workbook title in this sheet's banner. */
  title?: string;
  /** Styles the last row as a grand total. */
  totalRow?: boolean;
  /** Dropdown values per column index, offered on every data row. */
  choices?: Record<number, string[]>;
  /** Field/value layout: the first column holds bold labels. */
  labelColumn?: boolean;
}

export interface WorkbookOptions {
  title: string;
  subtitle?: string;
  /** Adds fill-in instructions, marks the rows as examples and appends blank rows to fill. */
  template?: boolean;
}

export interface PdfSection {
  heading?: string;
  head: string[];
  rows: string[][];
  firstColumnWidth?: number;
  totalRow?: boolean;
}

export type ParsedRow<F extends string> = Record<F, string> & { line: number };

/** Downloaded templates put a title banner above the headings, so the heading row is searched for. */
const HEADER_SCAN_ROWS = 15;

const cellLabel = (cell: unknown) => String(cell).trim().toLowerCase();

function headerRowIndex(grid: unknown[][], labels: Set<string>): number {
  let best = -1;
  let bestScore = 0;

  grid.slice(0, HEADER_SCAN_ROWS).forEach((row, index) => {
    const score = row.filter((cell) => labels.has(cellLabel(cell))).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });

  return best;
}

/**
 * Reads the first sheet whose heading row contains one of `preferredHeaders` (falling back to the first sheet)
 * and maps columns to fields via case-insensitive header aliases.
 */
export async function readSheet<F extends string>(
  file: File,
  aliases: Record<F, string[]>,
  preferredHeaders: string[],
): Promise<{ rows: ParsedRow<F>[]; found: Set<F> }> {
  const XLSX = await import('xlsx');
  // dateNF makes cells with Excel's default date format come out as ISO text instead of m/d/yy.
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', dateNF: 'yyyy-mm-dd' });
  const preferred = new Set(preferredHeaders.map((label) => label.toLowerCase()));
  const fields = Object.keys(aliases) as F[];
  const known = new Set(fields.flatMap((field) => aliases[field]));

  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    // Blank rows are kept so grid indexes map straight onto spreadsheet row numbers.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true });
    const origin = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r : 0;
    return { grid, origin };
  });

  const chosen =
    sheets.find(({ grid }) => headerRowIndex(grid, preferred) >= 0) ?? sheets[0];

  if (!chosen) {
    return { rows: [], found: new Set() };
  }

  const headerIndex = Math.max(headerRowIndex(chosen.grid, known), 0);
  const header = chosen.grid[headerIndex] ?? [];
  const body = chosen.grid.slice(headerIndex + 1);
  const firstLine = chosen.origin + headerIndex + 2;
  const columns = new Map<F, number>();

  header.forEach((cell, index) => {
    const label = cellLabel(cell);
    const field = fields.find((key) => !columns.has(key) && aliases[key].includes(label));
    if (field) {
      columns.set(field, index);
    }
  });

  const rows = body
    .map((row, index) => {
      const parsed = { line: firstLine + index } as ParsedRow<F>;
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

const PALETTE = {
  banner: 'FF4A3712',
  gold: 'FFC9A24A',
  accent: 'FF8A6A2A',
  cream: 'FFF8F1E1',
  stripe: 'FFFCF8EF',
  line: 'FFE2D4B2',
  ink: 'FF2B2111',
  muted: 'FF7A6440',
  white: 'FFFFFFFF',
} as const;

const CHAPEL = 'St. Mathias Naramtoni';
const SERIF = 'Cambria';
const SANS = 'Calibri';
const BLANK_TEMPLATE_ROWS = 40;

/** Leading zeros (phone numbers) and long digit runs stay text so Excel does not mangle them. */
const NUMERIC = /^(0|[1-9]\d{0,13})(\.\d+)?$/;

function localeNow(): string {
  // I18nService mirrors the active language onto <html lang>; this helper runs outside DI.
  const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'sw-TZ';
  return new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' });
}

function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    candidate = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function saveWorkbook(sheets: SheetData[], filename: string, options: WorkbookOptions): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = CHAPEL;
  workbook.created = new Date();
  workbook.title = options.title;

  const generated = translate('Imetolewa {date}', { date: localeNow() });
  const used = new Set<string>();
  const thin = (argb: string) => ({ style: 'thin' as const, color: { argb } });
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

  for (const sheet of sheets) {
    const columnCount = Math.max(sheet.head.length, 1);
    const worksheet = workbook.addWorksheet(sheetName(sheet.name, used), {
      properties: { tabColor: { argb: PALETTE.accent }, defaultRowHeight: 18 },
    });

    const banner = (text: string, height: number, style: Partial<import('exceljs').Style>) => {
      const row = worksheet.addRow([text]);
      row.height = height;
      worksheet.mergeCells(row.number, 1, row.number, columnCount);
      Object.assign(row.getCell(1), style);
      return row;
    };

    const title = sheet.title ?? options.title;
    const subtitle = [sheet.name === title ? '' : sheet.name, options.subtitle, generated]
      .filter(Boolean)
      .join('   ·   ');

    banner(CHAPEL.toLocaleUpperCase(), 40, {
      font: { name: SERIF, size: 20, bold: true, color: { argb: PALETTE.white } },
      fill: fill(PALETTE.banner),
      alignment: { horizontal: 'center', vertical: 'bottom' },
    });
    banner(title.toLocaleUpperCase(), 28, {
      font: { name: SERIF, size: 13, bold: true, color: { argb: PALETTE.gold } },
      fill: fill(PALETTE.banner),
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    banner('', 5, { fill: fill(PALETTE.gold) });
    banner(subtitle, 24, {
      font: { name: SERIF, size: 10, italic: true, color: { argb: PALETTE.muted } },
      fill: fill(PALETTE.cream),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { bottom: thin(PALETTE.line) },
    });

    if (options.template) {
      banner(
        translate(
          'Jaza taarifa chini ya vichwa vya safu. Usibadilishe majina ya vichwa; futa mistari ya mfano (iliyoandikwa kwa italiki) kabla ya kupakia.',
        ),
        34,
        {
          font: { name: SANS, size: 9, color: { argb: PALETTE.ink } },
          fill: fill(PALETTE.stripe),
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        },
      );
    }

    worksheet.addRow([]).height = 8;

    const headerRow = worksheet.addRow(sheet.head);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: SERIF, size: 11, bold: true, color: { argb: PALETTE.white } };
      cell.fill = fill(PALETTE.accent);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: thin(PALETTE.banner),
        left: thin(PALETTE.gold),
        right: thin(PALETTE.gold),
        bottom: { style: 'medium', color: { argb: PALETTE.banner } },
      };
    });

    const blanks = options.template ? BLANK_TEMPLATE_ROWS : 0;
    const body: string[][] = [...sheet.rows, ...Array.from({ length: blanks }, () => sheet.head.map(() => ''))];
    const widths = sheet.head.map((label) => label.length);

    body.forEach((values, index) => {
      const isExample = options.template && index < sheet.rows.length;
      const isTotal = sheet.totalRow && index === sheet.rows.length - 1;
      const isLabel = (column: number) => sheet.labelColumn && column === 1;
      const row = worksheet.addRow(values.map((value) => (NUMERIC.test(value) ? Number(value) : value)));
      row.height = 20;

      for (let column = 1; column <= columnCount; column++) {
        const cell = row.getCell(column);
        const raw = values[column - 1] ?? '';
        const numeric = NUMERIC.test(raw);
        widths[column - 1] = Math.max(widths[column - 1] ?? 0, raw.length);

        cell.font = {
          name: SANS,
          size: 10,
          bold: isTotal || isLabel(column),
          italic: isExample,
          color: { argb: isExample ? PALETTE.muted : isLabel(column) ? PALETTE.banner : PALETTE.ink },
        };
        cell.fill = fill(isTotal || isLabel(column) ? PALETTE.cream : index % 2 ? PALETTE.stripe : PALETTE.white);
        cell.alignment = { vertical: 'middle', horizontal: numeric && !sheet.labelColumn ? 'right' : 'left', indent: 1 };
        cell.border = {
          left: thin(PALETTE.line),
          right: thin(PALETTE.line),
          bottom: thin(PALETTE.line),
          ...(isTotal ? { top: { style: 'double' as const, color: { argb: PALETTE.accent } } } : {}),
        };
        if (numeric) {
          cell.numFmt = raw.includes('.') ? '#,##0.00' : '#,##0';
        }

        const choices = sheet.choices?.[column - 1];
        if (choices) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${choices.join(',')}"`],
            showErrorMessage: true,
            errorStyle: 'warning',
            error: translate('Chagua moja ya: {values}', { values: choices.join(', ') }),
          };
        }
      }
    });

    if (body.length === 0) {
      const empty = worksheet.addRow([translate('Hakuna kumbukumbu')]);
      empty.height = 22;
      worksheet.mergeCells(empty.number, 1, empty.number, columnCount);
      Object.assign(empty.getCell(1), {
        font: { name: SERIF, size: 10, italic: true, color: { argb: PALETTE.muted } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { left: thin(PALETTE.line), right: thin(PALETTE.line), bottom: thin(PALETTE.line) },
      });
    }

    const lastRow = worksheet.lastRow?.number ?? headerRow.number;

    if (!options.template && !sheet.labelColumn) {
      worksheet.addRow([]);
      const footer = worksheet.addRow([translate('Jumla ya rekodi: {count}', {
        count: sheet.rows.length - (sheet.totalRow ? 1 : 0),
      })]);
      worksheet.mergeCells(footer.number, 1, footer.number, columnCount);
      footer.getCell(1).font = { name: SERIF, size: 9, italic: true, color: { argb: PALETTE.muted } };
      footer.getCell(1).alignment = { horizontal: 'right' };
    }

    const columnWidths = widths.map((width) => Math.min(Math.max(width + 4, 12), 48));
    // The merged banner shares the table width, so stretch narrow tables until the banner text fits.
    const bannerWidth = Math.max(
      CHAPEL.length * 2 + 8,
      title.length * 1.4 + 6,
      subtitle.length * 1.05 + 6,
      options.template ? 70 : 0,
    );
    const total = columnWidths.reduce((sum, width) => sum + width, 0);
    const scale = total < bannerWidth ? bannerWidth / total : 1;
    worksheet.columns = columnWidths.map((width) => ({ width: Math.round(width * scale) }));

    worksheet.views = [{ state: 'frozen', ySplit: headerRow.number, showGridLines: false }];
    if (body.length > 0 && !sheet.labelColumn) {
      worksheet.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: lastRow, column: columnCount },
      };
    }
    worksheet.pageSetup = {
      orientation: columnCount > 5 ? 'landscape' : 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      printTitlesRow: `${headerRow.number}:${headerRow.number}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    worksheet.headerFooter = { oddFooter: `&L&"${SERIF},Italic"&8${CHAPEL} · ${options.title.replace(/&/g, '&&')}&R&8&P / &N` };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

export interface ReportOptions {
  title: string;
  subtitle: string;
  /** Sheet written for CSV, which only holds one table. Defaults to the first sheet. */
  csvSheet?: number;
}

/** Writes the same sheets in any export format; PDF and print get one section per sheet. */
export async function saveReport(format: ExportFormat, sheets: SheetData[], options: ReportOptions): Promise<void> {
  const filename = datedFilename(options.title);

  if (format === 'xlsx') {
    await saveWorkbook(sheets, `${filename}.xlsx`, options);
    return;
  }

  if (format === 'csv') {
    await saveCsv(sheets[options.csvSheet ?? 0], `${filename}.csv`);
    return;
  }

  await savePdf(
    options.title,
    options.subtitle,
    sheets.map((sheet) => ({
      heading: sheet.name,
      head: sheet.head,
      rows: sheet.rows.length > 0 ? sheet.rows : [[translate('Hakuna kumbukumbu'), ...sheet.head.slice(1).map(() => '')]],
      firstColumnWidth: sheet.labelColumn ? 160 : undefined,
      totalRow: sheet.totalRow && sheet.rows.length > 0,
    })),
    `${filename}.pdf`,
    format === 'print',
  );
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
  const wide = sections.some((section) => section.head.length > 6);
  const doc = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const rgb = (argb: string): [number, number, number] => [
    parseInt(argb.slice(2, 4), 16),
    parseInt(argb.slice(4, 6), 16),
    parseInt(argb.slice(6, 8), 16),
  ];
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const center = width / 2;
  const margin = 40;

  doc.setFillColor(...rgb(PALETTE.banner));
  doc.rect(0, 0, width, 80, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(CHAPEL.toLocaleUpperCase(), center, 38, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(...rgb(PALETTE.gold));
  doc.text(title.toLocaleUpperCase(), center, 62, { align: 'center', maxWidth: width - margin * 2 });
  doc.setFillColor(...rgb(PALETTE.gold));
  doc.rect(0, 80, width, 3, 'F');
  doc.setFillColor(...rgb(PALETTE.cream));
  doc.rect(0, 83, width, 24, 'F');
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...rgb(PALETTE.muted));
  doc.text(
    [subtitle, translate('Imetolewa {date}', { date: localeNow() })].filter(Boolean).join('   ·   '),
    center,
    98,
    { align: 'center', maxWidth: width - margin * 2 },
  );

  sections.forEach((section, index) => {
    let startY = index === 0 ? 136 : (lastY() ?? 136) + 36;

    if (section.heading) {
      if (startY > height - 100) {
        doc.addPage();
        startY = 64;
      }
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...rgb(PALETTE.banner));
      doc.text(section.heading, margin, startY - 10);
      doc.setDrawColor(...rgb(PALETTE.gold));
      doc.setLineWidth(0.8);
      doc.line(margin, startY - 6, margin + 60, startY - 6);
    }

    const lastIndex = section.rows.length - 1;
    autoTable(doc, {
      startY,
      head: [section.head],
      body: section.rows,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 48, bottom: 48 },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: rgb(PALETTE.ink),
        lineColor: rgb(PALETTE.line),
        lineWidth: 0.5,
        cellPadding: 5,
      },
      headStyles: {
        font: 'times',
        fontStyle: 'bold',
        fontSize: 10,
        fillColor: rgb(PALETTE.accent),
        textColor: [255, 255, 255],
        halign: 'center',
        lineColor: rgb(PALETTE.banner),
      },
      alternateRowStyles: { fillColor: rgb(PALETTE.stripe) },
      columnStyles: section.firstColumnWidth
        ? { 0: { cellWidth: section.firstColumnWidth, fontStyle: 'bold', fillColor: rgb(PALETTE.cream) } }
        : {},
      didParseCell: ({ section: part, row, cell }) => {
        if (part !== 'body') {
          return;
        }
        const raw = String(cell.raw ?? '');
        if (NUMERIC.test(raw)) {
          const decimals = raw.includes('.') ? 2 : 0;
          cell.text = [Number(raw).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })];
          if (!section.firstColumnWidth) {
            cell.styles.halign = 'right';
          }
        }
        if (section.totalRow && row.index === lastIndex) {
          cell.styles.fontStyle = 'bold';
          cell.styles.fillColor = rgb(PALETTE.cream);
        }
      },
    });
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rgb(PALETTE.gold));
    doc.setLineWidth(0.6);
    doc.line(margin, height - 32, width - margin, height - 32);
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...rgb(PALETTE.muted));
    doc.text(`${CHAPEL} · ${title}`, margin, height - 20);
    doc.text(`${page} / ${pages}`, width - margin, height - 20, { align: 'right' });
  }

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
