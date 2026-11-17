import { translate } from './i18n';
import { Offering, OFFERING_CATEGORIES, PAYMENT_METHODS } from './offerings';
import { SheetData } from './spreadsheet';

export const sumOfferings = (offerings: Offering[]) =>
  offerings.reduce((total, offering) => total + Number(offering.amount), 0);

/** Ledger of offerings closed by a grand-total row, used by the PDF export. */
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
