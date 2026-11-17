import { translate } from './i18n';

export type ExportFormat = 'pdf' | 'print';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'print', label: 'Chapisha' },
];

export const FORMAT_NAMES: Record<ExportFormat, string> = {
  pdf: 'PDF',
  print: 'Chapisha',
};

export interface SheetData {
  name: string;
  head: string[];
  rows: string[][];
  /** Styles the last row as a grand total. */
  totalRow?: boolean;
}

export interface PdfSection {
  heading?: string;
  head: string[];
  rows: string[][];
  firstColumnWidth?: number;
  totalRow?: boolean;
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
} as const;

const CHAPEL = 'St. Mathias Naramtoni';

/** Leading zeros (phone numbers) and long digit runs stay text so numbers are not mangled. */
const NUMERIC = /^(0|[1-9]\d{0,13})(\.\d+)?$/;

function localeNow(): string {
  const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'sw-TZ';
  return new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' });
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
