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
        'api_settings' => ['api', 'nextsms', 'beem', 'sewmr', 'sewmrsms', 'sender id', 'mtoa huduma', 'provider', 'credentials', 'funguo'],
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
        'jumuiya' => '/kanda-jumuiya',
        'kanda' => '/kanda-jumuiya',
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
            'sw' => 'jumuiya ndogo ndogo za Kikristo, watu wake na viongozi wao.',
            'en' => 'small Christian communities, their people and their leaders.',
        ],
        'kanda' => [
            'sw' => 'kanda za parokia, viongozi wao, jumuiya zilizo ndani ya kila kanda na takwimu zao.',
            'en' => 'parish zones, their leaders, the communities inside each zone and their statistics.',
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
                        .'Muombe msimamizi (au mtu mwenye ruhusa ya kuhariri watumiaji) akuwekee jipya: **Watumiaji → Hariri → Nenosiri** (angalau herufi 8). '
                        .'Ukiacha nenosiri wazi wakati wa kuhariri, la zamani linabaki.',
                    'en' => "There is no self-service password page yet.\n\n"
                        .'Ask an administrator (or someone allowed to edit users) to set a new one: **Users → Edit → Password** (at least 8 characters). '
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
                        ."Mtu mwenye moduli ya Arifa na SMS pia huona hapa kumbusho la salio la akaunti ya SMS (NextSMS au mtoa huduma mwingine) likishuka hadi kikomo alichoweka.\n\n"
                        .'Hii ni tofauti na moduli ya Arifa na SMS, ambayo ni ya kutuma ujumbe.',
                    'en' => "Every user has a **bell** at the top right. The red number is how many you haven't read.\n\n"
                        ."1. Click the bell to see your notifications.\n"
                        ."2. Click one to read it in full; it is marked as read.\n"
                        ."3. **Mark all as read** clears the red number at once.\n\n"
                        ."Someone who can open Notifications & SMS also sees a reminder here when the SMS account balance (NextSMS or another provider) falls to the limit they set.\n\n"
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
                'id' => 'general.export',
                'module' => null,
                'actions' => [],
                'keywords' => ['excel', 'csv', 'pdf', 'spreadsheet', 'pakua', 'download', 'export', 'chapisha', 'print', 'ripoti', 'report', 'ingiza', 'import'],
                'title' => ['sw' => 'Kupakua ripoti (PDF)', 'en' => 'Downloading reports (PDF)'],
                'answer' => [
                    'sw' => "Ripoti zote zinatoka kama **PDF** au kuchapishwa:\n\n"
                        ."- **Kanda na Jumuiya:** takwimu za kanda au orodha kamili ya jumuiya, kwa kitufe cha **Pakua PDF**.\n"
                        ."- **Sadaka:** ripoti ya makusanyo, kwa kitufe cha **Pakua**.\n\n"
                        .'Mfumo hautumii tena faili za Excel wala CSV. Watu na michango wanaingizwa moja kwa moja kwenye mfumo.',
                    'en' => "All reports come out as **PDF** or print:\n\n"
                        ."- **Zones & Communities:** zone statistics or a community's full list, with the **Download PDF** button.\n"
                        ."- **Offerings:** the collections report, with the **Download** button.\n\n"
                        .'The system no longer uses Excel or CSV files. People and offerings are entered directly in the system.',
                ],
                'related' => ['jumuiya.members', 'sadaka.create'],
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
                        ."Unaonyesha jumla ya watumiaji, jumuiya, wanajumuiya na michango, salio la SMS lililobaki kwa mtoa huduma aliyechaguliwa, chati ya makusanyo ya kila mwezi (bofya mwezi kuona michango yake), michango ya hivi karibuni na jumuiya kubwa zaidi.\n\n"
                        .'Takwimu za moduli usizo na ruhusa hazitakuwa na viungo vya kuzifungua.',
                    'en' => "The **Overview** is the first page after signing in, and every user may see it.\n\n"
                        ."It shows totals for users, communities, members and offerings, the SMS balance left with the selected provider, a monthly collections chart (click a month to see its offerings), recent offerings and the largest communities.\n\n"
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
                        ."2. Jaza **jina kamili**, **jina la mtumiaji** (herufi, namba, - na _ tu) na **nenosiri** (angalau herufi 8). Simu, barua pepe na jinsia si lazima.\n"
                        ."3. Chagua **wadhifa** wake.\n"
                        ."4. Weka alama kwenye **moduli** atakazoziona, na kwa kila moja chagua **Ongeza / Hariri / Futa** kama anavyohitaji.\n"
                        ."5. Bofya **Hifadhi**.\n\n"
                        .'Kumbuka: kama wewe si msimamizi, unaweza kumpa moduli na ruhusa ulizo nazo wewe tu, na huwezi kumpa wadhifa wa msimamizi.',
                    'en' => "1. Open **Users** and click **Add user**.\n"
                        ."2. Fill in **full name**, **username** (letters, numbers, - and _ only) and **password** (at least 8 characters). Phone, email and gender are optional.\n"
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
                'title' => ['sw' => 'Kuhariri mtumiaji na ruhusa zake', 'en' => 'Editing a user and their access'],
                'answer' => [
                    'sw' => "1. Fungua **Watumiaji**, tafuta mtumiaji, bofya **Hariri**.\n"
                        ."2. Badilisha taarifa zake, wadhifa, au nenosiri (ukiliacha wazi, la zamani linabaki).\n"
                        ."3. Kwenye **Moduli**, weka au ondoa alama, na chagua **Ongeza / Hariri / Futa** kwa kila moduli.\n"
                        ."4. Bofya **Hifadhi**. Mabadiliko yanaanza kufanya kazi akipakia ukurasa upya; hahitaji kuingia upya.\n\n"
                        ."Mipaka:\n"
                        ."- Ni **msimamizi** pekee anayeweza kumhariri msimamizi au kumpa mtu wadhifa wa msimamizi.\n"
                        .'- Asiye msimamizi hawezi kujihariri mwenyewe kupitia orodha hii, wala kutoa ruhusa asiyo nayo.',
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

            // ---------------------------------------------------------------- Kanda na Jumuiya
            [
                'id' => 'kanda.overview',
                'module' => 'kanda',
                'actions' => [],
                'keywords' => ['kanda', 'zone', 'zones', 'kanda na jumuiya', 'zones and communities', 'takwimu za kanda', 'zone statistics', 'kanda zote', 'all zones'],
                'title' => ['sw' => 'Kanda na Jumuiya', 'en' => 'Zones & Communities'],
                'answer' => [
                    'sw' => "**Kanda na Jumuiya** ni ukurasa mmoja wa kusimamia kanda, jumuiya zake na watu wake.\n\n"
                        ."- Chagua kanda kwenye kisanduku cha kwanza na jumuiya kwenye cha pili. Kila kisanduku kina sehemu ya kutafuta.\n"
                        ."- **Kanda zote** inaonyesha takwimu za parokia nzima: kanda, jumuiya, watu, wanaume na wanawake.\n"
                        ."- Ukichagua kanda (na **Jumuiya zote**) unaona takwimu na viongozi wa kanda hiyo.\n"
                        ."- Ukichagua jumuiya unaona orodha ya watu wake, yenye namba.\n"
                        .'- **Pakua PDF** inakupa takwimu au orodha kamili.',
                    'en' => "**Zones & Communities** is one page for managing zones, their communities and their people.\n\n"
                        ."- Pick a zone in the first box and a community in the second. Each box has its own search.\n"
                        ."- **All zones** shows whole-parish statistics: zones, communities, people, men and women.\n"
                        ."- Pick a zone (with **All communities**) to see that zone's statistics and leaders.\n"
                        ."- Pick a community to see its numbered list of people.\n"
                        .'- **Download PDF** gives you the statistics or the full list.',
                ],
                'related' => ['kanda.create', 'jumuiya.members', 'jumuiya.roles'],
            ],
            [
                'id' => 'kanda.create',
                'module' => 'kanda',
                'actions' => ['create'],
                'keywords' => ['ongeza kanda', 'add zone', 'new zone', 'create zone', 'kanda mpya', 'unda kanda'],
                'title' => ['sw' => 'Kuongeza kanda', 'en' => 'Adding a zone'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda na Jumuiya** na ufungue kisanduku cha kanda.\n"
                        ."2. Bofya **+ Ongeza kanda**.\n"
                        ."3. Andika jina la kanda mpya (lisijirudie) kisha bofya **Hifadhi**.\n\n"
                        .'Viongozi wa kanda hawaandikwi hapa: wanapewa wadhifa wa kanda kwenye mstari wao kama watu wa jumuiya.',
                    'en' => "1. Open **Zones & Communities** and open the zone box.\n"
                        ."2. Click **+ Add zone**.\n"
                        ."3. Type the new zone's name (must be unique) and click **Save**.\n\n"
                        .'Zone leaders are not typed here: they are people in a community who are given a zone role on their row.',
                ],
                'related' => ['jumuiya.create', 'jumuiya.roles'],
            ],
            [
                'id' => 'jumuiya.overview',
                'module' => 'jumuiya',
                'actions' => [],
                'keywords' => ['jumuiya', 'community', 'communities', 'jumuiya ndogo', 'scc', 'jumuiya zote', 'all communities'],
                'title' => ['sw' => 'Jumuiya', 'en' => 'Communities'],
                'answer' => [
                    'sw' => "**Jumuiya** ni jumuiya ndogo ndogo za Kikristo; kila moja iko ndani ya kanda. Zinasimamiwa kwenye ukurasa wa **Kanda na Jumuiya**.\n\n"
                        ."- Chagua kanda, kisha jumuiya, kuona watu wake.\n"
                        ."- Kila mtu ana majina, jinsia, simu, wadhifa wa kanda na wadhifa wa jumuiya.\n"
                        .'- **Pakua PDF** inakupa orodha ya jumuiya hiyo.',
                    'en' => "**Communities** are small Christian communities; each sits in a zone. They are managed on the **Zones & Communities** page.\n\n"
                        ."- Pick a zone, then a community, to see its people.\n"
                        ."- Each person has names, gender, phone, a zone role and a community role.\n"
                        .'- **Download PDF** gives you that community\'s list.',
                ],
                'related' => ['jumuiya.create', 'jumuiya.members', 'jumuiya.search'],
            ],
            [
                'id' => 'jumuiya.create',
                'module' => 'jumuiya',
                'actions' => ['create'],
                'keywords' => ['ongeza jumuiya', 'add community', 'new community', 'create community', 'jumuiya mpya', 'unda jumuiya', 'sajili jumuiya'],
                'title' => ['sw' => 'Kuongeza jumuiya', 'en' => 'Adding a community'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda na Jumuiya** na uchague **kanda** jumuiya itakapokaa.\n"
                        ."2. Fungua kisanduku cha jumuiya, bofya **+ Ongeza jumuiya**.\n"
                        ."3. Andika jina (lisijirudie) kisha bofya **Hifadhi**.\n\n"
                        .'Lazima kanda iwepo kwanza.',
                    'en' => "1. Open **Zones & Communities** and pick the **zone** the community belongs to.\n"
                        ."2. Open the community box and click **+ Add community**.\n"
                        ."3. Type the name (must be unique) and click **Save**.\n\n"
                        .'The zone must exist first.',
                ],
                'related' => ['jumuiya.members', 'kanda.create'],
            ],
            [
                'id' => 'jumuiya.members',
                'module' => 'jumuiya',
                'actions' => ['create'],
                'keywords' => ['ongeza wanajumuiya', 'ongeza mtu', 'add person', 'add member', 'new member', 'wanajumuiya', 'member', 'muumini', 'waumini', 'hariri mtu', 'edit person', 'futa mtu', 'delete person'],
                'title' => ['sw' => 'Kuongeza na kusimamia watu', 'en' => 'Adding and managing people'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda na Jumuiya**, chagua kanda kisha jumuiya.\n"
                        ."2. Bofya **+ Ongeza mtu**. Mstari mpya unafunguka chini ya orodha.\n"
                        ."3. Jaza **jina la kwanza** na **la ukoo** (lazima), la kati (hiari), jinsia, wadhifa wa kanda, wadhifa wa jumuiya na simu.\n"
                        ."4. Bonyeza **Enter** kwenda kisanduku kinachofuata; Enter ya mwisho inahifadhi na kufungua mstari mwingine.\n"
                        ."5. Kuhariri au kufuta mtu, tumia vitufe vilivyo kwenye mstari wake.\n\n"
                        .'Simu inaanza na +255 yenyewe; andika namba iliyobaki tu (namba za nchi nyingine zinakubalika). Simu ndiyo inayotumika kumtumia SMS.',
                    'en' => "1. Open **Zones & Communities**, pick a zone and then a community.\n"
                        ."2. Click **+ Add person**. A new row opens at the bottom of the list.\n"
                        ."3. Fill in **first name** and **surname** (required), middle name (optional), gender, zone role, community role and phone.\n"
                        ."4. Press **Enter** to move to the next box; the last Enter saves and opens a fresh row.\n"
                        ."5. To edit or delete a person, use the buttons on their row.\n\n"
                        .'The phone starts with +255 for you; type the rest of the number (other countries\' numbers are accepted). The phone is what SMS messages are sent to.',
                ],
                'related' => ['jumuiya.roles', 'jumuiya.search', 'notifications.send'],
            ],
            [
                'id' => 'jumuiya.roles',
                'module' => 'jumuiya',
                'actions' => ['update'],
                'keywords' => ['viongozi', 'leaders', 'leadership', 'mwenyekiti', 'chairperson', 'katibu', 'secretary', 'mweka hazina', 'treasurer', 'kiongozi wa kanda', 'zone leader', 'kiongozi wa jumuiya', 'community leader', 'katibu wa jumuiya', 'mwenyekiti wa jumuiya', 'mweka hazina wa jumuiya', 'katibu wa kanda', 'mwenyekiti wa kanda', 'community secretary', 'community chairperson', 'zone chairperson', 'zone secretary'],
                'title' => ['sw' => 'Viongozi wa kanda na jumuiya', 'en' => 'Zone and community leaders'],
                'answer' => [
                    'sw' => "Viongozi ni watu wa kawaida wa jumuiya waliopewa wadhifa. Kila mtu ana nyadhifa mbili zinazojitegemea: **wadhifa wa kanda** na **wadhifa wa jumuiya**.\n\n"
                        ."Nyadhifa ni: **Mwenyekiti**, **M/Mwenyekiti**, **Katibu**, **M/Katibu** na **Mweka Hazina**. Asiye na wadhifa ni **Mwanajumuiya wa kawaida**.\n\n"
                        ."- Kila wadhifa una mtu mmoja tu kwa kila jumuiya, na mmoja tu kwa kila kanda.\n"
                        ."- Mtu mmoja anaweza kuwa kiongozi wa jumuiya na wa kanda kwa pamoja.\n\n"
                        .'Kumpa mtu wadhifa: hariri mstari wake na uchague wadhifa kwenye safu husika.',
                    'en' => "Leaders are ordinary community members who hold a role. Each person has two independent roles: a **zone role** and a **community role**.\n\n"
                        ."The roles are **Chairperson**, **V/Chairperson**, **Secretary**, **V/Secretary** and **Treasurer**. Anyone without one is an **Ordinary member**.\n\n"
                        ."- Each role has only one holder per community, and one per zone.\n"
                        ."- The same person can lead their community and their zone at the same time.\n\n"
                        .'To give someone a role: edit their row and pick the role in the matching column.',
                ],
                'related' => ['jumuiya.members'],
            ],
            [
                'id' => 'jumuiya.search',
                'module' => 'jumuiya',
                'actions' => [],
                'keywords' => ['tafuta mtu', 'find person', 'search person', 'tafuta mwanajumuiya', 'find member', 'search member', 'yuko jumuiya gani', 'which community'],
                'title' => ['sw' => 'Kumtafuta mtu', 'en' => 'Finding a person'],
                'answer' => [
                    'sw' => "1. Fungua **Kanda na Jumuiya**.\n"
                        ."2. Andika jina kwenye kisanduku cha **Tafuta mtu kwa jina…** juu.\n"
                        ."3. Chagua jina kwenye orodha: mfumo unafungua kanda na jumuiya yake na kumwangazia.\n\n"
                        .'Utafutaji unavumilia makosa madogo ya tahajia na unafanya kazi kwa jina la lugha yoyote. Kanda na jumuiya zinatafutwa ndani ya visanduku vyake.',
                    'en' => "1. Open **Zones & Communities**.\n"
                        ."2. Type a name in the **Search a person by name…** box at the top.\n"
                        ."3. Pick the name from the list: the app opens their zone and community and highlights them.\n\n"
                        .'The search forgives small spelling mistakes and works for names in any language. Zones and communities are searched inside their own boxes.',
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
                        .'- **Pakua** inakupa ripoti ya PDF au kuchapisha.',
                    'en' => "**Offerings** is the parish collections register.\n\n"
                        ."- Pick a **period** at the top to see total collections, split by category and payment method.\n"
                        ."- Filter by category, community or payment method; sort by date or amount.\n"
                        ."- **Community gifts** shows what each community submitted.\n"
                        .'- **Download** gives a PDF or printable report.',
                ],
                'related' => ['sadaka.create', 'sadaka.categories', 'general.export'],
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
                'related' => ['sadaka.categories', 'sadaka.thankyou'],
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
                        .'Sadaka, Zaka, Fungu la kumi, Majitoleo, Shukrani na Ujenzi zikirekodiwa na namba ya simu ya mtoaji, anaweza kutumiwa SMS ya shukrani. Hariri maandishi kwenye Arifa na SMS → Violezo.',
                    'en' => "- **Sadaka ya ibada** — Mass collections.\n"
                        ."- **Zaka** and **Fungu la kumi** (tithes) — personal; the giver's name is required.\n"
                        ."- **Majitoleo ya jumuiya** (community contributions) — must be linked to a community.\n"
                        ."- **Shukrani** (thanksgiving), **Ujenzi** (building fund), **Mengineyo** (other).\n\n"
                        .'Sadaka, Zaka, Fungu la kumi, Majitoleo, Shukrani and Ujenzi recorded with the giver\'s phone number can trigger a thank-you SMS. Edit the wording under Notifications → Templates.',
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
                    'sw' => "Unaporekodi **Sadaka**, **Zaka**, **Fungu la kumi**, **Majitoleo**, **Shukrani** au **Ujenzi**:\n\n"
                        ."1. Weka **simu ya mtoaji**.\n"
                        ."2. Weka alama kwenye **Tuma SMS ya shukrani kwa mtoaji**.\n"
                        ."3. Hifadhi. Mtoaji anapokea ujumbe wenye kiasi na tarehe (kutoka kiolezo cha shukrani).\n\n"
                        ."Hariri maandishi kwenye **Arifa na SMS → Violezo** (aina: SMS ya shukrani). Tumia **{jina}**, **{kiasi}** na **{tarehe}**.\n\n"
                        .'SMS hizi hutozwa gharama, na kila mchango hutumiwa SMS mara moja tu.',
                    'en' => "When recording **Mass collection**, **Zaka**, **tithe**, **community gifts**, **thanksgiving** or **building fund**:\n\n"
                        ."1. Enter the **giver's phone**.\n"
                        ."2. Tick **Send the giver a thank-you SMS**.\n"
                        ."3. Save. The giver receives a message with the amount and date (from the thank-you template).\n\n"
                        ."Edit the wording under **Notifications & SMS → Templates** (type: Thank-you SMS). Use **{jina}**, **{kiasi}** and **{tarehe}**.\n\n"
                        .'These SMS cost money, and each offering is thanked only once.',
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

            // ---------------------------------------------------------------- Notifications
            [
                'id' => 'notifications.overview',
                'module' => 'notifications',
                'actions' => [],
                'keywords' => ['historia ya ujumbe', 'message history', 'sms zilizotumwa', 'sent messages', 'hali ya sms', 'delivery', 'zimefika', 'delivered'],
                'title' => ['sw' => 'Moduli ya Arifa na SMS', 'en' => 'The Notifications & SMS module'],
                'answer' => [
                    'sw' => "**Arifa na SMS** ina sehemu tatu:\n\n"
                        ."- **Tuma ujumbe** — tunga na tuma SMS au arifa ya mfumo.\n"
                        ."- **Violezo** — unda na hariri violezo vya kutuma, pamoja na SMS za shukrani.\n"
                        .'- **Historia** — kila ujumbe uliotumwa, nani aliutuma, wapokeaji, vipande vya SMS, na hali ya kila mpokeaji (imetumwa / imeshindwa). Bofya **Angalia** kuona maelezo.',
                    'en' => "**Notifications & SMS** has three parts:\n\n"
                        ."- **Send message** — compose and send an SMS or in-app notification.\n"
                        ."- **Templates** — create and edit send templates and thank-you SMS.\n"
                        .'- **History** — every message sent, who sent it, recipients, SMS segments, and each recipient\'s status (sent / failed). Click **View** for details.',
                ],
                'related' => ['notifications.send', 'notifications.templates', 'notifications.retry'],
            ],
            [
                'id' => 'notifications.send',
                'module' => 'notifications',
                'actions' => ['create'],
                'keywords' => ['tuma sms', 'send sms', 'tuma ujumbe', 'send message', 'tangazo', 'announcement', 'wapokeaji', 'recipients', 'tuma kwa jumuiya', 'tuma kwa kanda', 'tuma kwa wote', 'send to all', 'message to all', 'send to members', 'bulk sms', 'jina lao', 'placeholder', 'violezo', 'mada ya ujumbe', 'ujumbe unahusu', 'what the message is about', 'message subject'],
                'title' => ['sw' => 'Kutuma SMS au arifa', 'en' => 'Sending an SMS or notification'],
                'answer' => [
                    'sw' => "1. Fungua **Arifa na SMS → Tuma ujumbe**.\n"
                        ."2. Chagua **njia**: SMS, Arifa za mfumo, au zote mbili. (Arifa za mfumo zinafika kwa watumiaji wa mfumo tu; wanajumuiya wanapata SMS.)\n"
                        ."3. Chagua **wapokeaji**: Wote waliosajiliwa, Kanda, Jumuiya, Watumiaji wa mfumo, au Watu maalum (mmoja mmoja au namba za kuandika). Ukichagua Kanda au Jumuiya, wanajumuiya wake wanachaguliwa wenyewe. Kisanduku cha **Wote** kinawachagua wote tena; ondoa alama kwa asiyepaswa kupokea.\n"
                        ."4. Chagua **ujumbe unahusu nini**: tangazo (misa, mkutano, matukio) au mchango (sadaka, zaka, fungu la kumi, majitoleo, shukrani, ujenzi). Kiolezo cha **shukrani** kinajazwa chenyewe kwa michango; unaweza kukihariri au kuchagua kiolezo kilichohifadhiwa. **{jina}** hubadilishwa na jina la kila mtu kutoka kwenye orodha.\n"
                        ."5. Kagua **onyesho la ujumbe** na idadi ya vipande vya SMS, kisha **Tuma**.\n\n"
                        .'Watu wasio na namba sahihi wanarukwa, na namba zinazojirudia zinatumiwa mara moja tu.',
                    'en' => "1. Open **Notifications & SMS → Send message**.\n"
                        ."2. Choose the **channel**: SMS, in-app notification, or both. (In-app reaches system users only; members get SMS.)\n"
                        ."3. Choose **recipients**: Everyone registered, Zones, Communities, System users, or Specific people (pick or type numbers). Choosing a zone or community selects its members automatically. The **All** box selects them all again; untick anyone who should not receive it.\n"
                        ."4. Choose **what the message is about**: an announcement (Mass, meeting, events) or a contribution (Mass collection, Zaka, tithe, community gifts, thanksgiving, building fund). A **thank-you** template is filled in for contributions; you can edit it or pick a saved template. **{jina}** is replaced with each person's name from the register.\n"
                        ."5. Check the **preview** and SMS segment count, then **Send**.\n\n"
                        .'People without a valid number are skipped, and duplicate numbers receive the message once.',
                ],
                'related' => ['notifications.templates', 'notifications.balance', 'notifications.segments', 'notifications.retry', 'notifications.testmode'],
            ],
            [
                'id' => 'notifications.templates',
                'module' => 'notifications',
                'actions' => ['create'],
                'keywords' => ['violezo', 'kiolezo', 'templates', 'message template', 'sms template', 'thank you template', 'kiolezo cha shukrani', 'hariri kiolezo', 'unda kiolezo'],
                'title' => ['sw' => 'Violezo vya ujumbe', 'en' => 'Message templates'],
                'answer' => [
                    'sw' => "1. Fungua **Arifa na SMS → Violezo**.\n"
                        ."2. Chagua **aina**: Kutuma ujumbe (kwa matangazo na shukrani za mkusanyiko) au **SMS ya shukrani** (inayotumwa kiotomatiki baada ya kurekodi mchango).\n"
                        ."3. Chagua **mada**, andika **jina** na **maandishi**. Tumia **{jina}**; kwa SMS ya shukrani ongeza **{kiasi}** na **{tarehe}**.\n"
                        ."4. Weka alama **Tumia kama chaguo-msingi** ikiwa unataka kiolezo hiki kujazwa chenyewe.\n"
                        ."5. **Hifadhi**. Violezo vya mfumo vinaweza kuhaririwa lakini haviwezi kufutwa.\n\n"
                        .'Michango (sadaka, zaka, fungu la kumi, majitoleo, shukrani, ujenzi) hutumia lugha ya shukrani kwa kushiriki.',
                    'en' => "1. Open **Notifications & SMS → Templates**.\n"
                        ."2. Choose the **type**: Sending a message (broadcasts and thank-yous) or **Thank-you SMS** (sent automatically after recording a contribution).\n"
                        ."3. Choose the **subject**, enter a **name** and **text**. Use **{jina}**; for thank-you SMS also add **{kiasi}** and **{tarehe}**.\n"
                        ."4. Tick **Use as the default** if this template should fill in automatically.\n"
                        ."5. **Save**. System templates can be edited but not deleted.\n\n"
                        .'Contribution subjects (Mass collection, Zaka, tithe, community gifts, thanksgiving, building fund) use thank-you wording for taking part.',
                ],
                'related' => ['notifications.send', 'sadaka.thankyou'],
            ],
            [
                'id' => 'notifications.balance',
                'module' => 'dashboard',
                'actions' => [],
                'keywords' => ['salio', 'balance', 'sms zilizobaki', 'remaining sms', 'credits', 'credit', 'salio la sms', 'sms ngapi zimebaki', 'how many sms'],
                'title' => ['sw' => 'Salio la SMS', 'en' => 'SMS balance'],
                'answer' => [
                    'sw' => "Salio linalobaki linaonekana kwenye **Muhtasari**, kama kadi ya **SMS zilizobaki**. Msimamizi na mtumiaji wa kawaida wanaweza kuliona.\n\n"
                        ."Linatoka kwa mtoa huduma aliyechaguliwa sasa: NextSMS, Beem Africa au SEWMR SMS. Kadi inaonyesha idadi, jina la mtumaji, na bei kwa SMS ikipatikana.\n\n"
                        ."Kadi hiyo hiyo ipo kwenye **Arifa na SMS** na kwenye **Mipangilio → API na huduma za nje**. Hali ya majaribio haina salio la kuonyesha.\n\n"
                        .'Ukitaka kumbukumbu salio likipungua, weka **kikomo cha salio** kwenye Arifa na SMS.',
                    'en' => "The remaining balance is on **Overview**, as the **SMS remaining** card. Both an administrator and a regular user can see it.\n\n"
                        ."It comes from whichever provider is selected now: NextSMS, Beem Africa or SEWMR SMS. The card shows the count, the sender name, and the price per SMS when the provider returns one.\n\n"
                        ."The same figure is on **Notifications & SMS** and under **Settings → APIs & external services**. Test mode has no balance to show.\n\n"
                        .'To be reminded when it runs low, set an **SMS limit** on Notifications & SMS.',
                ],
                'related' => ['notifications.send', 'notifications.alert', 'api_settings.sms'],
            ],
            [
                'id' => 'notifications.alert',
                'module' => 'notifications',
                'actions' => [],
                'keywords' => ['kikomo cha salio', 'kikomo cha sms', 'sms limit', 'low balance alert', 'salio linapopungua', 'kumbusha kuongeza', 'ongeza salio', 'remind me to add sms', 'top up sms', 'niarifu salio', 'balance threshold', 'sms zikibaki'],
                'title' => ['sw' => 'Kikomo cha salio la SMS', 'en' => 'SMS balance limit'],
                'answer' => [
                    'sw' => "1. Fungua **Arifa na SMS**.\n"
                        ."2. Chini ya salio, washa **Niarifu salio linapopungua**.\n"
                        ."3. Andika idadi ya SMS zitakazobaki (mfano 20), kisha **Hifadhi kikomo**.\n\n"
                        ."Salio halisi la akaunti (NextSMS, Beem au SEWMR) likifika hiyo idadi au chini, arifa inaonekana kwenye **kengele**. Inarudia kila siku mpaka uongeze salio, na tena likishuka baada ya kuongezwa.\n\n"
                        .'Mtu asiye na moduli ya Arifa na SMS haoni kumbusho hilo.',
                    'en' => "1. Open **Notifications & SMS**.\n"
                        ."2. Under the balance, turn on **Notify me when the balance runs low**.\n"
                        ."3. Enter how many SMS may remain (for example 20), then **Save limit**.\n\n"
                        ."When the live account balance (NextSMS, Beem or SEWMR) reaches that number or less, a reminder appears in the **bell**. It repeats each day until you add credit, and again if the balance drops after a top-up.\n\n"
                        .'Someone without the Notifications & SMS module does not see that reminder.',
                ],
                'related' => ['notifications.balance', 'general.inbox'],
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
                        .'Kuutoa, mwenye ruhusa ya **API na huduma za nje** achague mtoa huduma halisi (NextSMS, Beem Africa au SEWMR SMS) na aweke funguo zake.',
                    'en' => "If the send screen shows **Test mode · SMS do not reach phones**, the system is in test mode: messages are written to a log, not sent.\n\n"
                        .'To leave it, someone with **APIs & external services** access must choose a real provider (NextSMS, Beem Africa or SEWMR SMS) and enter its credentials.',
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
                        .'Moduli iliyozimwa inafichwa kwa **kila mtu**, hata msimamizi. Moduli za msingi (Muhtasari, Mipangilio, API, Kumbukumbu za shughuli) haziwezi kuzimwa.',
                    'en' => "1. Open **Settings → System settings**.\n"
                        ."2. Use the switches to turn modules on or off; you can also rename them and edit their description.\n\n"
                        .'A disabled module is hidden from **everyone**, administrators included. Core modules (Overview, Settings, APIs, Activity logs) cannot be disabled.',
                ],
            ],
            [
                'id' => 'api_settings.sms',
                'module' => 'api_settings',
                'actions' => ['update'],
                'keywords' => ['nextsms', 'beem', 'sewmr', 'sewmrsms', 'sender id', 'mtoa huduma wa sms', 'sms provider', 'api key', 'funguo', 'credentials', 'api settings', 'mipangilio ya api', 'jina la mtumaji'],
                'title' => ['sw' => 'Kuweka mtoa huduma wa SMS', 'en' => 'Setting up the SMS provider'],
                'answer' => [
                    'sw' => "1. Fungua **Mipangilio → API na huduma za nje**.\n"
                        ."2. Kwenye **SMS**, chagua **mtoa huduma**: NextSMS, Beem Africa, SEWMR SMS, au Majaribio (log).\n"
                        ."3. Weka **Jina la mtumaji (Sender ID)** — herufi 3–11, sawasawa na lilivyoidhinishwa na mtoa huduma. Kwa SEWMR SMS omba hapa: https://www.sewmrsms.co.tz/console/sender-ids/requests\n"
                        ."4. Jaza funguo za mtoa huduma uliyemchagua (kwa SEWMR SMS: API Token), kisha **Hifadhi**.\n"
                        ."5. Tumia **Jaribu** kutuma SMS ya majaribio kwa namba yako.\n\n"
                        .'Funguo zinahifadhiwa kwa usimbaji fiche (encrypted). Sehemu ukiyoiacha wazi inatumia thamani ya .env.',
                    'en' => "1. Open **Settings → APIs & external services**.\n"
                        ."2. Under **SMS**, choose the **provider**: NextSMS, Beem Africa, SEWMR SMS, or Test (log).\n"
                        ."3. Enter the **Sender ID** — 3–11 characters, exactly as approved by the provider. For SEWMR SMS request one at: https://www.sewmrsms.co.tz/console/sender-ids/requests\n"
                        ."4. Fill in the chosen provider's credentials (for SEWMR SMS: API Token), then **Save**.\n"
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
                    'sw' => "**Kumbukumbu za shughuli** zinaonyesha kila kuingia, kutoka, kuongeza, kuhariri, kufuta na kupakua kulikofanyika, na nani alifanya na lini.\n\n"
                        ."- Chuja kwa mtumiaji, kitendo, aina ya kipengele au tarehe.\n"
                        ."- Bofya **Angalia** kuona mabadiliko (kabla na baada).\n"
                        .'- Kichupo cha **Vilivyofutwa** kinaonyesha vitu vinavyoweza kurejeshwa.',
                    'en' => "**Activity logs** show every sign-in, sign-out, add, edit, delete and export, plus who did it and when.\n\n"
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
