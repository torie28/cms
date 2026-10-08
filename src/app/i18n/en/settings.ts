/** Settings shell, System settings (modules) and Activity logs. */
export const SETTINGS: Record<string, string> = {
  // Settings shell & side menu
  'Mipangilio ya parokia, moduli za mfumo, API na kumbukumbu za shughuli.':
    'Parish settings, system modules, APIs and activity logs.',
  'Washa au zima moduli za mfumo': 'Turn system modules on or off',
  'Nani alifanya nini, na lini': 'Who did what, and when',

  // System settings
  'Moduli za mfumo': 'System modules',
  'Moduli iliyozimwa haionekani kwa mtumiaji yeyote, hata kama amepewa ruhusa.':
    'A disabled module is hidden from every user, even those who have been granted access.',
  'Moduli za msingi haziwezi kuzimwa.': 'Core modules cannot be disabled.',
  'Zimewashwa {enabled} kati ya {total}': '{enabled} of {total} enabled',
  'Ni msimamizi pekee anayeweza kubadilisha moduli.': 'Only an administrator can change modules.',
  'Huna ruhusa ya kubadilisha moduli.': 'You do not have permission to change modules.',
  Msingi: 'Core',
  'watumiaji {count} wamepewa': '{count} users assigned',
  'Zima {label}': 'Disable {label}',
  'Washa {label}': 'Enable {label}',
  'Imeshindwa kubadilisha moduli ya {label}.': 'Could not update the {label} module.',
  'Imeshindwa kupakia moduli.': 'Could not load modules.',
  'Moduli hii ni ya msingi na haiwezi kuzimwa.': 'This is a core module and cannot be disabled.',

  // Default module labels & descriptions (API/app/Support/Modules.php)
  'Muhtasari wa takwimu za parokia.': 'Summary of parish statistics.',
  'Akaunti za watumiaji na nyadhifa zao.': 'User accounts and their roles.',
  'Kumbukumbu za sadaka na michango.': 'Records of offerings and contributions.',
  'Jumuiya ndogo ndogo na wanachama wake.': 'Small Christian Communities and their members.',
  'Kanda za parokia.': 'Parish zones.',
  'Kutuma SMS na arifa kwa waumini, jumuiya, kanda au watumiaji wa mfumo.':
    'Send SMS and notifications to parishioners, communities, zones or system users.',
  'Mipangilio ya mfumo na moduli zake.': 'System settings and modules.',
  'Nyeti: inaonyesha nani alifanya nini na lini. Mpe tu anayehitaji.':
    'Sensitive: shows who did what and when. Grant only to those who need it.',

  // APIs & external services (API/app/Support/ApiSettings.php)
  'API na huduma za nje': 'APIs & external services',
  'SMS, barua pepe na funguo za huduma nyingine': 'SMS, email and other service keys',
  'Nyeti: funguo za SMS, barua pepe na huduma nyingine za nje.':
    'Sensitive: keys for SMS, email and other external services.',
  'Weka funguo za SMS, barua pepe na huduma nyingine hapa bila kuhariri faili la .env.':
    'Set the keys for SMS, email and other services here without editing the .env file.',
  'Sehemu usiyoijaza hapa hutumia thamani ya .env.': 'Any field you leave unset here uses the value from .env.',
  'Ni msimamizi pekee anayeweza kubadilisha mipangilio ya API.': 'Only an administrator can change API settings.',
  'Huna ruhusa ya kubadilisha mipangilio ya API.': 'You do not have permission to change API settings.',
  'Inatuma kweli': 'Live',
  'Majaribio tu': 'Test mode',
  Haijakamilika: 'Incomplete',
  'Inakosa: {fields}': 'Missing: {fields}',
  'Ilibadilishwa na {name}': 'Changed by {name}',
  'imehifadhiwa hapa': 'saved here',
  'Chaguo-msingi': 'Default',
  'Imehifadhiwa {preview} — andika mpya kubadilisha': 'Saved {preview} — type a new one to replace it',
  'Bado haijawekwa': 'Not set yet',
  Onyesha: 'Show',
  Ficha: 'Hide',
  'Rudisha mipangilio ya .env': 'Revert to .env settings',
  'Futa mipangilio ya {label} iliyohifadhiwa hapa na urudi kwenye ile ya faili la .env?':
    'Remove the {label} settings saved here and go back to the ones in the .env file?',
  'Mipangilio ya {label} imehifadhiwa.': '{label} settings saved.',
  'Mipangilio ya {label} imerudishwa kwenye .env.': '{label} settings reverted to .env.',
  'Jaribu kwa kutuma SMS kwenda': 'Test by sending an SMS to',
  'Jaribu kwa kutuma barua pepe kwenda': 'Test by sending an email to',
  'Tuma jaribio': 'Send test',
  'Hifadhi mabadiliko kwanza, kisha ujaribu.': 'Save your changes first, then test.',
  'Imeshindwa kutuma ujumbe wa majaribio.': 'Could not send the test message.',
  'Imeshindwa kupakia mipangilio ya API.': 'Could not load API settings.',
  'Imeshindwa kuhifadhi mipangilio.': 'Could not save the settings.',
  'Mtoa huduma anayetumika kutuma SMS kwa waumini, jumuiya na watumiaji.':
    'The provider used to send SMS to parishioners, communities and users.',
  'Mtoa huduma': 'Provider',
  'Majaribio (huandikwa kwenye log, hazitumwi)': 'Test (written to the log, not sent)',
  'Jina la mtumaji (Sender ID)': 'Sender name (Sender ID)',
  'Herufi zisizozidi 11. Kwa Beem, lazima liwe limeidhinishwa kwenye akaunti yako.':
    'At most 11 characters. For Beem, it must be approved on your account.',
  'Barua pepe (SMTP)': 'Email (SMTP)',
  'Seva ya barua pepe inayotumika kutuma barua kutoka kwenye mfumo.':
    'The mail server used to send email from the system.',
  'Njia ya kutuma': 'Delivery method',
  'Seva (host)': 'Server (host)',
  Usalama: 'Security',
  'Kwa Gmail tumia "App password", si nenosiri la kawaida.': 'For Gmail use an "App password", not your normal password.',
  'Barua pepe ya mtumaji': 'Sender email',
  'Jina la mtumaji': 'Sender name',
  'Huna ruhusa ya kuona mipangilio ya API.': 'You do not have permission to view API settings.',
  'Namba ya simu si sahihi.': 'The phone number is not valid.',
  'Iko kwenye hali ya majaribio: ujumbe umeandikwa kwenye storage/logs/laravel.log, haujatumwa.':
    'Test mode is on: the message was written to storage/logs/laravel.log, not sent.',
  'Ujumbe wa majaribio umetumwa. Hakikisha umeupokea.': 'Test message sent. Check that it arrived.',

  // Activity logs — header & tabs
  'Kuingia, kutoka, mabadiliko, uingizaji na upakuaji wote uliofanyika parokiani.':
    'Every sign-in, sign-out, change, import and download made in the parish.',
  'Sitisha masasisho ya moja kwa moja': 'Pause live updates',
  'Washa masasisho ya moja kwa moja': 'Resume live updates',
  'Moja kwa moja': 'Live',
  Imesitishwa: 'Paused',
  'Aina ya kumbukumbu': 'Log type',
  'Shughuli zote': 'All activity',
  Vilivyofutwa: 'Deleted',
  'Vinavyoweza kurejeshwa': 'Restorable',
  'Kitu kilichofutwa kinaweza kurejeshwa ndani ya': 'A deleted item can be restored within',
  'siku {days}': '{days} days',
  'Baada ya hapo mfumo hukifuta kabisa, lakini maelezo yake hubaki hapa ili yaangaliwe (hakiwezi kurejeshwa tena).':
    'After that the system deletes it permanently, but its details stay here for reference (it can no longer be restored).',
  'Msimamizi pekee ndiye anayeweza kurejesha au kufuta kabisa.':
    'Only an administrator can restore or delete permanently.',
  'Huna ruhusa ya kurejesha au kufuta kabisa.': 'You do not have permission to restore or delete permanently.',
  'Shughuli ya karibuni': 'Latest activity',
  'imesasishwa {time}': 'updated {time}',

  // Activity logs — filters
  'Tafuta mtumiaji, kitendo, kipengele au tarehe…': 'Search user, action, item or date…',
  Kitendo: 'Action',
  'Vitendo vyote': 'All actions',
  'Watumiaji wote': 'All users',
  'Aina ya kipengele': 'Item type',
  'Aina zote': 'All types',
  'Kipindi cha haraka': 'Quick range',
  Leo: 'Today',
  'Siku {days}': '{days} days',
  '{shown} kati ya {total}': '{shown} of {total}',
  'Hali ya vilivyofutwa': 'Deletion status',
  'Zinazoweza kurejeshwa': 'Restorable',
  Zilizorejeshwa: 'Restored',
  'Zilizofutwa kabisa': 'Permanently deleted',
  'Muda umepita': 'Expired',

  // Activity logs — table
  Kipengele: 'Item',
  'Bado hakuna kitu kilichofutwa.': 'Nothing has been deleted yet.',
  'Bado hakuna shughuli. Ingia, au ongeza mtumiaji, kanda au jumuiya ili kuanza kumbukumbu.':
    'No activity yet. Sign in, or add a user, zone or community to start the log.',
  'Hakuna kumbukumbu inayolingana na vichujio hivi.': 'No log entries match these filters.',
  Rejesha: 'Restore',
  'Futa kabisa': 'Delete permanently',
  'Inarejesha…': 'Restoring…',

  // Action labels
  Aliingia: 'Signed in',
  Alitoka: 'Signed out',
  Aliongeza: 'Added',
  Alihariri: 'Edited',
  Alifuta: 'Deleted',
  'Aliingiza (Excel)': 'Imported (Excel)',
  Alipakua: 'Downloaded',
  Alirejesha: 'Restored',
  'Alifuta kabisa': 'Deleted permanently',
  Aliwasha: 'Enabled',
  Alizima: 'Disabled',
  'Alituma ujumbe': 'Sent a message',

  // Subject type labels
  Ujumbe: 'Message',
  'Kuingia/kutoka': 'Sign-in/out',
  mfumo: 'the system',

  // Deletion status
  'Siku 1 imebaki kurejesha': '1 day left to restore',
  'Siku {days} zimebaki kurejesha': '{days} days left to restore',
  'Kimerejeshwa na {name}': 'Restored by {name}',
  'Kimefutwa kabisa baada ya siku {days} · kinaangaliwa tu':
    'Permanently deleted after {days} days · view only',
  'Kimefutwa kabisa na {name} · kinaangaliwa tu': 'Permanently deleted by {name} · view only',
  'Siku {days} zimepita · kinaangaliwa tu': '{days} days have passed · view only',

  // Confirmations & notices
  'Rejesha {type} "{subject}"?': 'Restore {type} "{subject}"?',
  'Futa kabisa "{subject}"? Hatua hii haiwezi kutenduliwa, ingawa maelezo yake yatabaki kwenye kumbukumbu.':
    'Permanently delete "{subject}"? This cannot be undone, although its details will remain in the log.',
  '"{subject}" kimerejeshwa.': '"{subject}" has been restored.',
  '"{subject}" kimefutwa kabisa.': '"{subject}" has been permanently deleted.',
  'Imeshindwa kupakia kumbukumbu za shughuli.': 'Could not load the activity logs.',
  'Imeshindwa kukamilisha kitendo hicho.': 'Could not complete that action.',

  // Relative time
  'sasa hivi': 'just now',
  'sekunde {n} zilizopita': '{n} seconds ago',
  'dakika 1 iliyopita': '1 minute ago',
  'dakika {n} zilizopita': '{n} minutes ago',
  'saa 1 iliyopita': '1 hour ago',
  'saa {n} zilizopita': '{n} hours ago',
  jana: 'yesterday',
  'siku {n} zilizopita': '{n} days ago',

  // Details popup
  'hadi {date}.': 'until {date}.',
  'Baada ya hapo kitafutwa kabisa na kitaweza kuangaliwa tu.':
    'After that it will be deleted permanently and can only be viewed.',
  'Maelezo yaliyo hapa chini ndiyo kumbukumbu pekee iliyobaki; hakiwezi kurejeshwa.':
    'The details below are the only remaining record; it cannot be restored.',
  'Muda wa kurejesha uliisha {date}.': 'The restore window ended {date}.',
  Kilichofutwa: 'Deleted item',
  Mabadiliko: 'Changes',
  Sehemu: 'Field',
  Kabla: 'Before',
  Baada: 'After',

  // Snapshot / change field labels stored by the API
  'Barua pepe': 'Email',
  Aliongezwa: 'Added',
  'Jina la wadhifa': 'Role name',
  Msimbo: 'Code',
  'Idadi ya wanajumuiya': 'Number of members',
  'Kanda (namba)': 'Zone (ID)',

  // API messages (ActivityLogController, Recycle)
  'Huna ruhusa ya kuona kumbukumbu za shughuli.': 'You do not have permission to view the activity logs.',
  'Haiwezi kufutwa kabisa kwa sababu bado kuna kumbukumbu zinazoitegemea (mf. watumiaji waliofutwa wenye wadhifa huu).':
    'It cannot be deleted permanently because other records still depend on it (e.g. deleted users with this role).',
  'Kumbukumbu hii si ya kitu kilichofutwa.': 'This log entry is not for a deleted item.',
  'Kitu hiki tayari kimerejeshwa.': 'This item has already been restored.',
  'Kitu hiki kilishafutwa kabisa.': 'This item has already been deleted permanently.',
  'Siku 30 za kurejesha zimepita. Kitu hiki kinaweza kuangaliwa tu, si kurejeshwa.':
    'The 30-day restore window has passed. This item can only be viewed, not restored.',
  'Kitu hiki hakipo tena kwenye mfumo.': 'This item no longer exists in the system.',
  'Wadhifa wa mtumiaji huyu ulifutwa. Urejeshe wadhifa huo kwanza.':
    "This user's role was deleted. Restore that role first.",
  'Jumuiya yake ilifutwa. Rejesha jumuiya hiyo kwanza.': 'Their community was deleted. Restore that community first.',
};
