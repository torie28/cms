import { COMMON } from './common';
import { JUMUIYA } from './jumuiya';
import { KANDA } from './kanda';
import { LITURGY } from './liturgy';
import { NOTIFICATIONS } from './notifications';
import { OVERVIEW } from './overview';
import { SADAKA } from './sadaka';
import { SETTINGS } from './settings';
import { USERS } from './users';

/** Swahili source text → English. One file per area; identical keys must map to identical text. */
export const EN: Readonly<Record<string, string>> = {
  ...COMMON,
  ...LITURGY,
  ...USERS,
  ...JUMUIYA,
  ...KANDA,
  ...OVERVIEW,
  ...SETTINGS,
  ...NOTIFICATIONS,
  ...SADAKA,
};
