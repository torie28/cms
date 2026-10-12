<?php

namespace App\Support\Noah;

/**
 * Everything Noah knows about the system. Each topic names the module it lives in and
 * the write actions it needs (none = viewing the module is enough), so Noah can refuse
 * the steps and explain the limitation when the asking user lacks that access.
 *
 * Keywords are matched against the question loosely: a keyword of four or more letters
 * also matches inside a longer word, so "futa" catches "kufuta" and "nimefuta". A keyword
 * with several words matches when every word appears somewhere in the question.
 *
 * When a feature changes, update its topic here so Noah keeps telling the truth.
 */
class Knowledge
{
    /** Words that point at each module, in Swahili and English. */
    public const MODULE_ALIASES = [
        'dashboard' => ['muhtasari', 'dashboard', 'dashibodi', 'overview', 'takwimu', 'statistics', 'stats'],
        'users' => ['watumiaji', 'mtumiaji', 'user', 'users', 'akaunti', 'account', 'wadhifa', 'nyadhifa', 'role', 'roles'],
        'sadaka' => ['sadaka', 'mchango', 'michango', 'offering', 'offerings', 'zaka', 'fungu', 'tithe', 'donation', 'contribution', 'majitoleo', 'makusanyo', 'collection'],
        'jumuiya' => ['jumuiya', 'community', 'communities', 'mwanajumuiya', 'wanajumuiya', 'member', 'members', 'mwenyekiti', 'chairperson', 'scc'],
        'kanda' => ['kanda', 'zone', 'zones'],
        'matukio' => ['matukio', 'tukio', 'event', 'ratiba', 'schedule'],
        'notifications' => ['sms', 'arifa', 'ujumbe', 'message', 'messages', 'notification', 'notifications', 'tangazo', 'announcement'],
        'settings' => ['mipangilio ya mfumo', 'system settings', 'washa moduli', 'zima moduli', 'enable module', 'disable module'],
        'api_settings' => ['api', 'nextsms', 'beem', 'sender id', 'mtoa huduma', 'provider', 'credentials', 'funguo'],
        'activity_logs' => ['kumbukumbu', 'activity', 'audit', 'logs', 'log'],
    ];

    /** Words that point at a write action. */
    public const ACTION_ALIASES = [
        'create' => ['ongeza', 'add', 'create', 'unda', 'sajili', 'register', 'rekodi', 'record', 'new', 'ingiza', 'import', 'tuma', 'send', 'gawanya', 'split'],
        'update' => ['hariri', 'edit', 'update', 'badilisha', 'change', 'rename', 'sahihisha', 'correct', 'hamisha', 'move', 'rejesha', 'restore', 'washa', 'zima', 'enable', 'disable'],
        'delete' => ['futa', 'delete', 'remove', 'ondoa', 'erase', 'purge'],
    ];

    /** Pages, for "open it" links. */
    public const PATHS = [
        'dashboard' => '/dashboard',
        'users' => '/users',
        'sadaka' => '/sadaka',
        'jumuiya' => '/jumuiya',
        'kanda' => '/kanda',
        'matukio' => '/matukio',
        'notifications' => '/notifications',
        'settings' => '/settings/system',
        'api_settings' => '/settings/apis',
        'activity_logs' => '/settings/activity-logs',
    ];

    /** English module names; Swahili names come from the `modules` table, where admins may rename them. */
    public const MODULE_LABELS_EN = [
        'dashboard' => 'Overview',
        'users' => 'Users',
        'sadaka' => 'Offerings',
        'jumuiya' => 'Community',
        'kanda' => 'Zone',
        'matukio' => 'Events',
        'notifications' => 'Notifications & SMS',
        'settings' => 'System settings',
        'api_settings' => 'APIs & external services',
        'activity_logs' => 'Activity logs',
    ];

    public const MODULE_SUMMARIES = [
        'dashboard' => [
            'sw' => 'muhtasari wa takwimu za parokia: watumiaji, jumuiya, wanajumuiya, michango na arifa mpya.',
            'en' => 'a summary of parish figures: users, communities, members, offerings and new notifications.',
        ],
        'users' => [
            'sw' => 'akaunti za watumiaji wa mfumo, nyadhifa zao na moduli wanazoruhusiwa kufungua.',
            'en' => 'system user accounts, their roles and the modules they may open.',
        ],
        'sadaka' => [
            'sw' => 'kumbukumbu za sadaka na michango yote inayopokelewa na parokia.',
            'en' => 'records of every offering and contribution the parish receives.',
        ],
        'jumuiya' => [
            'sw' => 'jumuiya ndogo ndogo za Kikristo, wenyeviti wao na wanajumuiya.',
            'en' => 'small Christian communities, their chairpersons and members.',
        ],
        'kanda' => [
            'sw' => 'kanda za parokia, viongozi wao na jumuiya zilizo ndani ya kila kanda.',
            'en' => 'parish zones, their leaders and the communities inside each zone.',
        ],
        'matukio' => [
            'sw' => 'matukio na ratiba za parokia (inakuja hivi karibuni).',
            'en' => 'parish events and schedules (coming soon).',
        ],
        'notifications' => [
            'sw' => 'kutuma SMS na arifa za mfumo kwa waumini, kanda, jumuiya au watumiaji.',
            'en' => 'sending SMS and in-app notifications to parishioners, zones, communities or users.',
        ],
        'settings' => [
            'sw' => 'kuwasha na kuzima moduli za mfumo kwa watumiaji wote.',
            'en' => 'switching system modules on and off for everyone.',
        ],
        'api_settings' => [
            'sw' => 'funguo za siri za huduma za nje kama mtoa huduma wa SMS. Ni sehemu nyeti.',
            'en' => 'secret keys for external services such as the SMS provider. It is a sensitive area.',
        ],
        'activity_logs' => [
            'sw' => 'nani alifanya nini na lini, pamoja na kurejesha vitu vilivyofutwa. Ni sehemu nyeti.',
            'en' => 'who did what and when, plus restoring deleted records. It is a sensitive area.',
        ],
    ];

    /**
     * Topic shape:
     *   id, module (null = general), actions (write actions required), keywords,
     *   title {sw,en}, answer {sw,en}, optional hint {sw,en} shown when access is refused,
     *   optional related (topic ids offered as follow-ups).
     *
     * @return list<array<string, mixed>>
     */
    public static function topics(): array
    {
        return [
            // ---------------------------------------------------------------- General
            [
                'id' => 'general.access',
                'module' => null,
                'actions' => [],
                'keywords' => ['ruhusa zinavyofanya kazi', 'how access works', 'how permissions work', 'moduli ni nini', 'what is a module', 'wadhifa na ruhusa', 'roles and permissions'],
                'title' => ['sw' => 'Ruhusa zinavyofanya kazi', 'en' => 'How access works'],
                'answer' => [
                    'sw' => "Kila sehemu ya mfumo ni **moduli** (Sadaka, Jumuiya, Kanda, Watumiaji, n.k.).\n\n"
                        ."1. **Msimamizi** anafungua moduli zote zilizowashwa na kufanya kila kitendo.\n"
                        ."2. Mtumiaji mwingine anaona **Muhtasari** pamoja na moduli alizopewa tu.\n"
                        ."3. Ndani ya kila moduli, ruhusa za **Ongeza**, **Hariri** na **Futa** hutolewa moja moja. Ukiwa na moduli bila ruhusa hizo, unaweza kuona tu.\n"
                        ."4. Wadhifa (k.m. Katibu, Mweka hazina) ni cheo tu; ruhusa halisi ni moduli ulizopewa kwenye akaunti yako.\n\n"
                        .'Msimamizi akizima moduli kwenye Mipangilio ya mfumo, haionekani kwa mtu yeyote.',
                    'en' => "Every part of the system is a **module** (Offerings, Communities, Zones, Users, etc.).\n\n"
                        ."1. An **administrator** opens every enabled module and can do every action.\n"
                        ."2. Any other user sees the **Overview** plus only the modules assigned to them.\n"
                        ."3. Inside each module, **Add**, **Edit** and **Delete** are granted separately. With a module but none of these, you can only view it.\n"
                        ."4. A role (e.g. Secretary, Treasurer) is just a title; your real access is the modules assigned to your account.\n\n"
                        .'If an admin switches a module off in System settings, nobody sees it.',
                ],
                'related' => ['noah.access', 'users.update'],
            ],
            [
                'id' => 'general.login',
                'module' => null,
                'actions' => [],
                'keywords' => ['ingia', 'kuingia', 'login', 'log in', 'sign in', 'toka', 'logout', 'log out', 'sign out', 'session', 'kipindi'],
                'title' => ['sw' => 'Kuingia na kutoka', 'en' => 'Signing in and out'],
                'answer' => [
                    'sw' => "Unaingia kwa **jina la mtumiaji** na **nenosiri** ulilopewa na msimamizi.\n\n"
                        ."Kipindi chako kinadumu ndani ya kichupo (tab) hiki tu: ukifunga kichupo, utaombwa kuingia tena.\n\n"
                        .'Kutoka, bofya alama ya mlango iliyo juu kulia, karibu na jina lako.',
                    'en' => "You sign in with the **username** and **password** your administrator gave you.\n\n"
                        ."Your session lives in this browser tab only: close the tab and you will be asked to sign in again.\n\n"
                        .'To sign out, click the door icon at the top right, next to your name.',
                ],
                'related' => ['general.password', 'noah.access'],
            ],
            [
                'id' => 'general.password',
                'module' => null,
                'actions' => [],
                'keywords' => ['nenosiri', 'password', 'nywila', 'nimesahau', 'forgot', 'forgotten', 'reset password'],
                'title' => ['sw' => 'Kubadilisha nenosiri', 'en' => 'Changing a password'],
                'answer' => [
                    'sw' => "Mfumo hauna bado ukurasa wa kujibadilishia nenosiri mwenyewe.\n\n"
                        ."Muombe msimamizi (au mtu mwenye ruhusa ya kuhariri watumiaji) akuwekee jipya: **Watumiaji → Hariri → Nenosiri** (angalau herufi 4). "
                        .'Ukiacha nenosiri wazi wakati wa kuhariri, la zamani linabaki.',
                    'en' => "There is no self-service password page yet.\n\n"
                        ."Ask an administrator (or someone allowed to edit users) to set a new one: **Users → Edit → Password** (at least 4 characters). "
                        .'Leaving the password blank while editing keeps the old one.',
                ],
                'related' => ['users.update', 'general.login'],
            ],
            [
                'id' => 'general.language',
                'module' => null,
                'actions' => [],
                'keywords' => ['lugha', 'language', 'kiingereza', 'english', 'kiswahili', 'swahili', 'tafsiri', 'translate'],
                'title' => ['sw' => 'Kubadilisha lugha', 'en' => 'Changing the language'],
                'answer' => [
                    'sw' => "Bofya kitufe cha **SW / EN** juu kulia. Chaguo lako linahifadhiwa kwenye akaunti yako, hivyo litabaki hata ukiingia kwenye kompyuta nyingine.\n\n"
                        .'Mimi Noah nitakujibu kwa lugha utakayochagua.',
                    'en' => "Click the **SW / EN** button at the top right. Your choice is saved on your account, so it follows you to other computers.\n\n"
                        .'I, Noah, will answer in whichever language you pick.',
                ],
            ],
            [
                'id' => 'general.theme',
                'module' => null,
                'actions' => [],
                'keywords' => ['mandhari', 'theme', 'dark', 'giza', 'usiku', 'light mode', 'dark mode', 'mwanga'],
                'title' => ['sw' => 'Mandhari ya giza au mwanga', 'en' => 'Dark or light theme'],
                'answer' => [
                    'sw' => 'Bofya kitufe cha jua / mwezi kilicho juu kulia kubadilisha kati ya mandhari ya mwanga na ya giza.',
                    'en' => 'Click the sun / moon button at the top right to switch between the light and dark theme.',
                ],
            ],
            [
                'id' => 'general.liturgy',
                'module' => null,
                'actions' => [],
                'keywords' => ['liturujia', 'liturgical', 'liturgy', 'kalenda', 'calendar', 'msimu', 'season', 'rangi ya liturujia', 'liturgical colour', 'mwaka wa kanisa', 'sunday cycle'],
                'title' => ['sw' => 'Kalenda ya liturujia', 'en' => 'Liturgical calendar'],
                'answer' => [
                    'sw' => "Katikati ya kichwa cha ukurasa kuna siku ya liturujia ya leo: jina la siku au sikukuu, kipindi (msimu), rangi ya liturujia (kitone cha rangi) na mwaka wa Dominika (A, B au C).\n\n"
                        .'Inahesabiwa ndani ya mfumo wenyewe, hivyo haihitaji mtandao. Weka kipanya juu yake kuona maelezo zaidi.',
                    'en' => "The middle of the page header shows today's liturgical day: the day or feast name, the season, the liturgical colour (the coloured dot) and the Sunday cycle (A, B or C).\n\n"
                        .'It is calculated inside the app, so it needs no internet. Hover over it for more detail.',
                ],
            ],
            [
                'id' => 'general.offline',
                'module' => null,
                'actions' => [],
                'keywords' => ['offline', 'mtandao', 'internet', 'connection', 'hakuna mtandao', 'haiunganishi', 'imeshindwa kuunganisha', 'server'],
                'title' => ['sw' => 'Mfumo ukikosa mtandao', 'en' => 'When the system goes offline'],
                'answer' => [
                    'sw' => "Mfumo ukishindwa kuifikia seva, unaonyesha skrini ya **nje ya mtandao**. Usifunge ukurasa: mtandao ukirudi, utajipakia upya wenyewe.\n\n"
                        .'Tatizo likiendelea, mjulishe msimamizi wa mfumo kwamba seva ya API haipatikani.',
                    'en' => "If the app cannot reach the server it shows an **offline** screen. Keep the page open: it reloads by itself once the connection returns.\n\n"
                        .'If it persists, tell your system administrator the API server is unreachable.',
                ],
            ],
            [
                'id' => 'general.inbox',
                'module' => null,
                'actions' => [],
                'keywords' => ['kengele', 'bell', 'arifa zangu', 'my notifications', 'inbox', 'ujumbe wangu', 'my messages', 'soma arifa', 'read notifications'],
                'title' => ['sw' => 'Arifa zako (kengele)', 'en' => 'Your notifications (bell)'],
                'answer' => [
                    'sw' => "Kila mtumiaji ana **kengele** juu kulia. Namba nyekundu ni arifa ambazo hujasoma.\n\n"
                        ."1. Bofya kengele kuona arifa zako.\n"
                        ."2. Bofya arifa kuisoma yote; itawekwa kuwa imesomwa.\n"
                        ."3. **Weka zote zimesomwa** huondoa namba nyekundu kwa mara moja.\n\n"
                        .'Hii ni tofauti na moduli ya Arifa na SMS, ambayo ni ya kutuma ujumbe.',
                    'en' => "Every user has a **bell** at the top right. The red number is how many you haven't read.\n\n"
                        ."1. Click the bell to see your notifications.\n"
                        ."2. Click one to read it in full; it is marked as read.\n"
                        ."3. **Mark all as read** clears the red number at once.\n\n"
                        .'This is separate from the Notifications & SMS module, which is for sending messages.',
                ],
                'related' => ['notifications.send'],
            ],
            [
                'id' => 'general.recycle',
                'module' => 'activity_logs',
                'actions' => ['update'],
                'keywords' => ['nimefuta kwa bahati mbaya', 'deleted by mistake', 'accidentally deleted', 'recycle', 'pipa', 'siku 30', '30 days', 'undo', 'rudisha', 'rejesha', 'restore', 'recover', 'rejesha kilichofutwa', 'restore deleted'],
                'title' => ['sw' => 'Kurejesha kilichofutwa', 'en' => 'Getting deleted records back'],
                'answer' => [
                    'sw' => "Watumiaji, nyadhifa, kanda, jumuiya, wanajumuiya na michango hayafutwi moja kwa moja: yanakaa kwenye pipa kwa **siku 30**.\n\n"
                        ."1. Fungua **Mipangilio → Kumbukumbu za shughuli**.\n"
                        ."2. Chagua kichupo cha **Vilivyofutwa**.\n"
                        ."3. Tafuta kitu ulichofuta, kisha bofya **Rejesha**.\n\n"
                        .'Baada ya siku 30 kinafutwa kabisa, lakini maelezo yake yanabaki kwenye kumbukumbu ili uweze kuona kilichokuwa.',
                    'en' => "Users, roles, zones, communities, members and offerings are not removed straight away: they wait in a bin for **30 days**.\n\n"
                        ."1. Open **Settings → Activity logs**.\n"
                        ."2. Pick the **Deleted** tab.\n"
                        ."3. Find what was deleted and click **Restore**.\n\n"
                        .'After 30 days it is gone for good, but a snapshot stays in the log so you can still see what it was.',
                ],
                'hint' => [
                    'sw' => 'Habari njema: kilichofutwa kinaweza kurejeshwa ndani ya siku 30. Mwambie msimamizi akirejeshe mapema.',
                    'en' => 'Good news: deleted records can be restored within 30 days. Ask an administrator to restore it soon.',
                ],
                'related' => ['activity_logs.overview'],
            ],
            [
                'id' => 'general.import_export',
                'module' => null,
                'actions' => [],
                'keywords' => ['excel', 'csv', 'pdf', 'spreadsheet', 'kiolezo', 'template', 'pakua', 'download', 'export', 'chapisha', 'print', 'ripoti', 'report'],
                'title' => ['sw' => 'Kuingiza na kupakua (Excel)', 'en' => 'Import and export (Excel)'],
                'answer' => [
                    'sw' => "**Kupakua:** orodha za Kanda, Jumuiya na Sadaka zinapakuliwa kama Excel, CSV, PDF au kuchapishwa, kupitia kitufe cha **Pakua**.\n\n"
                        ."**Kuingiza:** unaweza kuingiza kanda, jumuiya na wanajumuiya, pamoja na Zaka na Fungu la kumi, kutoka faili la .xlsx, .xls, .ods au .csv. "
                        ."Vichwa vya safu vinaweza kuwa kwa Kiswahili au Kiingereza.\n\n"
                        .'Ushauri: bofya **Pakua kiolezo** kwanza, jaza kiolezo hicho, kisha ukiingize. Mfumo unakuonyesha mistari yenye makosa kabla ya kuhifadhi.',
                    'en' => "**Export:** Zone, Community and Offering lists download as Excel, CSV, PDF or print, using the **Download** button.\n\n"
                        ."**Import:** zones, communities and members, plus Tithe (Zaka) and Fungu la kumi, can be imported from .xlsx, .xls, .ods or .csv files. "
                        ."Column headers may be in Swahili or English.\n\n"
                        .'Tip: click **Download template** first, fill it in, then import it. The app shows rows with problems before anything is saved.',
                ],
                'related' => ['kanda.import', 'jumuiya.import', 'sadaka.import'],
            ],
            [
                'id' => 'matukio.overview',
                'module' => 'matukio',
                'actions' => [],
                'keywords' => ['matukio', 'tukio', 'event', 'ratiba', 'schedule', 'sherehe', 'celebration'],
                'title' => ['sw' => 'Moduli ya Matukio', 'en' => 'The Events module'],
                'answer' => [
                    'sw' => "**Matukio** ni moduli ya kupanga matukio ya parokia, kama misa maalum, mikutano na sherehe.\n\n"
                        .'Kwa sasa **inakuja hivi karibuni**: ukiifungua utaona ukurasa wa "Inakuja hivi karibuni", na bado haina kitendo chochote cha kuongeza au kuhariri.',
                    'en' => "**Events** is the module for planning parish events such as special Masses, meetings and celebrations.\n\n"
                        .'It is **coming soon**: opening it shows a "Coming soon" page, and it has nothing to add or edit yet.',
                ],
            ],

            // ---------------------------------------------------------------- Dashboard
            [
                'id' => 'dashboard.overview',
                'module' => 'dashboard',
                'actions' => [],
                'keywords' => ['muhtasari', 'dashboard', 'overview', 'takwimu', 'chati', 'chart', 'graph', 'grafu', 'ukurasa wa mwanzo', 'home'],
                'title' => ['sw' => 'Ukurasa wa Muhtasari', 'en' => 'The Overview page'],
                'answer' => [
                    'sw' => "**Muhtasari** ni ukurasa wa kwanza baada ya kuingia, na kila mtumiaji anaruhusiwa kuuona.\n\n"
                        ."Unaonyesha jumla ya watumiaji, jumuiya, wanajumuiya na michango, chati ya makusanyo ya kila mwezi (bofya mwezi kuona michango yake), michango ya hivi karibuni na jumuiya kubwa zaidi.\n\n"
                        .'Takwimu za moduli usizo na ruhusa hazitakuwa na viungo vya kuzifungua.',
                    'en' => "The **Overview** is the first page after signing in, and every user may see it.\n\n"
                        ."It shows totals for users, communities, members and offerings, a monthly collections chart (click a month to see its offerings), recent offerings and the largest communities.\n\n"
                        .'Figures for modules you cannot open will not link through to them.',
                ],
            ],

            // ---------------------------------------------------------------- Users
            [
                'id' => 'users.overview',
                'module' => 'users',
                'actions' => [],
                'keywords' => ['orodha ya watumiaji', 'list of users', 'users list', 'watumiaji', 'users'],
                'title' => ['sw' => 'Moduli ya Watumiaji', 'en' => 'The Users module'],
                'answer' => [
                    'sw' => "**Watumiaji** inaonyesha kila akaunti inayoweza kuingia kwenye mfumo: jina, jina la mtumiaji, wadhifa, simu na moduli alizopewa.\n\n"
                        .'Unaweza kutafuta, kuchuja kwa wadhifa au tarehe aliyoongezwa, na kupanga orodha. Kichupo cha **Nyadhifa** kinaonyesha vyeo vilivyopo.',
                    'en' => "**Users** lists every account that can sign in: name, username, role, phone and assigned modules.\n\n"
                        .'You can search, filter by role or date added, and sort the list. The **Roles** tab shows the available titles.',
                ],
                'related' => ['users.create', 'users.update', 'users.roles'],
            ],
            [
                'id' => 'users.create',
                'module' => 'users',
                'actions' => ['create'],
                'keywords' => ['ongeza mtumiaji', 'add user', 'new user', 'create user', 'fungua akaunti', 'create account', 'sajili mtumiaji', 'register user', 'mtumiaji mpya'],
                'title' => ['sw' => 'Kuongeza mtumiaji', 'en' => 'Adding a user'],
                'answer' => [
                    'sw' => "1. Fungua **Watumiaji**, bofya **Ongeza mtumiaji**.\n"
                        ."2. Jaza **jina kamili**, **jina la mtumiaji** (herufi, namba, - na _ tu) na **nenosiri** (angalau herufi 4). Simu, barua pepe na jinsia si lazima.\n"
                        ."3. Chagua **wadhifa** wake.\n"
                        ."4. Weka alama kwenye **moduli** atakazoziona, na kwa kila moja chagua **Ongeza / Hariri / Futa** kama anavyohitaji.\n"
                        ."5. Bofya **Hifadhi**.\n\n"
                        .'Kumbuka: kama wewe si msimamizi, unaweza kumpa moduli na ruhusa ulizo nazo wewe tu, na huwezi kumpa wadhifa wa msimamizi.',
                    'en' => "1. Open **Users** and click **Add user**.\n"
                        ."2. Fill in **full name**, **username** (letters, numbers, - and _ only) and **password** (at least 4 characters). Phone, email and gender are optional.\n"
                        ."3. Choose their **role**.\n"
                        ."4. Tick the **modules** they should see, and for each one choose **Add / Edit / Delete** as needed.\n"
                        ."5. Click **Save**.\n\n"
                        .'Note: if you are not an administrator, you can only grant modules and actions you have yourself, and you cannot make anyone an administrator.',
                ],
                'related' => ['users.update', 'users.roles', 'general.access'],
            ],
            [
                'id' => 'users.update',
                'module' => 'users',
                'actions' => ['update'],
                'keywords' => ['hariri mtumiaji', 'edit user', 'badilisha wadhifa', 'change role', 'mpe moduli', 'give access', 'grant access', 'assign module', 'ongeza ruhusa', 'grant permission', 'mpe ruhusa', 'toa ruhusa'],
                'title' => ['sw' => 'Kuhariri mtumiaji na ruhusa zake', 'en' => "Editing a user and their access"],
                'answer' => [
                    'sw' => "1. Fungua **Watumiaji**, tafuta mtumiaji, bofya **Hariri**.\n"
                        ."2. Badilisha taarifa zake, wadhifa, au nenosiri (ukiliacha wazi, la zamani linabaki).\n"
                        ."3. Kwenye **Moduli**, weka au ondoa alama, na chagua **Ongeza / Hariri / Futa** kwa kila moduli.\n"
                        ."4. Bofya **Hifadhi**. Mabadiliko yanaanza kufanya kazi akipakia ukurasa upya; hahitaji kuingia upya.\n\n"
                        ."Mipaka:\n"
                        ."- Ni **msimamizi** pekee anayeweza kumhariri msimamizi au kumpa mtu wadhifa wa msimamizi.\n"
                        ."- Asiye msimamizi hawezi kujihariri mwenyewe kupitia orodha hii, wala kutoa ruhusa asiyo nayo.",
                    'en' => "1. Open **Users**, find the user and click **Edit**.\n"
                        ."2. Change their details, role, or password (leave it blank to keep the old one).\n"
                        ."3. Under **Modules**, tick or untick, and choose **Add / Edit / Delete** for each module.\n"
                        ."4. Click **Save**. The change applies when they reload the page; no need to sign in again.\n\n"
                        ."Limits:\n"
                        ."- Only an **administrator** can edit an administrator or make someone an administrator.\n"
                        ."- A non-admin cannot edit their own account from this list, or grant access they don't have.",
                ],
                'related' => ['users.create', 'general.access'],
            ],
            [
                'id' => 'users.delete',
                'module' => 'users',
                'actions' => ['delete'],
                'keywords' => ['futa mtumiaji', 'delete user', 'remove user', 'ondoa mtumiaji', 'futa akaunti', 'delete account'],
                'title' => ['sw' => 'Kufuta mtumiaji', 'en' => 'Deleting a user'],
                'answer' => [
                    'sw' => "1. Fungua **Watumiaji**, bofya **Futa** kwenye mstari wa mtumiaji, kisha thibitisha.\n"
                        ."2. Vipindi vyake vyote vinafungwa papo hapo.\n\n"
                        ."Mipaka: huwezi kujifuta mwenyewe, na msimamizi anafutwa na msimamizi tu.\n\n"
                        .'Ukikosea, anaweza kurejeshwa ndani ya siku 30 kutoka **Kumbukumbu za shughuli**.',
                    'en' => "1. Open **Users**, click **Delete** on the user's row and confirm.\n"
                        ."2. All their sessions end immediately.\n\n"
                        ."Limits: you cannot delete yourself, and only an administrator can delete an administrator.\n\n"
                        .'If it was a mistake, they can be restored within 30 days from **Activity logs**.',
                ],
                'related' => ['general.recycle'],
            ],
            [
                'id' => 'users.roles',
                'module' => 'users',
                'actions' => ['create'],
                'keywords' => ['wadhifa', 'nyadhifa', 'role', 'roles', 'ongeza wadhifa', 'add role', 'create role', 'cheo', 'title'],
                'title' => ['sw' => 'Nyadhifa (roles)', 'en' => 'Roles'],
                'answer' => [
                    'sw' => "Wadhifa ni cheo cha mtumiaji (k.m. Katibu, Mweka hazina, Kiongozi wa kanda).\n\n"
                        ."1. Fungua **Watumiaji → Nyadhifa**.\n"
                        ."2. Bofya **Ongeza wadhifa**, andika jina na maelezo, kisha **Hifadhi**.\n"
                        ."3. Utaonekana kwenye orodha unapoongeza au kuhariri mtumiaji.\n\n"
                        ."Muhimu: wadhifa wenyewe haumpi mtu ruhusa. Ruhusa ni moduli unazomchagulia kwenye akaunti yake. Wadhifa wa **Msimamizi** pekee ndio unafungua kila kitu.\n\n"
                        .'Nyadhifa za mfumo (Msimamizi, Mwanachama) haziwezi kufutwa, na wadhifa wenye watumiaji hauwezi kufutwa mpaka uwahamishe.',
                    'en' => "A role is a user's title (e.g. Secretary, Treasurer, Zone leader).\n\n"
                        ."1. Open **Users → Roles**.\n"
                        ."2. Click **Add role**, enter a name and description, then **Save**.\n"
                        ."3. It appears in the list when adding or editing a user.\n\n"
                        ."Important: a role by itself grants nothing. Access comes from the modules you tick on the user's account. Only the **Administrator** role opens everything.\n\n"
                        .'System roles (Administrator, Member) cannot be deleted, and a role still held by users cannot be deleted until they are moved.',
                ],
                'path' => '/users/roles',
                'related' => ['users.create', 'general.access'],
            ],

            // ---------------------------------------------------------------- Kanda
            [
                'id' => 'kanda.overview',
                'module' => 'kanda',
                'actions' => [],
                'keywords' => ['kanda', 'zone', 'zones', 'dashibodi ya kanda', 'zone dashboard', 'kiongozi wa kanda', 'zone leader'],
                'title' => ['sw' => 'Moduli ya Kanda', 'en' => 'The Zones module'],
                'answer' => [
                    'sw' => "**Kanda** ni maeneo ya parokia; kila kanda ina kiongozi na jumuiya moja au zaidi.\n\n"
                        ."- Orodha inaonyesha kila kanda, kiongozi, idadi ya jumuiya na wanajumuiya. Unaweza kuchuja na kupanga.\n"
                        ."- **Tahadhari** zinaonyesha kanda zisizo na kiongozi au zisizo na jumuiya.\n"
                        ."- Bofya **Tazama** kufungua dashibodi ya kanda: jumuiya zake, wanaume/wanawake, na migawanyo ya jumuiya.\n\n"
                        .'Michango ya kanda inaonekana tu kama una ruhusa ya moduli ya Sadaka pia.',
                    'en' => "**Zone** are parish areas; each has a leader and one or more communities.\n\n"
                        ."- The list shows every zone, its leader, number of communities and members. You can filter and sort.\n"
                        ."- **Alerts** point out zones without a leader or without communities.\n"
                        ."- Click **View** to open a zone dashboard: its communities, men/women, and community splits.\n\n"
                        .'Zone offering totals only appear if you also have access to the Offerings module.',
                ],
                'related' => ['kanda.create', 'kanda.split', 'kanda.import'],
            ],
            [
                'id' => 'kanda.create',
                'module' => 'kanda',
                'actions' => ['create'],
                'keywords' => ['ongeza kanda', 'add zone', 'new zone', 'create zone', 'kanda mpya', 'unda kanda'],
                'title' => ['sw' => 'Kuongeza kanda', 'en' => 'Adding a zone'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda**, bofya **Ongeza kanda**.\n"
                        ."2. Andika **jina** (lisijirudie), **kiongozi** na maelezo kama unayo.\n"
                        ."3. Bofya **Hifadhi**.\n\n"
                        .'Una kanda nyingi? Tumia **Ingiza Excel** kuziongeza zote kwa mara moja.',
                    'en' => "1. Open **Zone** and click **Add zone**.\n"
                        ."2. Enter a **name** (must be unique), the **leader** and an optional description.\n"
                        ."3. Click **Save**.\n\n"
                        .'Many zones? Use **Import Excel** to add them all at once.',
                ],
                'related' => ['kanda.import', 'jumuiya.create'],
            ],
            [
                'id' => 'kanda.update',
                'module' => 'kanda',
                'actions' => ['update'],
                'keywords' => ['hariri kanda', 'edit zone', 'badilisha kiongozi', 'change leader', 'badilisha jina la kanda', 'rename zone'],
                'title' => ['sw' => 'Kuhariri kanda', 'en' => 'Editing a zone'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda**, bofya **Hariri** kwenye kanda husika.\n2. Badilisha jina, kiongozi au maelezo.\n3. Bofya **Hifadhi**. Mabadiliko yanaandikwa kwenye kumbukumbu za shughuli.",
                    'en' => "1. Open **Zone** and click **Edit** on the zone.\n2. Change the name, leader or description.\n3. Click **Save**. The change is recorded in the activity log.",
                ],
            ],
            [
                'id' => 'kanda.delete',
                'module' => 'kanda',
                'actions' => ['delete'],
                'keywords' => ['futa kanda', 'delete zone', 'remove zone', 'ondoa kanda'],
                'title' => ['sw' => 'Kufuta kanda', 'en' => 'Deleting a zone'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda**, bofya **Futa** kwenye kanda.\n"
                        ."2. Kama kanda ina jumuiya, mfumo utakuomba uchague **kanda ya kuzihamishia** kwanza, ili zisipotee.\n"
                        ."3. Thibitisha.\n\n"
                        .'Kanda iliyofutwa inaweza kurejeshwa ndani ya siku 30 kutoka Kumbukumbu za shughuli.',
                    'en' => "1. Open **Zone** and click **Delete** on the zone.\n"
                        ."2. If the zone has communities, you must first choose **a zone to move them to**, so none are lost.\n"
                        ."3. Confirm.\n\n"
                        .'A deleted zone can be restored within 30 days from Activity logs.',
                ],
                'related' => ['general.recycle'],
            ],
            [
                'id' => 'kanda.import',
                'module' => 'kanda',
                'actions' => ['create'],
                'keywords' => ['ingiza kanda', 'import zones', 'kanda excel', 'zones excel', 'ingiza jumuiya kwenye kanda'],
                'title' => ['sw' => 'Kuingiza kanda kutoka Excel', 'en' => 'Importing zones from Excel'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda**, bofya **Ingiza Excel**.\n"
                        ."2. Bofya **Pakua kiolezo** na ujaze mstari mmoja kwa kila kanda (jina, kiongozi, maelezo).\n"
                        ."3. **Chagua faili** (.xlsx, .xls, .ods au .csv). Mfumo unaonyesha zitakazoingizwa; kanda zilizopo tayari zinarukwa.\n"
                        ."4. Thibitisha kuingiza.\n\n"
                        .'Ndani ya dashibodi ya kanda pia unaweza kuingiza jumuiya na wanajumuiya wa kanda hiyo kwa Excel.',
                    'en' => "1. Open **Zone** and click **Import Excel**.\n"
                        ."2. Click **Download template** and fill one row per zone (name, leader, description).\n"
                        ."3. **Choose file** (.xlsx, .xls, .ods or .csv). The app previews what will be imported; existing zones are skipped.\n"
                        ."4. Confirm the import.\n\n"
                        .'Inside a zone dashboard you can also import that zone\'s communities and members from Excel.',
                ],
            ],
            [
                'id' => 'kanda.split',
                'module' => 'kanda',
                'actions' => ['create', 'update'],
                'keywords' => ['gawanya kanda', 'split zone', 'kanda kubwa', 'zone too big', 'kugawa kanda'],
                'title' => ['sw' => 'Kugawanya kanda', 'en' => 'Splitting a zone'],
                'answer' => [
                    'sw' => "Kanda ikiwa kubwa sana unaweza kuigawanya:\n\n"
                        ."1. Fungua **Kanda**, bofya **Gawanya** kwenye kanda.\n"
                        ."2. Andika jina la **kanda mpya** na kiongozi wake.\n"
                        ."3. Chagua **jumuiya** zitakazohamia kanda mpya.\n"
                        ."4. Thibitisha. Kanda mpya inakumbuka ilikotoka (\"kutoka …\").\n\n"
                        .'Inahitaji ruhusa za **Ongeza** na **Hariri** kwenye Kanda.',
                    'en' => "If a zone grows too large you can split it:\n\n"
                        ."1. Open **Zone** and click **Split** on the zone.\n"
                        ."2. Enter the **new zone** name and its leader.\n"
                        ."3. Pick the **communities** that move to the new zone.\n"
                        ."4. Confirm. The new zone remembers where it came from (\"from …\").\n\n"
                        .'This needs both **Add** and **Edit** on Zones.',
                ],
            ],

            // ---------------------------------------------------------------- Jumuiya
            [
                'id' => 'jumuiya.overview',
                'module' => 'jumuiya',
                'actions' => [],
                'keywords' => ['jumuiya', 'community', 'communities', 'jumuiya ndogo', 'scc'],
                'title' => ['sw' => 'Moduli ya Jumuiya', 'en' => 'The Communities module'],
                'answer' => [
                    'sw' => "**Jumuiya** ni jumuiya ndogo ndogo za Kikristo; kila moja iko ndani ya kanda na ina mwenyekiti na wanajumuiya (jina, simu, jinsia).\n\n"
                        ."- Tafuta, chuja kwa kanda au kama ina mwenyekiti, na panga kwa jina au idadi ya wanajumuiya.\n"
                        ."- Bofya jumuiya kuona wanajumuiya wake.\n"
                        .'- **Pakua** inakupa orodha ya jumuiya au wanajumuiya kama Excel, CSV, PDF au kuchapisha.',
                    'en' => "**Community** are small Christian communities; each sits in a zone and has a chairperson and members (name, phone, gender).\n\n"
                        ."- Search, filter by zone or whether it has a chairperson, and sort by name or member count.\n"
                        ."- Click a community to see its members.\n"
                        .'- **Download** gives you the community or member list as Excel, CSV, PDF or print.',
                ],
                'related' => ['jumuiya.create', 'jumuiya.members', 'jumuiya.split'],
            ],
            [
                'id' => 'jumuiya.create',
                'module' => 'jumuiya',
                'actions' => ['create'],
                'keywords' => ['ongeza jumuiya', 'add community', 'new community', 'create community', 'jumuiya mpya', 'unda jumuiya', 'sajili jumuiya'],
                'title' => ['sw' => 'Kuongeza jumuiya', 'en' => 'Adding a community'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya**, bofya **Ongeza jumuiya**.\n"
                        ."2. Andika **jina** (lisijirudie), chagua **kanda** na **mwenyekiti**.\n"
                        ."3. Ukitaka, weka idadi ya wanajumuiya kisha ujaze taarifa zao zote kwa pamoja.\n"
                        ."4. Bofya **Hifadhi**.\n\n"
                        .'Lazima kanda iwepo kwanza. Mtu mmoja hawezi kuwa mwenyekiti wa jumuiya mbili.',
                    'en' => "1. Open **Community** and click **Add community**.\n"
                        ."2. Enter a **name** (must be unique), choose the **zone** and **chairperson**.\n"
                        ."3. Optionally set how many members to add, then fill in all their details at once.\n"
                        ."4. Click **Save**.\n\n"
                        .'The zone must exist first. One person cannot chair two communities.',
                ],
                'related' => ['jumuiya.members', 'kanda.create'],
            ],
            [
                'id' => 'jumuiya.update',
                'module' => 'jumuiya',
                'actions' => ['update'],
                'keywords' => ['hariri jumuiya', 'edit community', 'badilisha mwenyekiti', 'change chairperson', 'rename community'],
                'title' => ['sw' => 'Kuhariri jumuiya', 'en' => 'Editing a community'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya**, chagua jumuiya, bofya **Hariri**.\n2. Badilisha jina, kanda, mwenyekiti au maelezo.\n3. Bofya **Hifadhi**.",
                    'en' => "1. Open **Community**, pick the community and click **Edit**.\n2. Change the name, zone, chairperson or description.\n3. Click **Save**.",
                ],
                'related' => ['jumuiya.move'],
            ],
            [
                'id' => 'jumuiya.delete',
                'module' => 'jumuiya',
                'actions' => ['delete'],
                'keywords' => ['futa jumuiya', 'delete community', 'remove community', 'ondoa jumuiya'],
                'title' => ['sw' => 'Kufuta jumuiya', 'en' => 'Deleting a community'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya**, chagua jumuiya, bofya **Futa** na uthibitishe.\n\nJumuiya iliyofutwa inaweza kurejeshwa ndani ya siku 30 kutoka Kumbukumbu za shughuli.",
                    'en' => "1. Open **Community**, pick the community, click **Delete** and confirm.\n\nA deleted community can be restored within 30 days from Activity logs.",
                ],
                'related' => ['general.recycle'],
            ],
            [
                'id' => 'jumuiya.members',
                'module' => 'jumuiya',
                'actions' => ['create'],
                'keywords' => ['ongeza wanajumuiya', 'add member', 'new member', 'wanajumuiya', 'member', 'muumini', 'waumini'],
                'title' => ['sw' => 'Kusimamia wanajumuiya', 'en' => 'Managing members'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya** na uchague jumuiya.\n"
                        ."2. Bofya **Ongeza wanajumuiya**, jaza jina, simu na jinsia, kisha **Hifadhi**.\n"
                        ."3. Kuhariri au kufuta mwanajumuiya, tumia vitufe vilivyo kwenye mstari wake.\n\n"
                        .'Namba ya simu ni muhimu: ndiyo inayotumika kumtumia SMS. Kuhariri kunahitaji ruhusa ya **Hariri**, na kufuta ruhusa ya **Futa**.',
                    'en' => "1. Open **Community** and pick the community.\n"
                        ."2. Click **Add members**, fill in name, phone and gender, then **Save**.\n"
                        ."3. To edit or delete a member, use the buttons on their row.\n\n"
                        .'The phone number matters: it is what SMS messages are sent to. Editing needs **Edit** permission, deleting needs **Delete**.',
                ],
                'related' => ['jumuiya.import', 'notifications.send'],
            ],
            [
                'id' => 'jumuiya.import',
                'module' => 'jumuiya',
                'actions' => ['create'],
                'keywords' => ['ingiza wanajumuiya', 'import members', 'ingiza jumuiya', 'import communities', 'jumuiya excel', 'members excel'],
                'title' => ['sw' => 'Kuingiza wanajumuiya kutoka Excel', 'en' => 'Importing members from Excel'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya** na uchague jumuiya.\n"
                        ."2. Bofya **Ingiza Excel**, kisha **Pakua kiolezo**.\n"
                        ."3. Jaza mstari mmoja kwa kila mwanajumuiya (jina, simu, jinsia).\n"
                        ."4. **Chagua faili**, kagua mistari, kisha thibitisha.\n\n"
                        .'Kuingiza jumuiya nyingi pamoja na wanajumuiya wake, tumia **Ingiza Excel** ndani ya dashibodi ya kanda husika.',
                    'en' => "1. Open **Community** and pick the community.\n"
                        ."2. Click **Import Excel**, then **Download template**.\n"
                        ."3. Fill one row per member (name, phone, gender).\n"
                        ."4. **Choose file**, review the rows, then confirm.\n\n"
                        .'To import many communities along with their members, use **Import Excel** inside the zone\'s dashboard.',
                ],
            ],
            [
                'id' => 'jumuiya.split',
                'module' => 'jumuiya',
                'actions' => ['create', 'update'],
                'keywords' => ['gawanya jumuiya', 'split community', 'jumuiya kubwa', 'community too big', 'kugawa jumuiya'],
                'title' => ['sw' => 'Kugawanya jumuiya', 'en' => 'Splitting a community'],
                'answer' => [
                    'sw' => "Jumuiya ikiwa kubwa unaweza kuigawanya:\n\n"
                        ."1. Fungua **Jumuiya**, chagua jumuiya, bofya **Gawanya**.\n"
                        ."2. Andika jina la **jumuiya mpya**, chagua kanda yake na mwenyekiti.\n"
                        ."3. Chagua **wanajumuiya** watakaohamia jumuiya mpya.\n"
                        ."4. Thibitisha. Jumuiya mpya inaonyesha ilikotoka, na mgawanyo unaonekana kwenye dashibodi ya kanda.\n\n"
                        .'Inahitaji ruhusa za **Ongeza** na **Hariri** kwenye Jumuiya.',
                    'en' => "If a community grows large you can split it:\n\n"
                        ."1. Open **Community**, pick the community and click **Split**.\n"
                        ."2. Enter the **new community** name, choose its zone and chairperson.\n"
                        ."3. Pick the **members** who move to the new community.\n"
                        ."4. Confirm. The new community shows where it came from, and the split appears on the zone dashboard.\n\n"
                        .'This needs both **Add** and **Edit** on Communities.',
                ],
            ],
            [
                'id' => 'jumuiya.move',
                'module' => 'jumuiya',
                'actions' => ['update'],
                'keywords' => ['hamisha jumuiya', 'move community', 'hamisha kanda', 'change zone', 'badilisha kanda ya jumuiya', 'move to another zone'],
                'title' => ['sw' => 'Kuhamisha jumuiya kwenda kanda nyingine', 'en' => 'Moving a community to another zone'],
                'answer' => [
                    'sw' => "1. Fungua **Jumuiya**, chagua jumuiya.\n2. Bofya **Hamisha kanda** na uchague kanda mpya.\n3. Thibitisha. Wanajumuiya wote wanahamia pamoja na jumuiya.",
                    'en' => "1. Open **Community** and pick the community.\n2. Click **Move zone** and choose the new zone.\n3. Confirm. All members move along with the community.",
                ],
            ],

            // ---------------------------------------------------------------- Sadaka
            [
                'id' => 'sadaka.overview',
                'module' => 'sadaka',
                'actions' => [],
                'keywords' => ['sadaka', 'offering', 'offerings', 'michango', 'contributions', 'makusanyo', 'collections', 'daftari la makusanyo', 'jumla ya makusanyo'],
                'title' => ['sw' => 'Moduli ya Sadaka', 'en' => 'The Offerings module'],
                'answer' => [
                    'sw' => "**Sadaka** ni daftari la makusanyo yote ya parokia.\n\n"
                        ."- Chagua **kipindi** juu kuona jumla ya makusanyo, mgawanyo kwa aina na kwa njia ya malipo.\n"
                        ."- Chuja kwa aina, jumuiya au njia ya malipo; panga kwa tarehe au kiasi.\n"
                        ."- **Majitoleo kwa jumuiya** inaonyesha kila jumuiya ilichowasilisha.\n"
                        .'- **Pakua** inakupa ripoti ya Excel, CSV, PDF au kuchapisha.',
                    'en' => "**Offerings** is the parish collections register.\n\n"
                        ."- Pick a **period** at the top to see total collections, split by category and payment method.\n"
                        ."- Filter by category, community or payment method; sort by date or amount.\n"
                        ."- **Community gifts** shows what each community submitted.\n"
                        .'- **Download** gives an Excel, CSV, PDF or printable report.',
                ],
                'related' => ['sadaka.create', 'sadaka.categories', 'sadaka.import'],
            ],
            [
                'id' => 'sadaka.create',
                'module' => 'sadaka',
                'actions' => ['create'],
                'keywords' => ['rekodi mchango', 'record offering', 'ongeza sadaka', 'add offering', 'rekodi sadaka', 'new offering', 'ingiza mchango', 'pokea sadaka', 'rekodi zaka', 'record tithe', 'record zaka', 'rekodi fungu', 'record donation', 'record contribution'],
                'title' => ['sw' => 'Kurekodi mchango', 'en' => 'Recording an offering'],
                'answer' => [
                    'sw' => "1. Fungua **Sadaka**, bofya **Rekodi mchango**.\n"
                        ."2. Chagua **aina ya toleo**, weka **kiasi (TSh)**, **tarehe** (si ya baadaye) na **njia ya malipo** (Taslimu, Pesa kwa simu, Benki, Hundi).\n"
                        ."3. Kwa **Zaka** na **Fungu la kumi**, jina la mtoaji ni lazima. Kwa **Majitoleo ya jumuiya**, chagua jumuiya.\n"
                        ."4. Ukipenda, weka namba ya risiti/muamala na maelezo.\n"
                        .'5. Bofya **Hifadhi**, au **Hifadhi na ongeza nyingine** ukiwa na michango mingi.',
                    'en' => "1. Open **Offerings** and click **Record offering**.\n"
                        ."2. Choose the **category**, enter the **amount (TSh)**, the **date** (not in the future) and the **payment method** (Cash, Mobile money, Bank, Cheque).\n"
                        ."3. For **Zaka** and **Fungu la kumi** the giver's name is required. For **Majitoleo ya jumuiya** (community gifts), pick the community.\n"
                        ."4. Optionally add a receipt/transaction number and notes.\n"
                        .'5. Click **Save**, or **Save and add another** when you have several.',
                ],
                'related' => ['sadaka.categories', 'sadaka.thankyou', 'sadaka.import'],
            ],
            [
                'id' => 'sadaka.categories',
                'module' => 'sadaka',
                'actions' => [],
                'keywords' => ['aina za sadaka', 'categories', 'category', 'aina ya toleo', 'zaka', 'fungu la kumi', 'majitoleo', 'shukrani', 'ujenzi', 'tithe', 'thanksgiving', 'building'],
                'title' => ['sw' => 'Aina za sadaka', 'en' => 'Offering categories'],
                'answer' => [
                    'sw' => "- **Sadaka ya ibada** — makusanyo ya misa.\n"
                        ."- **Zaka** na **Fungu la kumi** — za mtu binafsi; jina la mtoaji ni lazima.\n"
                        ."- **Majitoleo ya jumuiya** (thamani ya vipaji) — lazima yahusishwe na jumuiya.\n"
                        ."- **Shukrani**, **Mchango wa ujenzi**, **Matoleo mengineyo**.\n\n"
                        .'Zaka, Fungu la kumi na Shukrani zikirekodiwa na namba ya simu ya mtoaji, anaweza kutumiwa SMS ya shukrani.',
                    'en' => "- **Sadaka ya ibada** — Mass collections.\n"
                        ."- **Zaka** and **Fungu la kumi** (tithes) — personal; the giver's name is required.\n"
                        ."- **Majitoleo ya jumuiya** (community contributions) — must be linked to a community.\n"
                        ."- **Shukrani** (thanksgiving), **Ujenzi** (building fund), **Mengineyo** (other).\n\n"
                        .'Zaka, Fungu la kumi and Shukrani recorded with the giver\'s phone number can trigger a thank-you SMS.',
                ],
                'related' => ['sadaka.create', 'sadaka.thankyou'],
            ],
            [
                'id' => 'sadaka.thankyou',
                'module' => 'sadaka',
                'actions' => ['create'],
                'keywords' => ['sms ya shukrani', 'thank you sms', 'thank-you', 'thank you message', 'shukuru mtoaji', 'thank giver'],
                'title' => ['sw' => 'SMS ya shukrani kwa mtoaji', 'en' => 'Thank-you SMS to givers'],
                'answer' => [
                    'sw' => "Unaporekodi **Zaka**, **Fungu la kumi** au **Shukrani**:\n\n"
                        ."1. Weka **simu ya mtoaji**.\n"
                        ."2. Weka alama kwenye **Tuma SMS ya shukrani kwa mtoaji**.\n"
                        ."3. Hifadhi. Mtoaji anapokea ujumbe wenye kiasi na tarehe.\n\n"
                        .'Ukiingiza kwa Excel, unaweza kuwatumia watoaji wote wenye namba za simu kwa mara moja. SMS hizi hutozwa gharama, na kila mchango hutumiwa SMS mara moja tu.',
                    'en' => "When recording **Zaka**, **Fungu la kumi** or **Shukrani**:\n\n"
                        ."1. Enter the **giver's phone**.\n"
                        ."2. Tick **Send the giver a thank-you SMS**.\n"
                        ."3. Save. The giver receives a message with the amount and date.\n\n"
                        .'When importing from Excel you can thank every giver with a phone number at once. These SMS cost money, and each offering is thanked only once.',
                ],
            ],
            [
                'id' => 'sadaka.update',
                'module' => 'sadaka',
                'actions' => ['update'],
                'keywords' => ['hariri sadaka', 'edit offering', 'hariri mchango', 'sahihisha kiasi', 'correct amount', 'badilisha mchango'],
                'title' => ['sw' => 'Kuhariri mchango', 'en' => 'Editing an offering'],
                'answer' => [
                    'sw' => "1. Fungua **Sadaka**, tafuta mchango.\n2. Bofya **Hariri**, sahihisha taarifa.\n3. Bofya **Hifadhi**. Kumbukumbu za shughuli zinaonyesha thamani ya kabla na baada.",
                    'en' => "1. Open **Offerings** and find the offering.\n2. Click **Edit** and correct the details.\n3. Click **Save**. The activity log keeps the before and after values.",
                ],
            ],
            [
                'id' => 'sadaka.delete',
                'module' => 'sadaka',
                'actions' => ['delete'],
                'keywords' => ['futa sadaka', 'delete offering', 'futa mchango', 'remove offering'],
                'title' => ['sw' => 'Kufuta mchango', 'en' => 'Deleting an offering'],
                'answer' => [
                    'sw' => "1. Fungua **Sadaka**, bofya **Futa** kwenye mchango na uthibitishe.\n\nUnaweza kuurejesha ndani ya siku 30 kutoka Kumbukumbu za shughuli.",
                    'en' => "1. Open **Offerings**, click **Delete** on the offering and confirm.\n\nIt can be restored within 30 days from Activity logs.",
                ],
                'related' => ['general.recycle'],
            ],
            [
                'id' => 'sadaka.import',
                'module' => 'sadaka',
                'actions' => ['create'],
                'keywords' => ['ingiza zaka', 'import tithe', 'zaka excel', 'fungu la kumi excel', 'ingiza michango', 'import offerings', 'orodha ya zaka'],
                'title' => ['sw' => 'Kuingiza Zaka / Fungu la kumi kutoka Excel', 'en' => 'Importing tithes from Excel'],
                'answer' => [
                    'sw' => "1. Fungua **Sadaka**, chagua aina **Zaka** au **Fungu la kumi**, kisha bofya **Ingiza kutoka Excel**.\n"
                        ."2. **Pakua kiolezo**. Kila mstari ni mtoaji mmoja: jina na kiasi ni lazima; simu, tarehe na risiti ni hiari.\n"
                        ."3. **Chagua faili**. Mfumo unaonyesha mistari iliyo tayari na itakayorukwa.\n"
                        ."4. Ukipenda, weka alama ya kutuma SMS ya shukrani, kisha **Ingiza**.\n\n"
                        .'Tarehe ikikosekana, ya leo inatumika.',
                    'en' => "1. Open **Offerings**, choose **Zaka** or **Fungu la kumi**, then click **Import from Excel**.\n"
                        ."2. **Download template**. Each row is one giver: name and amount are required; phone, date and receipt are optional.\n"
                        ."3. **Choose file**. The app shows rows that are ready and rows that will be skipped.\n"
                        ."4. Optionally tick to send thank-you SMS, then **Import**.\n\n"
                        .'Rows without a date use today\'s date.',
                ],
            ],

            // ---------------------------------------------------------------- Notifications
            [
                'id' => 'notifications.overview',
                'module' => 'notifications',
                'actions' => [],
                'keywords' => ['historia ya ujumbe', 'message history', 'sms zilizotumwa', 'sent messages', 'hali ya sms', 'delivery', 'zimefika', 'delivered'],
                'title' => ['sw' => 'Moduli ya Arifa na SMS', 'en' => 'The Notifications & SMS module'],
                'answer' => [
                    'sw' => "**Arifa na SMS** ina sehemu mbili:\n\n"
                        ."- **Tuma ujumbe** — tunga na tuma SMS au arifa ya mfumo.\n"
                        ."- **Historia** — kila ujumbe uliotumwa, nani aliutuma, wapokeaji, vipande vya SMS, na hali ya kila mpokeaji (imetumwa / imeshindwa). Bofya **Angalia** kuona maelezo.",
                    'en' => "**Notifications & SMS** has two parts:\n\n"
                        ."- **Send message** — compose and send an SMS or in-app notification.\n"
                        .'- **History** — every message sent, who sent it, recipients, SMS segments, and each recipient\'s status (sent / failed). Click **View** for details.',
                ],
                'related' => ['notifications.send', 'notifications.retry'],
            ],
            [
                'id' => 'notifications.send',
                'module' => 'notifications',
                'actions' => ['create'],
                'keywords' => ['tuma sms', 'send sms', 'tuma ujumbe', 'send message', 'tangazo', 'announcement', 'wapokeaji', 'recipients', 'tuma kwa jumuiya', 'tuma kwa kanda', 'tuma kwa wote', 'send to all', 'message to all', 'send to members', 'bulk sms', 'jina lao', 'placeholder', 'violezo'],
                'title' => ['sw' => 'Kutuma SMS au arifa', 'en' => 'Sending an SMS or notification'],
                'answer' => [
                    'sw' => "1. Fungua **Arifa na SMS → Tuma ujumbe**.\n"
                        ."2. Chagua **njia**: SMS, Arifa za mfumo, au zote mbili. (Arifa za mfumo zinafika kwa watumiaji wa mfumo tu; wanajumuiya wanapata SMS.)\n"
                        ."3. Chagua **wapokeaji**: Wote waliosajiliwa, Kanda, Jumuiya, Watumiaji wa mfumo, au Watu maalum (mmoja mmoja au namba za kuandika).\n"
                        ."4. Andika ujumbe, au anza na **kiolezo**. Bofya **+ Weka {jina}** ili kila mtu aone jina lake.\n"
                        ."5. Kagua **onyesho la ujumbe** na idadi ya vipande vya SMS, kisha **Tuma**.\n\n"
                        .'Watu wasio na namba sahihi wanarukwa, na namba zinazojirudia zinatumiwa mara moja tu.',
                    'en' => "1. Open **Notifications & SMS → Send message**.\n"
                        ."2. Choose the **channel**: SMS, in-app notification, or both. (In-app reaches system users only; members get SMS.)\n"
                        ."3. Choose **recipients**: Everyone registered, Zones, Communities, System users, or Specific people (pick or type numbers).\n"
                        ."4. Write the message, or start from a **template**. Click **+ Insert {jina}** so each person sees their own name.\n"
                        ."5. Check the **preview** and SMS segment count, then **Send**.\n\n"
                        .'People without a valid number are skipped, and duplicate numbers receive the message once.',
                ],
                'related' => ['notifications.segments', 'notifications.retry', 'notifications.testmode'],
            ],
            [
                'id' => 'notifications.segments',
                'module' => 'notifications',
                'actions' => [],
                'keywords' => ['vipande', 'segments', 'herufi', 'characters', 'gharama', 'cost', 'urefu wa sms', 'sms length', 'sms ngapi'],
                'title' => ['sw' => 'Vipande vya SMS na gharama', 'en' => 'SMS segments and cost'],
                'answer' => [
                    'sw' => "SMS moja ni hadi **herufi 160**. Ujumbe mrefu unagawanywa vipande, na kila kipande kinatozwa.\n\n"
                        ."Ukitumia alama maalum (k.m. emoji au herufi zisizo za kawaida), kipande kimoja kinashuka hadi **herufi 70**.\n\n"
                        .'Skrini ya kutuma inakuonyesha makadirio ya vipande kabla ya kutuma, ikizingatia urefu wa majina ukitumia {jina}. Ujumbe usizidi herufi 1600.',
                    'en' => "One SMS holds up to **160 characters**. Longer messages are split into segments, and each segment is charged.\n\n"
                        ."Special characters (e.g. emoji or unusual letters) drop a segment to **70 characters**.\n\n"
                        .'The send screen estimates the segments before you send, including name lengths when you use {jina}. Messages are limited to 1600 characters.',
                ],
            ],
            [
                'id' => 'notifications.retry',
                'module' => 'notifications',
                'actions' => ['create'],
                'keywords' => ['sms imeshindwa', 'failed sms', 'retry', 'tuma tena', 'resend', 'zilizoshindwa', 'failed', 'imeshindwa'],
                'title' => ['sw' => 'SMS zilizoshindwa', 'en' => 'Failed SMS'],
                'answer' => [
                    'sw' => "1. Fungua **Arifa na SMS → Historia**, chuja **Zilizoshindwa**.\n"
                        ."2. Bofya **Angalia** kwenye ujumbe kuona wapokeaji walioshindwa na sababu.\n"
                        ."3. Bofya kitufe cha kutuma tena; ni zile zilizoshindwa tu zitakazojaribiwa tena.\n\n"
                        .'Zikiendelea kushindwa, huenda salio la mtoa huduma limeisha au mipangilio ya API si sahihi.',
                    'en' => "1. Open **Notifications & SMS → History** and filter **Failed**.\n"
                        ."2. Click **View** on the message to see which recipients failed and why.\n"
                        ."3. Click the retry button; only the failed ones are tried again.\n\n"
                        .'If they keep failing, the provider balance may be empty or the API settings may be wrong.',
                ],
                'related' => ['notifications.testmode', 'api_settings.sms'],
            ],
            [
                'id' => 'notifications.testmode',
                'module' => 'notifications',
                'actions' => [],
                'keywords' => ['hali ya majaribio', 'test mode', 'sms haziendi', 'sms not arriving', 'hazifiki', 'not delivered', 'haifiki', 'sandbox'],
                'title' => ['sw' => 'SMS hazifiki kwenye simu', 'en' => 'SMS not reaching phones'],
                'answer' => [
                    'sw' => "Ukiona **Hali ya majaribio · SMS haziendi kwenye simu** kwenye skrini ya kutuma, mfumo uko kwenye hali ya majaribio: ujumbe unaandikwa kwenye log tu, hautumwi.\n\n"
                        .'Kuutoa, mwenye ruhusa ya **API na huduma za nje** achague mtoa huduma halisi (NextSMS au Beem Africa) na aweke funguo zake.',
                    'en' => "If the send screen shows **Test mode · SMS do not reach phones**, the system is in test mode: messages are written to a log, not sent.\n\n"
                        .'To leave it, someone with **APIs & external services** access must choose a real provider (NextSMS or Beem Africa) and enter its credentials.',
                ],
                'related' => ['api_settings.sms'],
            ],

            // ---------------------------------------------------------------- Settings
            [
                'id' => 'settings.modules',
                'module' => 'settings',
                'actions' => ['update'],
                'keywords' => ['washa moduli', 'zima moduli', 'enable module', 'disable module', 'turn off module', 'turn on module', 'mipangilio ya mfumo', 'system settings', 'badilisha jina la moduli', 'rename module'],
                'title' => ['sw' => 'Kuwasha na kuzima moduli', 'en' => 'Enabling and disabling modules'],
                'answer' => [
                    'sw' => "1. Fungua **Mipangilio → Mipangilio ya mfumo**.\n"
                        ."2. Tumia swichi kuwasha au kuzima moduli; unaweza pia kubadilisha jina na maelezo yake.\n\n"
                        ."Moduli iliyozimwa inafichwa kwa **kila mtu**, hata msimamizi. Moduli za msingi (Muhtasari, Mipangilio, API, Kumbukumbu za shughuli) haziwezi kuzimwa.",
                    'en' => "1. Open **Settings → System settings**.\n"
                        ."2. Use the switches to turn modules on or off; you can also rename them and edit their description.\n\n"
                        .'A disabled module is hidden from **everyone**, administrators included. Core modules (Overview, Settings, APIs, Activity logs) cannot be disabled.',
                ],
            ],
            [
                'id' => 'api_settings.sms',
                'module' => 'api_settings',
                'actions' => ['update'],
                'keywords' => ['nextsms', 'beem', 'sender id', 'mtoa huduma wa sms', 'sms provider', 'api key', 'funguo', 'credentials', 'api settings', 'mipangilio ya api', 'jina la mtumaji'],
                'title' => ['sw' => 'Kuweka mtoa huduma wa SMS', 'en' => 'Setting up the SMS provider'],
                'answer' => [
                    'sw' => "1. Fungua **Mipangilio → API na huduma za nje**.\n"
                        ."2. Kwenye **SMS**, chagua **mtoa huduma**: NextSMS, Beem Africa, au Majaribio (log).\n"
                        ."3. Weka **Jina la mtumaji (Sender ID)** — herufi zisizozidi 11, sawasawa na lilivyoidhinishwa na mtoa huduma.\n"
                        ."4. Jaza funguo za mtoa huduma uliyemchagua, kisha **Hifadhi**.\n"
                        ."5. Tumia **Jaribu** kutuma SMS ya majaribio kwa namba yako.\n\n"
                        .'Funguo zinahifadhiwa kwa usimbaji fiche (encrypted). Sehemu ukiyoiacha wazi inatumia thamani ya .env.',
                    'en' => "1. Open **Settings → APIs & external services**.\n"
                        ."2. Under **SMS**, choose the **provider**: NextSMS, Beem Africa, or Test (log).\n"
                        ."3. Enter the **Sender ID** — at most 11 characters, exactly as approved by the provider.\n"
                        ."4. Fill in the chosen provider's credentials, then **Save**.\n"
                        ."5. Use **Test** to send a trial SMS to your number.\n\n"
                        .'Credentials are stored encrypted. Fields left blank fall back to the .env values.',
                ],
                'related' => ['notifications.testmode'],
            ],

            // ---------------------------------------------------------------- Activity logs
            [
                'id' => 'activity_logs.overview',
                'module' => 'activity_logs',
                'actions' => [],
                'keywords' => ['kumbukumbu za shughuli', 'activity logs', 'activity log', 'audit', 'nani alifanya', 'who did', 'who changed', 'nani alibadilisha', 'nani alifuta', 'who deleted', 'historia ya mfumo'],
                'title' => ['sw' => 'Kumbukumbu za shughuli', 'en' => 'Activity logs'],
                'answer' => [
                    'sw' => "**Kumbukumbu za shughuli** zinaonyesha kila kuingia, kutoka, kuongeza, kuhariri, kufuta, kuingiza na kupakua kulikofanyika, na nani alifanya na lini.\n\n"
                        ."- Chuja kwa mtumiaji, kitendo, aina ya kipengele au tarehe.\n"
                        ."- Bofya **Angalia** kuona mabadiliko (kabla na baada).\n"
                        .'- Kichupo cha **Vilivyofutwa** kinaonyesha vitu vinavyoweza kurejeshwa.',
                    'en' => "**Activity logs** show every sign-in, sign-out, add, edit, delete, import and export, plus who did it and when.\n\n"
                        ."- Filter by user, action, item type or date.\n"
                        ."- Click **View** to see what changed (before and after).\n"
                        .'- The **Deleted** tab lists items that can still be restored.',
                ],
                'related' => ['general.recycle', 'activity_logs.purge'],
            ],
            [
                'id' => 'activity_logs.purge',
                'module' => 'activity_logs',
                'actions' => ['delete'],
                'keywords' => ['futa kabisa', 'purge', 'permanently delete', 'delete forever', 'delete permanently'],
                'title' => ['sw' => 'Kufuta kabisa', 'en' => 'Deleting permanently'],
                'answer' => [
                    'sw' => "1. Fungua **Kumbukumbu za shughuli → Vilivyofutwa**.\n"
                        ."2. Bofya **Futa kabisa** kwenye kitu na uthibitishe.\n\n"
                        .'Hili haliwezi kurudishwa. Maelezo ya kitu yanabaki kwenye kumbukumbu kwa ajili ya kuangalia tu.',
                    'en' => "1. Open **Activity logs → Deleted**.\n"
                        ."2. Click **Delete permanently** on the item and confirm.\n\n"
                        .'This cannot be undone. A snapshot stays in the log for reference only.',
                ],
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public static function find(string $id): ?array
    {
        foreach (self::topics() as $topic) {
            if ($topic['id'] === $id) {
                return $topic;
            }
        }

        return null;
    }
}
