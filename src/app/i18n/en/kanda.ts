export const KANDA: Record<string, string> = {
  // Kanda page
  'Kanda za parokia. Kila kanda ina jumuiya moja au zaidi.':
    'Parish zones. Each zone has one or more communities.',
  'Ingiza kutoka Excel': 'Import from Excel',
  Chapisha: 'Print',
  'Ongeza kanda': 'Add zone',
  'Inapakia kanda': 'Loading zones',
  'Bado hakuna kanda. Ongeza kanda ya kwanza ya parokia.': 'No zones yet. Add the first parish zone.',
  'Tafuta kanda, kiongozi au maelezo…': 'Search zones, leaders or descriptions…',
  Kiongozi: 'Leader',
  'Zenye kiongozi': 'With a leader',
  'Bila kiongozi': 'Without a leader',
  'Idadi ya jumuiya': 'Number of communities',
  'Idadi ya chini ya jumuiya': 'Minimum number of communities',
  'Idadi ya juu ya jumuiya': 'Maximum number of communities',
  'Jina (A–Z)': 'Name (A–Z)',
  'Jina (Z–A)': 'Name (Z–A)',
  'Jumuiya nyingi kwanza': 'Most communities first',
  'Jumuiya chache kwanza': 'Fewest communities first',
  'Hakuna kanda inayolingana na vichujio hivi.': 'No zones match these filters.',
  'Hakuna kiongozi aliyepangwa': 'No leader assigned',
  'Jumuiya {count}': '{count} communities',
  'Kanda {shown} kati ya {total}': '{shown} of {total} zones',
  'Kanda A': 'Zone A',
  'Hifadhi kanda': 'Save zone',

  // Kanda import
  'Ingiza kanda kutoka Excel': 'Import zones from Excel',
  'Kila mstari ni kanda moja. Safu:': 'Each row is one zone. Columns:',
  'Kanda zilizopo tayari zitarukwa. Inakubali .xlsx, .xls, .ods na .csv.':
    'Zones that already exist will be skipped. Accepts .xlsx, .xls, .ods and .csv.',
  'Chagua faili': 'Choose file',
  'Pakua kiolezo': 'Download template',
  'Tayari kuingiza kanda mpya {count}.': 'Ready to import {count} new zones.',
  '{count} tayari zipo na zitarukwa.': '{count} already exist and will be skipped.',
  'Tahadhari {count}': '{count} warnings',
  'Ipo · itarukwa': 'Exists · will be skipped',
  'Faili hilo halina safu zenye taarifa.': 'That file has no rows with data.',
  'Imeshindwa kusoma faili hilo.': 'Could not read that file.',
  'Faili halina safu ya jina la kanda. Tumia vichwa: {headers}.':
    'The file has no zone name column. Use the headers: {headers}.',
  'Mstari {line}: jina la kanda halipo, umerukwa.': 'Row {line}: zone name is missing, skipped.',
  'Mstari {line}: jina au kiongozi ni ndefu mno, umerukwa.': 'Row {line}: name or leader is too long, skipped.',
  'Mstari {line}: "{name}" imerudiwa kwenye faili, umerukwa.':
    'Row {line}: "{name}" appears more than once in the file, skipped.',
  'Uingizaji umekamilika: kanda mpya {created}.': 'Import complete: {created} new zones.',
  'Uingizaji umekamilika: kanda mpya {created}, zilizorukwa (tayari zipo) {skipped}.':
    'Import complete: {created} new zones, {skipped} skipped (already exist).',

  // Kanda errors
  'Imeshindwa kuingiza kanda hizo.': 'Could not import those zones.',
  'Imeshindwa kuandaa faili la kupakua.': 'Could not prepare the download file.',
  'Imeshindwa kupakia kanda.': 'Could not load zones.',
  'Imeshindwa kuongeza kanda hiyo.': 'Could not add that zone.',
};
