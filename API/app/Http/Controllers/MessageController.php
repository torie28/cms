<?php

namespace App\Http\Controllers;

use App\Models\Jumuiya;
use App\Models\JumuiyaMember;
use App\Models\Kanda;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Modules;
use App\Support\Sms\Audience;
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
                'sender_id' => SmsGateway::senderId(),
            ],
        ]);
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
            'kanda_ids.*' => ['integer', 'exists:kandas,id'],
            'jumuiya_ids' => ['required_if:audience,jumuiya', 'array'],
            'jumuiya_ids.*' => ['integer', 'exists:jumuiyas,id'],
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

    /** In-app notifications addressed to the signed-in user. */
    public function inbox(Request $request): JsonResponse
    {
        $query = MessageRecipient::query()
            ->where('channel', 'app')
            ->where('recipient_type', 'user')
            ->where('recipient_id', $request->user()->id);

        $items = (clone $query)
            ->with('message:id,sender,title,body,created_at')
            ->orderByDesc('id')
            ->limit(30)
            ->get(['id', 'message_id', 'read_at', 'created_at']);

        return response()->json([
            'unread' => (clone $query)->whereNull('read_at')->count(),
            'items' => $items->map(fn (MessageRecipient $item) => [
                'id' => $item->id,
                'read_at' => $item->read_at,
                'created_at' => $item->created_at,
                'sender' => $item->message?->sender,
                'title' => $item->message?->title,
                'body' => Outbox::render((string) $item->message?->body, $request->user()->name),
            ]),
        ]);
    }

    public function markRead(Request $request, MessageRecipient $recipient): JsonResponse
    {
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

    public function markAllRead(Request $request): JsonResponse
    {
        MessageRecipient::query()
            ->where('channel', 'app')
            ->where('recipient_type', 'user')
            ->where('recipient_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Zote zimesomwa.']);
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
