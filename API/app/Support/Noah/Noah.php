<?php

namespace App\Support\Noah;

use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use App\Support\Modules;
use App\Support\Roles;
use Illuminate\Support\Collection;

/**
 * Noah, the in-app guide. Matches a question to a topic in Knowledge and answers it
 * for the asking user: the steps when they may do it, otherwise what their role is
 * missing and who can grant it. Access is always read live from the database, so the
 * answer matches what the API would actually allow.
 */
class Noah
{
    private const MIN_SCORE = 3;

    private const KEYWORD_WEIGHT = 3;

    private const MODULE_BONUS = 3;

    private const CONTEXT_BONUS = 1;

    private const ACTION_BONUS = 2;

    private const OVERVIEW_TOPICS = [
        'dashboard' => 'dashboard.overview',
        'users' => 'users.overview',
        'sadaka' => 'sadaka.overview',
        'jumuiya' => 'jumuiya.overview',
        'kanda' => 'kanda.overview',
        'matukio' => 'matukio.overview',
        'notifications' => 'notifications.overview',
        'settings' => 'settings.modules',
        'api_settings' => 'api_settings.sms',
        'activity_logs' => 'activity_logs.overview',
    ];

    /** Intent phrases are matched on whole words only, unlike topic keywords. */
    private const GREETINGS = ['habari', 'mambo', 'hujambo', 'salama', 'shikamoo', 'niaje', 'vipi', 'tumsifu', 'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];

    private const THANKS = ['asante', 'ahsante', 'nashukuru', 'thanks', 'thank you', 'thx'];

    private const IDENTITY = ['wewe ni nani', 'who are you', 'noah ni nani', 'who is noah', 'jina lako', 'your name', 'unaweza kunisaidia nini', 'what can you do', 'what can you help', 'unafanya nini'];

    private const HELP = ['msaada', 'help', 'menu', 'mada', 'topics', 'nisaidie', 'saidia'];

    private const MY_ACCESS = ['ruhusa zangu', 'my permissions', 'my access', 'moduli zangu', 'my modules', 'nina ruhusa gani', 'naweza kufanya nini', 'ninaweza kufanya nini', 'what can i do', 'what am i allowed', 'wadhifa wangu', 'my role', 'nina wadhifa gani'];

    private const PERMISSION = ['naweza', 'ninaweza', 'nawezaje kuruhusiwa', 'can i', 'am i allowed', 'ruhusa', 'permission', 'access', 'siwezi', 'sikuweza', 'cant', 'cannot', 'kwa nini', 'why', 'denied', 'imekataliwa', '403', 'sioni', 'dont see', 'haionekani', 'not showing', 'missing', 'allowed', 'nimeruhusiwa'];

    /** "Who deleted…?" names a module and an action, but the answer lives in the activity log. */
    private const WHO_DID = ['nani alifuta', 'nani aliongeza', 'nani alihariri', 'nani alibadilisha', 'nani alifanya', 'nani alirekodi', 'nani alituma', 'who deleted', 'who added', 'who changed', 'who edited', 'who did', 'who created', 'who recorded', 'who sent', 'who removed'];

    private const THIS_PAGE = ['ukurasa huu', 'this page', 'hapa', 'here', 'skrini hii', 'this screen'];

    /** English for the seeded role labels, matching the app's dictionary; custom roles keep their own label. */
    private const ROLE_LABELS_EN = [
        'Msimamizi' => 'Administrator',
        'Katibu' => 'Secretary',
        'Mweka hazina' => 'Treasurer',
        'Kiongozi wa kanda' => 'Zone leader',
        'Kiongozi wa jumuiya' => 'Community leader',
        'Mwanachama' => 'Member',
    ];

    private const TEXT = [
        'sw' => [
            'intro' => "Tumsifu Yesu Kristu, {name}! Mimi ni **Noah**, mwongozo wako wa mfumo huu.\n\nNinajua kila sehemu ya mfumo, na ninaangalia ruhusa zako kabla ya kukueleza jinsi ya kufanya jambo. Niulize kwa Kiswahili au Kiingereza.",
            'intro_admin' => 'Wewe ni **msimamizi**, kwa hiyo unafungua kila moduli iliyowashwa.',
            'intro_member' => 'Wadhifa wako ni **{role}**, na unaweza kufungua: {modules}.',
            'identity' => "Mimi ni **Noah**, mwongozo wa mfumo huu wa usimamizi wa parokia.\n\nNinakueleza hatua kwa hatua jinsi ya kutumia kila moduli: Watumiaji, Kanda, Jumuiya, Sadaka, Arifa na SMS, Mipangilio na Kumbukumbu za shughuli. Kabla ya kukuonyesha hatua, naangalia kama wadhifa wako unaruhusu; kama hauruhusu, nakueleza kwa nini na nani anaweza kukupa ruhusa.\n\nSitendi chochote kwa niaba yako; nakuongoza tu.",
            'greeting' => 'Salama, {name}! Nikusaidie nini leo?',
            'thanks' => 'Karibu sana! Kama kuna jingine, niulize tu.',
            'unknown' => 'Samahani, sijaelewa swali hilo vizuri. Jaribu kutaja sehemu ya mfumo na unachotaka kufanya, kwa mfano "jinsi ya kurekodi mchango" au "naweza kufuta jumuiya?".',
            'yes' => 'Ndiyo, una ruhusa hiyo.',
            'no_module' => "Samahani {name}, wadhifa wako (**{role}**) hauna ruhusa ya kufungua moduli ya **{module}**, kwa hiyo siwezi kukuongoza humo.\n\nKwa taarifa tu, moduli hii inahusu {summary}",
            'no_action' => "Unaweza kufungua **{module}**, lakini akaunti yako haina ruhusa ya **{actions}** humo, kwa hiyo kitufe hicho hakitakuonekana au mfumo utakukatalia.\n\nHumo unaweza: {allowed}.",
            'disabled' => 'Moduli ya **{module}** imezimwa kwa sasa kwenye mfumo mzima, kwa hiyo haionekani kwa mtu yeyote, hata msimamizi.',
            'disabled_can_enable' => 'Unaweza kuiwasha tena: **Mipangilio → Mipangilio ya mfumo**.',
            'disabled_ask' => 'Msimamizi wa mfumo ndiye anayeweza kuiwasha tena.',
            'contact' => 'Ukihitaji ruhusa hii, muombe msimamizi wa mfumo ({admins}) akuongezee kupitia **Watumiaji → Hariri → Moduli**.',
            'contact_anyone' => 'Ukihitaji ruhusa hii, muombe msimamizi wa mfumo akuongezee kupitia **Watumiaji → Hariri → Moduli**.',
            'report_admin' => 'Wewe ni **msimamizi**: unafungua moduli zote zilizowashwa na kufanya kila kitendo ndani yake.',
            'report_role' => 'Wadhifa wako ni **{role}**. Unaweza kufungua:',
            'report_cannot' => 'Huna ruhusa ya: {modules}.',
            'report_disabled' => 'Zilizozimwa kwa sasa kwa kila mtu: {modules}.',
            'module_report' => 'Kwenye **{module}** unaweza: {allowed}.',
            'module_report_missing' => 'Huwezi: {missing}.',
            'help' => 'Ninaweza kukueleza jinsi ya kutumia sehemu hizi ulizo nazo:',
            'help_general' => 'Pia: kuingia na kutoka, nenosiri, lugha, mandhari, kalenda ya liturujia, arifa zako na kurejesha vilivyofutwa.',
            'open' => 'Fungua {module}',
            'view' => 'kuona',
            'view_only' => 'kuona tu',
            'and' => 'na',
            'suggest_access' => 'Ruhusa zangu ni zipi?',
            'suggest_help' => 'Unaweza kunisaidia nini?',
            'admin_role' => 'Msimamizi',
        ],
        'en' => [
            'intro' => "Praised be Jesus Christ, {name}! I'm **Noah**, your guide to this system.\n\nI know every part of the system, and I check your access before explaining how to do something. Ask me in English or Swahili.",
            'intro_admin' => "You're an **administrator**, so you can open every enabled module.",
            'intro_member' => 'Your role is **{role}**, and you can open: {modules}.',
            'identity' => "I'm **Noah**, the guide for this parish management system.\n\nI explain step by step how to use every module: Users, Zones, Communities, Offerings, Notifications & SMS, Settings and Activity logs. Before showing steps, I check whether your role allows it; if not, I tell you why and who can grant it.\n\nI never act on your behalf; I only guide you.",
            'greeting' => 'Hello, {name}! How can I help you today?',
            'thanks' => "You're welcome! Ask me anything else.",
            'unknown' => "Sorry, I didn't quite understand that. Try naming a part of the system and what you want to do, for example \"how do I record an offering\" or \"can I delete a community?\".",
            'yes' => 'Yes, you have that permission.',
            'no_module' => "Sorry {name}, your role (**{role}**) doesn't have access to the **{module}** module, so I can't walk you through it.\n\nFor your information, this module covers {summary}",
            'no_action' => "You can open **{module}**, but your account isn't allowed to **{actions}** there, so that button won't show or the system will refuse it.\n\nThere you can: {allowed}.",
            'disabled' => 'The **{module}** module is currently switched off for the whole system, so nobody sees it, administrators included.',
            'disabled_can_enable' => 'You can switch it back on: **Settings → System settings**.',
            'disabled_ask' => 'Only a system administrator can switch it back on.',
            'contact' => 'If you need this, ask a system administrator ({admins}) to grant it under **Users → Edit → Modules**.',
            'contact_anyone' => 'If you need this, ask a system administrator to grant it under **Users → Edit → Modules**.',
            'report_admin' => "You're an **administrator**: you open every enabled module and can do every action in it.",
            'report_role' => 'Your role is **{role}**. You can open:',
            'report_cannot' => "You don't have access to: {modules}.",
            'report_disabled' => 'Currently switched off for everyone: {modules}.',
            'module_report' => 'In **{module}** you can: {allowed}.',
            'module_report_missing' => 'You cannot: {missing}.',
            'help' => 'I can explain how to use these areas you have access to:',
            'help_general' => 'Also: signing in and out, passwords, language, theme, the liturgical calendar, your notifications and restoring deleted records.',
            'open' => 'Open {module}',
            'view' => 'view',
            'view_only' => 'view only',
            'and' => 'and',
            'suggest_access' => 'What access do I have?',
            'suggest_help' => 'What can you help with?',
            'admin_role' => 'Administrator',
        ],
    ];

    private readonly string $lang;

    /** @var Collection<string, Module> */
    private Collection $modules;

    /** @var list<string> */
    private array $accessible;

    public function __construct(private readonly User $user, string $locale)
    {
        $this->lang = $locale === 'en' ? 'en' : 'sw';
        $this->accessible = Modules::accessibleBy($user);
        $this->modules = Module::query()->orderBy('sort_order')->get()->keyBy('key');
    }

    /** The opening message, with suggestions picked from what this user can actually do. */
    public function intro(): array
    {
        $reply = $this->t('intro', ['name' => $this->addressName()])."\n\n";
        $reply .= $this->isAdmin()
            ? $this->t('intro_admin')
            : $this->t('intro_member', [
                'role' => $this->roleLabel(),
                'modules' => $this->join(array_map(fn ($key) => $this->moduleLabel($key), $this->accessible)),
            ]);

        $suggestions = [];
        foreach (['sadaka.create', 'jumuiya.members', 'notifications.send', 'users.create', 'kanda.create', 'activity_logs.overview'] as $id) {
            if (count($suggestions) < 3 && $this->allowed(Knowledge::find($id))) {
                $suggestions[] = $id;
            }
        }

        return $this->response($reply, 'ok', suggestions: [...$suggestions, 'noah.access', 'noah.help']);
    }

    public function ask(string $message, ?string $topicId = null, ?string $path = null, ?string $lastModule = null): array
    {
        if ($topicId !== null) {
            return match ($topicId) {
                'noah.access' => $this->accessReport(),
                'noah.help' => $this->help(),
                default => ($topic = Knowledge::find($topicId)) ? $this->answer($topic, false) : $this->unknown(),
            };
        }

        $tokens = $this->tokenize($message);

        if ($tokens === []) {
            return $this->help();
        }

        $explicit = $this->detectModules($tokens);
        $actions = $this->detectActions($tokens);
        $permissionQuestion = $this->mentions($tokens, self::PERMISSION);
        $pageModule = $this->moduleForPath($path);
        $lastModule = isset(Knowledge::PATHS[$lastModule ?? '']) ? $lastModule : null;
        $context = $this->mentions($tokens, self::THIS_PAGE)
            ? ($pageModule ?? $lastModule)
            : ($lastModule ?? $pageModule);

        if ($explicit === [] && $this->mentions($tokens, self::MY_ACCESS)) {
            return $this->mentions($tokens, self::THIS_PAGE) && $pageModule
                ? $this->moduleReport($pageModule)
                : $this->accessReport();
        }

        if ($explicit === [] && $this->mentions($tokens, self::IDENTITY)) {
            return $this->response($this->t('identity'), 'ok', suggestions: ['noah.access', 'noah.help', 'general.access']);
        }

        if ($this->mentions($tokens, self::WHO_DID)) {
            return $this->answer(Knowledge::find('activity_logs.overview'), $permissionQuestion);
        }

        [$topic, $score] = $this->bestTopic($tokens, $explicit, $explicit === [] ? $context : null, $actions);

        if ($score < self::MIN_SCORE) {
            if ($explicit !== [] && isset(self::OVERVIEW_TOPICS[$explicit[0]])) {
                $topic = Knowledge::find(self::OVERVIEW_TOPICS[$explicit[0]]);
            } elseif ($explicit !== []) {
                return $this->moduleReport($explicit[0]);
            } elseif ($this->mentions($tokens, self::THANKS)) {
                return $this->response($this->t('thanks'), 'ok', suggestions: ['noah.help']);
            } elseif ($this->mentions($tokens, self::HELP)) {
                return $this->help();
            } elseif ($this->mentions($tokens, self::GREETINGS)) {
                return $this->response($this->t('greeting', ['name' => $this->addressName()]), 'ok', suggestions: ['noah.access', 'noah.help']);
            } elseif ($permissionQuestion && $context) {
                return $this->moduleReport($context);
            } else {
                return $this->unknown();
            }
        }

        if ($permissionQuestion && $actions === [] && $topic['module'] !== null && $topic['actions'] === []
            && $topic['id'] === (self::OVERVIEW_TOPICS[$topic['module']] ?? null)) {
            return $this->moduleReport($topic['module']);
        }

        return $this->answer($topic, $permissionQuestion);
    }

    // ------------------------------------------------------------------ Answers

    /** @param  array<string, mixed>  $topic */
    private function answer(array $topic, bool $permissionQuestion): array
    {
        $module = $topic['module'];

        if ($module !== null && ($refusal = $this->refusal($module, $topic['actions'], $topic['hint'][$this->lang] ?? null))) {
            return [...$refusal, 'topic' => $topic['id']];
        }

        $reply = ($permissionQuestion && ($module !== null || $topic['actions'] !== []) ? $this->t('yes')."\n\n" : '')
            .'**'.$topic['title'][$this->lang]."**\n\n"
            .$topic['answer'][$this->lang];

        $links = $module === null ? [] : $this->openLink($module, $topic['path'] ?? null);

        $related = array_values(array_filter(
            $topic['related'] ?? [],
            fn (string $id) => $id !== $topic['id'],
        ));

        if ($module !== null) {
            foreach (Knowledge::topics() as $other) {
                if ($other['module'] === $module && $other['id'] !== $topic['id'] && ! in_array($other['id'], $related, true)) {
                    $related[] = $other['id'];
                }
            }
        }

        return $this->response($reply, 'ok', $topic['id'], $module, $links, $related);
    }

    /**
     * Why the user cannot follow a topic, or null when they can.
     *
     * @param  list<string>  $actions
     */
    private function refusal(string $module, array $actions, ?string $hint = null): ?array
    {
        $label = $this->moduleLabel($module);

        if (! ($this->modules[$module]->enabled ?? true)) {
            $reply = $this->t('disabled', ['module' => $label])."\n\n"
                .$this->t(Modules::can($this->user, 'settings', 'update') ? 'disabled_can_enable' : 'disabled_ask');

            return $this->response($reply, 'disabled', null, $module, suggestions: ['noah.access']);
        }

        if (! in_array($module, $this->accessible, true)) {
            $reply = $this->t('no_module', [
                'name' => $this->addressName(),
                'role' => $this->roleLabel(),
                'module' => $label,
                'summary' => Knowledge::MODULE_SUMMARIES[$module][$this->lang] ?? '',
            ])."\n\n".$this->contactLine().($hint ? "\n\n".$hint : '');

            return $this->response($reply, 'restricted', null, $module, suggestions: ['noah.access', 'general.access']);
        }

        $missing = array_values(array_filter($actions, fn (string $action) => ! Modules::can($this->user, $module, $action)));

        if ($missing === []) {
            return null;
        }

        $reply = $this->t('no_action', [
            'module' => $label,
            'actions' => $this->join(array_map(fn ($action) => $this->actionLabel($module, $action), $missing)),
            'allowed' => $this->allowedIn($module),
        ])."\n\n".$this->contactLine().($hint ? "\n\n".$hint : '');

        return $this->response(
            $reply,
            'restricted',
            null,
            $module,
            $this->openLink($module),
            [self::OVERVIEW_TOPICS[$module] ?? 'noah.help', 'noah.access'],
        );
    }

    private function moduleReport(string $module): array
    {
        if ($refusal = $this->refusal($module, [])) {
            return $refusal;
        }

        $label = $this->moduleLabel($module);
        $missing = array_values(array_filter(
            Modules::ACTIONS[$module] ?? [],
            fn (string $action) => ! Modules::can($this->user, $module, $action),
        ));

        $reply = $this->t('module_report', ['module' => $label, 'allowed' => $this->allowedIn($module)]);

        if ($missing !== []) {
            $reply .= ' '.$this->t('module_report_missing', [
                'missing' => $this->join(array_map(fn ($action) => $this->actionLabel($module, $action), $missing)),
            ])."\n\n".$this->contactLine();
        }

        return $this->response(
            $reply,
            $missing === [] ? 'ok' : 'restricted',
            null,
            $module,
            $this->openLink($module),
            [self::OVERVIEW_TOPICS[$module] ?? 'noah.help', 'noah.access'],
        );
    }

    /** @return list<array{label: string, path: string}> */
    private function openLink(string $module, ?string $path = null): array
    {
        $path ??= Knowledge::PATHS[$module] ?? null;

        return $path ? [['label' => $this->t('open', ['module' => $this->moduleLabel($module)]), 'path' => $path]] : [];
    }

    private function accessReport(): array
    {
        $disabled = $this->modules->filter(fn (Module $module) => ! $module->enabled)->keys()->all();

        if ($this->isAdmin()) {
            $reply = $this->t('report_admin');
        } else {
            $lines = array_map(
                fn (string $key) => '- **'.$this->moduleLabel($key).'** — '.$this->allowedIn($key),
                $this->accessible,
            );

            $reply = $this->t('report_role', ['role' => $this->roleLabel()])."\n".implode("\n", $lines);

            $missing = $this->modules->keys()
                ->reject(fn (string $key) => in_array($key, $this->accessible, true) || in_array($key, $disabled, true))
                ->map(fn (string $key) => $this->moduleLabel($key))
                ->values()
                ->all();

            if ($missing !== []) {
                $reply .= "\n\n".$this->t('report_cannot', ['modules' => $this->join($missing)])."\n\n".$this->contactLine();
            }
        }

        if ($disabled !== []) {
            $reply .= "\n\n".$this->t('report_disabled', [
                'modules' => $this->join(array_map(fn ($key) => $this->moduleLabel($key), $disabled)),
            ]);
        }

        return $this->response($reply, 'ok', 'noah.access', suggestions: ['general.access', 'noah.help']);
    }

    private function help(): array
    {
        $lines = [];

        foreach ($this->accessible as $module) {
            $titles = collect(Knowledge::topics())
                ->filter(fn (array $topic) => $topic['module'] === $module && $this->allowed($topic))
                ->map(fn (array $topic) => $topic['title'][$this->lang])
                ->take(4)
                ->all();

            if ($titles !== []) {
                $lines[] = '- **'.$this->moduleLabel($module).'**: '.implode(', ', $titles);
            }
        }

        $reply = $this->t('help')."\n".implode("\n", $lines)."\n\n".$this->t('help_general');

        return $this->response($reply, 'ok', 'noah.help', suggestions: ['noah.access', 'general.access', 'general.recycle']);
    }

    private function unknown(): array
    {
        return $this->response($this->t('unknown'), 'unknown', suggestions: ['noah.help', 'noah.access']);
    }

    /**
     * @param  list<array{label: string, path: string}>  $links
     * @param  list<string>  $suggestions  topic ids
     */
    private function response(string $reply, string $status, ?string $topic = null, ?string $module = null, array $links = [], array $suggestions = []): array
    {
        $chips = [];

        foreach ($suggestions as $id) {
            if (count($chips) >= 4) {
                break;
            }

            $label = match ($id) {
                'noah.access' => $this->t('suggest_access'),
                'noah.help' => $this->t('suggest_help'),
                default => ($found = Knowledge::find($id)) && $this->allowed($found) ? $found['title'][$this->lang] : null,
            };

            if ($label !== null) {
                $chips[] = ['label' => $label, 'topic' => $id];
            }
        }

        return [
            'reply' => $reply,
            'status' => $status,
            'topic' => $topic,
            'module' => $module,
            'links' => $links,
            'suggestions' => $chips,
        ];
    }

    // ------------------------------------------------------------------ Matching

    /**
     * @param  list<string>  $tokens
     * @param  list<string>  $explicit  modules named in the question
     * @param  list<string>  $actions
     * @return array{0: array<string, mixed>|null, 1: int}
     */
    private function bestTopic(array $tokens, array $explicit, ?string $context, array $actions): array
    {
        $best = null;
        $bestScore = 0;
        $bestKeywords = 0;

        foreach (Knowledge::topics() as $topic) {
            $keywords = 0;
            foreach ($topic['keywords'] as $keyword) {
                if ($this->phraseMatches($tokens, $keyword, true)) {
                    $keywords += self::KEYWORD_WEIGHT * substr_count($keyword, ' ') + self::KEYWORD_WEIGHT;
                }
            }

            $score = $keywords;
            $module = $topic['module'];

            if ($module !== null && $explicit !== []) {
                if (in_array($module, $explicit, true)) {
                    $score += self::MODULE_BONUS;
                } elseif (! str_starts_with($topic['id'], 'general.')) {
                    $score -= self::MODULE_BONUS;
                }
            } elseif ($module !== null && $module === $context) {
                $score += self::CONTEXT_BONUS;
            }

            if ($topic['actions'] !== [] && array_intersect($topic['actions'], $actions) !== []) {
                $score += self::ACTION_BONUS;
            } elseif ($topic['actions'] === [] && $actions === [] && $module !== null && in_array($module, $explicit, true)) {
                $score += 1;
            }

            if ($score > $bestScore || ($score === $bestScore && $keywords > $bestKeywords)) {
                $best = $topic;
                $bestScore = $score;
                $bestKeywords = $keywords;
            }
        }

        return [$best, $bestScore];
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string> module keys, strongest match first
     */
    private function detectModules(array $tokens): array
    {
        $hits = [];

        foreach (Knowledge::MODULE_ALIASES as $module => $aliases) {
            foreach ($aliases as $alias) {
                if ($this->phraseMatches($tokens, $alias, true)) {
                    $hits[$module] = ($hits[$module] ?? 0) + 1 + substr_count($alias, ' ');
                }
            }
        }

        arsort($hits);

        return array_keys($hits);
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string>
     */
    private function detectActions(array $tokens): array
    {
        $found = [];

        foreach (Knowledge::ACTION_ALIASES as $action => $aliases) {
            foreach ($aliases as $alias) {
                if ($this->phraseMatches($tokens, $alias, true)) {
                    $found[] = $action;
                    break;
                }
            }
        }

        return $found;
    }

    /**
     * @param  list<string>  $tokens
     * @param  list<string>  $phrases
     */
    private function mentions(array $tokens, array $phrases): bool
    {
        foreach ($phrases as $phrase) {
            if ($this->phraseMatches($tokens, $phrase, false)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Every word of the phrase must appear in the question. Loose matching lets a word of
     * four or more letters match inside a longer one, which covers Swahili verb prefixes
     * (ku-, ni-, me-, ta-…) and English plurals.
     *
     * @param  list<string>  $tokens
     */
    private function phraseMatches(array $tokens, string $phrase, bool $loose): bool
    {
        $words = explode(' ', $phrase);

        if (! $loose && count($words) > 1) {
            return str_contains(' '.implode(' ', $tokens).' ', ' '.$phrase.' ');
        }

        foreach ($words as $word) {
            $found = false;

            foreach ($tokens as $token) {
                if ($token === $word || ($loose && mb_strlen($word) >= 4 && str_contains($token, $word))) {
                    $found = true;
                    break;
                }
            }

            if (! $found) {
                return false;
            }
        }

        return true;
    }

    /** @return list<string> */
    private function tokenize(string $message): array
    {
        $text = mb_strtolower($message);
        $text = str_replace(["'", '’', '‘'], '', $text);
        $text = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? '';

        return array_values(array_filter(explode(' ', $text), fn ($word) => $word !== ''));
    }

    private function moduleForPath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $path = '/'.ltrim(strtok($path, '?#') ?: '', '/');
        $best = null;

        foreach (Knowledge::PATHS as $module => $prefix) {
            if (($path === $prefix || str_starts_with($path, $prefix.'/'))
                && ($best === null || strlen($prefix) > strlen(Knowledge::PATHS[$best]))) {
                $best = $module;
            }
        }

        return $best;
    }

    // ------------------------------------------------------------------ Access helpers

    /** Whether the user could follow a topic's steps. */
    private function allowed(?array $topic): bool
    {
        if ($topic === null) {
            return false;
        }

        if ($topic['module'] === null) {
            return true;
        }

        if (! in_array($topic['module'], $this->accessible, true)) {
            return false;
        }

        foreach ($topic['actions'] as $action) {
            if (! Modules::can($this->user, $topic['module'], $action)) {
                return false;
            }
        }

        return true;
    }

    private function allowedIn(string $module): string
    {
        $allowed = [$this->t('view')];

        foreach (Modules::ACTIONS[$module] ?? [] as $action) {
            if (Modules::can($this->user, $module, $action)) {
                $allowed[] = $this->actionLabel($module, $action);
            }
        }

        return count($allowed) === 1 ? $this->t('view_only') : $this->join($allowed);
    }

    private function actionLabel(string $module, string $action): string
    {
        $labels = [
            'sw' => [
                'notifications.create' => 'kutuma ujumbe',
                'activity_logs.update' => 'kurejesha vilivyofutwa',
                'activity_logs.delete' => 'kufuta kabisa',
                'settings.update' => 'kuwasha au kuzima moduli',
                'api_settings.update' => 'kubadilisha mipangilio',
                'create' => 'kuongeza',
                'update' => 'kuhariri',
                'delete' => 'kufuta',
            ],
            'en' => [
                'notifications.create' => 'send messages',
                'activity_logs.update' => 'restore deleted records',
                'activity_logs.delete' => 'delete permanently',
                'settings.update' => 'switch modules on or off',
                'api_settings.update' => 'change settings',
                'create' => 'add',
                'update' => 'edit',
                'delete' => 'delete',
            ],
        ][$this->lang];

        return $labels[$module.'.'.$action] ?? $labels[$action] ?? $action;
    }

    private function contactLine(): string
    {
        $admins = User::query()
            ->where('role', Roles::ADMIN)
            ->whereKeyNot($this->user->getKey())
            ->orderBy('name')
            ->limit(3)
            ->pluck('name')
            ->all();

        return $admins === []
            ? $this->t('contact_anyone')
            : $this->t('contact', ['admins' => $this->join($admins)]);
    }

    private function isAdmin(): bool
    {
        return $this->user->role === Roles::ADMIN;
    }

    private function moduleLabel(string $key): string
    {
        if ($this->lang === 'en') {
            return Knowledge::MODULE_LABELS_EN[$key] ?? $key;
        }

        return $this->modules[$key]->label ?? $key;
    }

    private function roleLabel(): string
    {
        if ($this->isAdmin()) {
            return $this->t('admin_role');
        }

        $label = Role::query()->where('name', $this->user->role)->value('label')
            ?? str_replace('_', ' ', (string) $this->user->role);

        return $this->lang === 'en' ? (self::ROLE_LABELS_EN[$label] ?? $label) : $label;
    }

    /** Noah addresses people by the username they sign in with, e.g. "torie". */
    private function addressName(): string
    {
        return (string) $this->user->username ?: (strtok(trim((string) $this->user->name), ' ') ?: '');
    }

    /** @param  list<string>  $items */
    private function join(array $items): string
    {
        if (count($items) < 2) {
            return implode('', $items);
        }

        $last = array_pop($items);

        return implode(', ', $items).' '.$this->t('and').' '.$last;
    }

    /** @param  array<string, string|int>  $params */
    private function t(string $key, array $params = []): string
    {
        $text = self::TEXT[$this->lang][$key] ?? $key;

        foreach ($params as $name => $value) {
            $text = str_replace('{'.$name.'}', (string) $value, $text);
        }

        return $text;
    }
}
