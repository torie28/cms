import { COMMON } from './common';
import { JUMUIYA } from './jumuiya';
import { KANDA } from './kanda';
import { LITURGY } from './liturgy';
import { NOAH } from './noah';
import { NOTIFICATIONS } from './notifications';
import { OVERVIEW } from './overview';
import { SADAKA } from './sadaka';
import { SETTINGS } from './settings';
import { USERS } from './users';
import { ZONES_COMMUNITIES } from './zones-communities';

/** Swahili source text → English. One file per area; identical keys must map to identical text. */
export const EN: Readonly<Record<string, string>> = {
  // Spread first so any screen-specific file below overrides these shared defaults.
  ...ZONES_COMMUNITIES,
  ...COMMON,
  ...LITURGY,
  ...USERS,
  ...JUMUIYA,
  ...KANDA,
  ...OVERVIEW,
  ...SETTINGS,
  ...NOTIFICATIONS,
  ...SADAKA,
  ...NOAH,
};
