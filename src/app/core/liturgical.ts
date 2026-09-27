/**
 * General Roman Calendar, computed locally (no network). Covers seasons, Sunday and
 * week numbering, the Sunday (A/B/C) and weekday (I/II) cycles, solemnities, feasts
 * and a few memorials important in East Africa, with the standard precedence and
 * transfer rules.
 *
 * Names are Swahili translation keys; seasonal ones carry `{n}` (week/day ordinal) and
 * `{weekday}` placeholders, so render them with `liturgicalName()`.
 */

import { currentLang, translate } from './i18n';

export type LiturgicalColor = 'green' | 'violet' | 'white' | 'red' | 'rose';
export type LiturgicalRank = 'solemnity' | 'feast' | 'memorial' | 'sunday' | 'weekday';
export type LiturgicalSeason = 'advent' | 'christmas' | 'ordinary' | 'lent' | 'triduum' | 'easter';

export interface LiturgicalNameParams {
  n?: number;
  /** 0 = Sunday. */
  weekday?: number;
}

export interface LiturgicalDay {
  name: string;
  nameParams?: LiturgicalNameParams;
  rank: LiturgicalRank;
  /** Sherehe / Sikukuu / Kumbukumbu, or empty for ordinary Sundays and weekdays. */
  rankLabel: string;
  color: LiturgicalColor;
  colorLabel: string;
  colorHex: string;
  season: LiturgicalSeason;
  seasonLabel: string;
  sundayCycle: 'A' | 'B' | 'C';
  weekdayCycle: 'I' | 'II';
}

/** Where the bishops' conference moves these to the following Sunday, set to true. */
const EPIPHANY_ON_SUNDAY = true;
const ASCENSION_ON_SUNDAY = false;
const CORPUS_CHRISTI_ON_SUNDAY = true;

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];
const ORDINALS = ['', 'Kwanza', 'Pili', 'Tatu', 'Nne', 'Tano', 'Sita', 'Saba'];
const EN_UNITS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
const EN_TEENS = ['Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'];
const EN_TENS = ['', '', 'Twenty', 'Thirty'];
const EN_TENS_ORDINAL = ['', '', 'Twentieth', 'Thirtieth'];

function englishOrdinal(n: number): string {
  if (n < 10) return EN_UNITS[n];
  if (n < 20) return EN_TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens >= EN_TENS.length) return `${n}th`;
  return unit === 0 ? EN_TENS_ORDINAL[tens] : `${EN_TENS[tens]}-${EN_UNITS[unit].toLowerCase()}`;
}

const ordinal = (n: number) =>
  currentLang() === 'en' ? englishOrdinal(n) : (ORDINALS[n] ?? String(n));

/** The day's name in the current UI language. */
export function liturgicalName(day: LiturgicalDay): string {
  const { n, weekday } = day.nameParams ?? {};
  return translate(day.name, {
    n: n === undefined ? undefined : ordinal(n),
    weekday: weekday === undefined ? undefined : translate(WEEKDAYS[weekday]),
  });
}

const RANK_LABELS: Record<LiturgicalRank, string> = {
  solemnity: 'Sherehe',
  feast: 'Sikukuu',
  memorial: 'Kumbukumbu',
  sunday: '',
  weekday: '',
};

const COLORS: Record<LiturgicalColor, { label: string; hex: string }> = {
  green: { label: 'Kijani', hex: '#2f7d4f' },
  violet: { label: 'Zambarau', hex: '#6b3fa0' },
  white: { label: 'Nyeupe', hex: '#f4efe2' },
  red: { label: 'Nyekundu', hex: '#b3261e' },
  rose: { label: 'Waridi', hex: '#d9819b' },
};

const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  advent: 'Majilio',
  christmas: 'Kipindi cha Noeli',
  ordinary: 'Kipindi cha Kawaida',
  lent: 'Kwaresima',
  triduum: 'Siku Tatu Kuu za Pasaka',
  easter: 'Kipindi cha Pasaka',
};

interface Celebration {
  name: string;
  rank: 'solemnity' | 'feast' | 'memorial';
  color: LiturgicalColor;
  /** Feasts of the Lord (and a few others) that replace a Sunday in Ordinary Time or Christmas. */
  overridesSunday?: boolean;
}

type Base = Omit<LiturgicalDay, 'rankLabel' | 'colorLabel' | 'colorHex' | 'sundayCycle' | 'weekdayCycle'> & {
  /** Days no feast or memorial can displace (privileged Sundays, Holy Week, Easter octave, Ash Wednesday). */
  privileged?: boolean;
};

// [month, day, name, rank, color, overridesSunday]
const FIXED: [number, number, string, Celebration['rank'], LiturgicalColor, boolean?][] = [
  [1, 25, 'Kuongoka kwa Mt. Paulo, Mtume', 'feast', 'white'],
  [2, 2, 'Kutolewa kwa Bwana Hekaluni', 'feast', 'white', true],
  [2, 22, 'Ukulu wa Mt. Petro, Mtume', 'feast', 'white'],
  [4, 25, 'Mt. Marko, Mwinjili', 'feast', 'red'],
  [5, 1, 'Mt. Yosefu Mfanyakazi', 'memorial', 'white'],
  [5, 3, 'Mt. Filipo na Mt. Yakobo, Mitume', 'feast', 'red'],
  [5, 14, 'Mt. Mathia, Mtume', 'feast', 'red'],
  [5, 31, 'Bikira Maria Kumtembelea Elizabeti', 'feast', 'white'],
  [6, 3, 'Mt. Karoli Lwanga na Wenzake, Mashahidi wa Uganda', 'memorial', 'red'],
  [6, 29, 'Mt. Petro na Mt. Paulo, Mitume', 'solemnity', 'red'],
  [7, 3, 'Mt. Tomaso, Mtume', 'feast', 'red'],
  [7, 22, 'Mt. Maria Magdalena', 'feast', 'white'],
  [7, 25, 'Mt. Yakobo, Mtume', 'feast', 'red'],
  [8, 6, 'Kugeuka Sura kwa Bwana', 'feast', 'white', true],
  [8, 10, 'Mt. Laurenti, Shemasi na Shahidi', 'feast', 'red'],
  [8, 15, 'Kupalizwa Mbinguni kwa Bikira Maria', 'solemnity', 'white'],
  [8, 24, 'Mt. Bartholomayo, Mtume', 'feast', 'red'],
  [9, 8, 'Kuzaliwa kwa Bikira Maria', 'feast', 'white'],
  [9, 14, 'Kutukuka kwa Msalaba Mtakatifu', 'feast', 'red', true],
  [9, 21, 'Mt. Mathayo, Mtume na Mwinjili', 'feast', 'red'],
  [9, 29, 'Malaika Wakuu: Mikaeli, Gabrieli na Rafaeli', 'feast', 'white'],
  [10, 7, 'Bikira Maria wa Rozari', 'memorial', 'white'],
  [10, 18, 'Mt. Luka, Mwinjili', 'feast', 'red'],
  [10, 28, 'Mt. Simoni na Mt. Yuda, Mitume', 'feast', 'red'],
  [11, 1, 'Watakatifu Wote', 'solemnity', 'white'],
  [11, 2, 'Kumbukumbu ya Marehemu Wote', 'memorial', 'violet', true],
  [11, 9, 'Kutabarukiwa kwa Kanisa Kuu la Laterano', 'feast', 'white', true],
  [11, 30, 'Mt. Andrea, Mtume', 'feast', 'red'],
  [12, 26, 'Mt. Stefano, Shahidi wa Kwanza', 'feast', 'red'],
  [12, 27, 'Mt. Yohane, Mtume na Mwinjili', 'feast', 'white'],
  [12, 28, 'Watoto Watakatifu Wasio na Hatia', 'feast', 'red'],
];

const dayNum = (year: number, month: number, day: number) => Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
const weekday = (t: number) => (((t + 4) % 7) + 7) % 7;
const sundayOnOrBefore = (t: number) => t - weekday(t);
const sundayOnOrAfter = (t: number) => t + ((7 - weekday(t)) % 7);
function easter(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayNum(year, month, day);
}

const firstAdventSunday = (year: number) => sundayOnOrBefore(dayNum(year, 12, 24)) - 21;

function epiphany(year: number): number {
  return EPIPHANY_ON_SUNDAY ? sundayOnOrAfter(dayNum(year, 1, 2)) : dayNum(year, 1, 6);
}

function baptismOfTheLord(year: number): number {
  const epi = epiphany(year);
  // When Epiphany falls on 7 or 8 January the Baptism moves to the next day.
  return epi >= dayNum(year, 1, 7) ? epi + 1 : sundayOnOrAfter(epi + 1);
}

function celebrations(year: number): Map<number, Celebration> {
  const map = new Map<number, Celebration>();
  const pascha = easter(year);
  const palm = pascha - 7;
  const sacredHeart = pascha + 68;

  for (const [month, day, name, rank, color, overridesSunday] of FIXED) {
    map.set(dayNum(year, month, day), { name, rank, color, overridesSunday });
  }

  let joseph = dayNum(year, 3, 19);
  if (joseph >= palm && joseph < pascha) {
    joseph = palm - 1;
  } else if (weekday(joseph) === 0) {
    joseph++;
  }
  map.set(joseph, { name: 'Mt. Yosefu, Mume wa Bikira Maria', rank: 'solemnity', color: 'white' });

  let annunciation = dayNum(year, 3, 25);
  if (annunciation >= palm && annunciation <= pascha + 7) {
    annunciation = pascha + 8;
  } else if (weekday(annunciation) === 0) {
    annunciation++;
  }
  map.set(annunciation, { name: 'Kupashwa Habari kwa Bwana', rank: 'solemnity', color: 'white' });

  const baptist = dayNum(year, 6, 24) === sacredHeart ? dayNum(year, 6, 23) : dayNum(year, 6, 24);
  map.set(baptist, { name: 'Kuzaliwa kwa Mt. Yohane Mbatizaji', rank: 'solemnity', color: 'white' });

  let immaculate = dayNum(year, 12, 8);
  if (weekday(immaculate) === 0) {
    immaculate++;
  }
  map.set(immaculate, { name: 'Bikira Maria Mkingiwa Dhambi ya Asili', rank: 'solemnity', color: 'white' });

  map.set(pascha + 50, { name: 'Bikira Maria, Mama wa Kanisa', rank: 'memorial', color: 'white' });
  map.set(pascha + 69, { name: 'Moyo Safi wa Bikira Maria', rank: 'memorial', color: 'white' });

  return map;
}

/** Moveable solemnities and days that always take precedence over anything else. */
function specialDay(t: number, year: number): Base | null {
  const pascha = easter(year);
  const christmas = dayNum(year, 12, 25);
  const special = (
    name: string,
    rank: LiturgicalRank,
    color: LiturgicalColor,
    season: LiturgicalSeason,
  ): Base => ({ name, rank, color, season, seasonLabel: SEASON_LABELS[season], privileged: true });

  const holyFamily = (() => {
    for (let day = christmas + 1; day <= christmas + 6; day++) {
      if (weekday(day) === 0) {
        return day;
      }
    }
    return dayNum(year, 12, 30);
  })();

  const table: [number, () => Base][] = [
    [dayNum(year, 1, 1), () => special('Maria Mtakatifu, Mama wa Mungu', 'solemnity', 'white', 'christmas')],
    [epiphany(year), () => special('Tokeo la Bwana', 'solemnity', 'white', 'christmas')],
    [baptismOfTheLord(year), () => special('Ubatizo wa Bwana', 'feast', 'white', 'christmas')],
    [pascha - 46, () => special('Jumatano ya Majivu', 'weekday', 'violet', 'lent')],
    [pascha - 7, () => special('Dominika ya Matawi ya Mateso ya Bwana', 'sunday', 'red', 'lent')],
    [pascha - 3, () => special('Alhamisi Kuu: Karamu ya Bwana', 'weekday', 'white', 'triduum')],
    [pascha - 2, () => special('Ijumaa Kuu: Mateso ya Bwana', 'weekday', 'red', 'triduum')],
    [pascha - 1, () => special('Jumamosi Kuu', 'weekday', 'violet', 'triduum')],
    [pascha, () => special('Dominika ya Pasaka: Ufufuko wa Bwana', 'solemnity', 'white', 'easter')],
    [pascha + 7, () => special('Dominika ya Pili ya Pasaka (Huruma ya Mungu)', 'sunday', 'white', 'easter')],
    [pascha + (ASCENSION_ON_SUNDAY ? 42 : 39), () => special('Kupaa kwa Bwana', 'solemnity', 'white', 'easter')],
    [pascha + 49, () => special('Pentekoste', 'solemnity', 'red', 'easter')],
    [pascha + 56, () => special('Utatu Mtakatifu', 'solemnity', 'white', 'ordinary')],
    [
      pascha + (CORPUS_CHRISTI_ON_SUNDAY ? 63 : 60),
      () => special('Mwili na Damu Takatifu ya Kristo', 'solemnity', 'white', 'ordinary'),
    ],
    [pascha + 68, () => special('Moyo Mtakatifu wa Yesu', 'solemnity', 'white', 'ordinary')],
    [firstAdventSunday(year) - 7, () => special('Yesu Kristo, Mfalme wa Ulimwengu', 'solemnity', 'white', 'ordinary')],
    [christmas, () => special('Kuzaliwa kwa Bwana (Noeli)', 'solemnity', 'white', 'christmas')],
    [holyFamily, () => special('Familia Takatifu ya Yesu, Maria na Yosefu', 'feast', 'white', 'christmas')],
  ];

  return table.find(([day]) => day === t)?.[1]() ?? null;
}

function seasonalDay(t: number, year: number): Base {
  const pascha = easter(year);
  const ash = pascha - 46;
  const advent = firstAdventSunday(year);
  const christmas = dayNum(year, 12, 25);
  const baptism = baptismOfTheLord(year);
  const wd = weekday(t);
  const isSunday = wd === 0;
  const make = (
    name: string,
    season: LiturgicalSeason,
    color: LiturgicalColor,
    privileged = false,
    nameParams: LiturgicalNameParams = { weekday: wd },
  ): Base => ({
    name,
    nameParams,
    rank: isSunday ? 'sunday' : 'weekday',
    color,
    season,
    seasonLabel: SEASON_LABELS[season],
    privileged,
  });
  const named = (noun: string) =>
    isSunday ? `Dominika ya {n} ya ${noun}` : `{weekday}, Juma la {n} la ${noun}`;
  const weekParams = (week: number): LiturgicalNameParams => ({ n: week, weekday: wd });

  if (t >= advent && t < christmas) {
    const week = Math.floor((t - advent) / 7) + 1;
    return make(named('Majilio'), 'advent', isSunday && week === 3 ? 'rose' : 'violet', isSunday, weekParams(week));
  }

  if (t > christmas) {
    return make('Siku ya {n} ya Oktava ya Noeli', 'christmas', 'white', false, { n: t - christmas + 1 });
  }

  if (t < baptism) {
    const suffix = t > epiphany(year) ? 'baada ya Tokeo la Bwana' : 'wa Kipindi cha Noeli';
    return make(isSunday ? 'Dominika ya Pili baada ya Noeli' : `{weekday} ${suffix}`, 'christmas', 'white');
  }

  if (t < ash) {
    const firstSunday = sundayOnOrAfter(baptism + 1);
    const sunday = sundayOnOrBefore(t);
    const week = sunday <= baptism ? 1 : 2 + (sunday - firstSunday) / 7;
    return make(named('Mwaka'), 'ordinary', 'green', false, weekParams(week));
  }

  if (t < pascha - 7) {
    const firstSunday = ash + 4;
    if (t < firstSunday) {
      return make('{weekday} baada ya Jumatano ya Majivu', 'lent', 'violet');
    }
    const week = Math.floor((t - firstSunday) / 7) + 1;
    return make(named('Kwaresima'), 'lent', isSunday && week === 4 ? 'rose' : 'violet', isSunday, weekParams(week));
  }

  if (t < pascha) {
    return make('{weekday} Kuu', 'lent', 'violet', true);
  }

  if (t <= pascha + 49) {
    if (t < pascha + 7) {
      return { ...make('{weekday} katika Oktava ya Pasaka', 'easter', 'white', true), rank: 'solemnity' };
    }
    const week = Math.floor((t - pascha) / 7) + 1;
    return make(named('Pasaka'), 'easter', 'white', isSunday, weekParams(week));
  }

  const week = 34 - (advent - 7 - sundayOnOrBefore(t)) / 7;
  return make(named('Mwaka'), 'ordinary', 'green', false, weekParams(week));
}

function allowed(base: Base, celebration: Celebration): boolean {
  if (base.privileged) {
    return false;
  }
  if (base.rank === 'sunday') {
    return celebration.rank === 'solemnity' || !!celebration.overridesSunday;
  }
  if (celebration.rank === 'memorial') {
    return base.season !== 'lent';
  }
  return true;
}

export function liturgicalDay(date: Date): LiturgicalDay {
  const year = date.getFullYear();
  const t = dayNum(year, date.getMonth() + 1, date.getDate());
  const liturgicalYear = t >= firstAdventSunday(year) ? year + 1 : year;

  let day: Base = specialDay(t, year) ?? seasonalDay(t, year);
  const celebration = specialDay(t, year) ? undefined : celebrations(year).get(t);

  if (celebration && allowed(day, celebration)) {
    day = { ...day, name: celebration.name, nameParams: undefined, rank: celebration.rank, color: celebration.color };
  }

  return {
    name: day.name,
    nameParams: day.nameParams,
    rank: day.rank,
    rankLabel: RANK_LABELS[day.rank],
    color: day.color,
    colorLabel: COLORS[day.color].label,
    colorHex: COLORS[day.color].hex,
    season: day.season,
    seasonLabel: day.seasonLabel,
    sundayCycle: (['C', 'A', 'B'] as const)[liturgicalYear % 3],
    weekdayCycle: liturgicalYear % 2 === 1 ? 'I' : 'II',
  };
}
