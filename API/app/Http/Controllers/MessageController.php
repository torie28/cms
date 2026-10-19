<?php

namespace App\Http\Controllers;

use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Kanda;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\SmsBalanceAlert;
use App\Models\SystemNotice;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Sms\Audience;
use App\Support\Sms\BalanceAlert;
use App\Support\Sms\Outbox;
use App\Support\Sms\SmsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MessageController extends Controller
{
    private const CHANNELS = ['sms', 'app', 'both'];

    /** Everything the compose screen needs to pick recipients and count them before sending. */
    public function contacts(Request $request): JsonResponse
    {
        $this->ensureModule($request);

        return response()->json([
            'kandas' => Kanda::query()->orderBy('name')->get(['id', 'name']),
            'jumuiyas' => Jumuiya::query()->with('kanda:id,name')->orderBy('name')->get(['id', 'name', 'kanda_id']),
            'members' => JumuiyaMember::query()
                ->whereHas('jumuiya')
                ->orderBy('name')
                ->get(['id', 'jumuiya_id', 'name', 'phone']),
            'users' => User::query()->orderBy('name')->get(['id', 'name', 'phone', 'role']),
            'gateway' => [
                'driver' => SmsGateway::driver(),
                'provider' => SmsGateway::providerLabel(),
                'test_mode' => SmsGateway::isTestMode(),
                'sender_id' => SmsGateway::senderId(),
            ],
        ]);
    }

    /** Remaining SMS on the active provider. Any signed-in user may read it. */
    public function balance(): JsonResponse
    {
        return response()->json($this->balancePayload(app(BalanceAlert::class)->sync(fresh: true)));
    }

    /** The remaining-SMS limit that posts a reminder into the notification bell. */
    public function updateAlert(Request $request): JsonResponse
    {
        abort_unless(
            Modules::canAccess($request->user(), 'notifications'),
            403,
            'Huna ruhusa ya kuweka kikomo cha salio la SMS.',
        );

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'threshold' => ['nullable', 'integer', 'min:0', 'max:1000000', 'required_if:enabled,true'],
        ], [
            'threshold.required_if' => 'Weka idadi ya SMS zitakazobaki kabla ya kukumbushwa.',
            'threshold.integer' => 'Kikomo lazima kiwe namba kamili.',
            'threshold.min' => 'Kikomo hakiwezi kuwa chini ya sifuri.',
            'threshold.max' => 'Kikomo ni kikubwa mno.',
        ]);

        $alert = SmsBalanceAlert::current();
        $alert->enabled = $request->boolean('enabled');
        $alert->threshold = $data['threshold'] ?? null;
        $alert->updated_by = $request->user()->name;

        if (! $alert->enabled) {
            $alert->active = false;
            $alert->last_notified_on = null;
        }

        $alert->save();

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            $alert->enabled
                ? 'Kikomo cha salio la SMS: '.$alert->threshold
                : 'Kikomo cha salio la SMS kimezimwa',
            'sms_balance_alert',
            $request,
            $alert,
        );

        $service = app(BalanceAlert::class);

        return response()->json($this->balancePayload($service->sync(fresh: true)));
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureModule($request);

        return response()->json(
            Message::query()->orderByDesc('id')->limit(300)->get(),
        );
    }

    public function show(Request $request, Message $message): JsonResponse
    {
        $this->ensureModule($request);

        $message->load(['recipients' => fn ($query) => $query->orderBy('channel')->orderBy('name')]);

        return response()->json($message);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCan($request, 'notifications', 'create');

        $data = $request->validate([
            'channel' => ['required', Rule::in(self::CHANNELS)],
            'audience' => ['required', Rule::in(Audience::TYPES)],
            'kanda_ids' => ['required_if:audience,kanda', 'array'],
            'kanda_ids.*' => ['integer', Rule::exists('kandas', 'id')->withoutTrashed()],
            'jumuiya_ids' => ['required_if:audience,jumuiya', 'array'],
            'jumuiya_ids.*' => ['integer', Rule::exists('jumuiyas', 'id')->withoutTrashed()],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
            'user_ids' => ['sometimes', 'array'],
            'user_ids.*' => ['integer'],
            'phones' => ['sometimes', 'array', 'max:1000'],
            'phones.*' => ['string', 'max:40'],
            'title' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:1600'],
        ], [
            'kanda_ids.required_if' => 'Chagua angalau kanda moja.',
            'jumuiya_ids.required_if' => 'Chagua angalau jumuiya moja.',
            'body.required' => 'Andika ujumbe kwanza.',
            'body.max' => 'Ujumbe ni mrefu mno (herufi 1600 zinaruhusiwa).',
        ]);

        $resolved = Audience::resolve($data['audience'], $data);
        $wantsSms = $data['channel'] !== 'app';
        $wantsApp = $data['channel'] !== 'sms';
        $sms = $wantsSms ? $resolved['sms'] : [];
        $app = $wantsApp ? $resolved['app'] : [];

        if ($sms === [] && $app === []) {
            abort(422, match (true) {
                $data['channel'] === 'app' => 'Hakuna mtumiaji wa mfumo kati ya wapokeaji hawa. Arifa za mfumo huwafikia watumiaji wa mfumo pekee; tumia SMS kwa wanajumuiya.',
                default => 'Hakuna mpokeaji mwenye namba sahihi ya simu kati ya uliowachagua.',
            });
        }

        $user = $request->user();
        $message = Message::query()->create([
            'user_id' => $user->id,
            'sender' => $user->name,
            'channel' => $data['channel'],
            'audience' => $data['audience'],
            'audience_ids' => array_filter([
                'kanda_ids' => $data['kanda_ids'] ?? null,
                'jumuiya_ids' => $data['jumuiya_ids'] ?? null,
                'member_ids' => $data['member_ids'] ?? null,
                'user_ids' => $data['user_ids'] ?? null,
            ]),
            'audience_label' => $resolved['label'],
            'title' => $data['title'] ?? null,
            'body' => $data['body'],
            'status' => 'sending',
            'skipped_count' => $wantsSms ? $resolved['skipped'] : 0,
        ]);

        Outbox::deliverSms($message, $sms);

        $now = now();
        foreach (array_chunk($app, 500) as $chunk) {
            MessageRecipient::query()->insert(array_map(fn (array $recipient) => [
                ...$recipient,
                'message_id' => $message->id,
                'channel' => 'app',
                'status' => 'sent',
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }

        Outbox::refreshTotals($message);

        app(ActivityLogger::class)->record(
            $user,
            'sent',
            $this->summary($message),
            'message',
            $request,
            $message,
        );

        return response()->json($message, 201);
    }

    /** Sends the failed SMS of a message again. */
    public function retry(Request $request, Message $message): JsonResponse
    {
        $this->ensureCan($request, 'notifications', 'create');

        $failed = $message->recipients()->where('channel', 'sms')->where('status', 'failed')->get();
        abort_if($failed->isEmpty(), 422, 'Hakuna SMS iliyoshindwa kwenye ujumbe huu.');

        $results = app(SmsGateway::class)->send(
            $failed->mapWithKeys(fn (MessageRecipient $recipient) => [
                $recipient->phone => Outbox::render($message->body, $recipient->name),
            ])->all(),
        );

        foreach ($failed as $recipient) {
            $error = Outbox::errorFor($results, $recipient->phone);
            $recipient->update(['status' => $error === null ? 'sent' : 'failed', 'error' => $error]);
        }

        Outbox::refreshTotals($message);

        app(ActivityLogger::class)->record(
            $request->user(),
            'sent',
            'SMS zilizoshindwa tena · '.$message->audience_label,
            'message',
            $request,
            $message,
        );

        $message->load(['recipients' => fn ($query) => $query->orderBy('channel')->orderBy('name')]);

        return response()->json($message);
    }

    /** In-app notifications addressed to the signed-in user, plus SMS balance reminders. */
    public function inbox(Request $request): JsonResponse
    {
        app(BalanceAlert::class)->sync();

        $user = $request->user();
        $messages = MessageRecipient::query()
            ->where('channel', 'app')
            ->where('recipient_type', 'user')
            ->where('recipient_id', $user->id)
            ->with('message:id,sender,title,body,created_at')
            ->orderByDesc('id')
            ->limit(30)
            ->get(['id', 'message_id', 'read_at', 'created_at']);

        $notices = SystemNotice::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        $items = $messages
            ->map(fn (MessageRecipient $item) => [
                'id' => 'message:'.$item->id,
                'kind' => 'message',
                'read_at' => $item->read_at,
                'created_at' => $item->created_at,
                'sender' => $item->message?->sender,
                'title' => $item->message?->title,
                'body' => Outbox::render((string) $item->message?->body, $user->name),
                'alert' => null,
                'sort' => $item->created_at?->getTimestamp() ?? 0,
            ])
            ->concat($notices->map(fn (SystemNotice $notice) => [
                'id' => 'notice:'.$notice->id,
                'kind' => $notice->kind,
                'read_at' => $notice->read_at,
                'created_at' => $notice->created_at,
                'sender' => $notice->sender,
                'title' => $notice->title,
                'body' => $notice->body,
                'alert' => $notice->meta,
                'sort' => $notice->created_at?->getTimestamp() ?? 0,
            ]))
            ->sortByDesc('sort')
            ->take(30)
            ->map(fn (array $item) => collect($item)->except('sort')->all())
            ->values();

        $unread = MessageRecipient::query()
            ->where('channel', 'app')
            ->where('recipient_type', 'user')
            ->where('recipient_id', $user->id)
            ->whereNull('read_at')
            ->count()
            + SystemNotice::query()->where('user_id', $user->id)->whereNull('read_at')->count();

        return response()->json([
            'unread' => $unread,
            'items' => $items,
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $id = (string) $request->validate([
            'id' => ['required', 'string', 'max:40'],
        ])['id'];

        if (preg_match('/^notice:(\d+)$/', $id, $match) === 1) {
            $notice = SystemNotice::query()
                ->where('user_id', $request->user()->id)
                ->whereKey((int) $match[1])
                ->firstOrFail();
            $notice->read_at ??= now();
            $notice->save();

            return response()->json(['read_at' => $notice->read_at]);
        }

        if (preg_match('/^message:(\d+)$/', $id, $match) === 1) {
            $recipient = MessageRecipient::query()->findOrFail((int) $match[1]);
            abort_unless(
                $recipient->channel === 'app'
                    && $recipient->recipient_type === 'user'
                    && $recipient->recipient_id === $request->user()->id,
                404,
            );

            $recipient->read_at ??= now();
            $recipient->save();

            return response()->json(['read_at' => $recipient->read_at]);
        }

        abort(404);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $now = now();

        MessageRecipient::query()
            ->where('channel', 'app')
            ->where('recipient_type', 'user')
            ->where('recipient_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => $now]);

        SystemNotice::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => $now]);

        return response()->json(['message' => 'Zote zimesomwa.']);
    }

    /** @param  array<string, mixed>  $balance */
    private function balancePayload(array $balance): array
    {
        return [
            ...$balance,
            'alert' => app(BalanceAlert::class)->describe($balance),
        ];
    }

    private function summary(Message $message): string
    {
        $parts = [];
        if ($message->sms_count) {
            $parts[] = "SMS {$message->sms_sent}/{$message->sms_count}";
        }
        if ($message->app_count) {
            $parts[] = "arifa {$message->app_count}";
        }

        return $message->audience_label.' · '.implode(', ', $parts);
    }

    private function ensureModule(Request $request): void
    {
        abort_unless(
            Modules::canAccess($request->user(), 'notifications'),
            403,
            'Huna ruhusa ya kutuma arifa na SMS.',
        );
    }
}
