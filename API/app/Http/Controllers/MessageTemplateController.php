<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\MessageTemplate;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MessageTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureModule($request);

        $query = MessageTemplate::query()->orderBy('topic')->orderByDesc('is_default')->orderBy('name');

        if ($request->filled('topic')) {
            $query->where('topic', $request->string('topic')->toString());
        }
        if ($request->filled('kind')) {
            $query->where('kind', $request->string('kind')->toString());
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCanManage($request);

        $data = $this->validated($request);
        $template = DB::transaction(function () use ($request, $data) {
            $template = MessageTemplate::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'is_system' => false,
            ]);

            if ($template->is_default) {
                $this->clearOtherDefaults($template);
            }

            return $template;
        });

        app(ActivityLogger::class)->record(
            $request->user(),
            'created',
            'Kiolezo: '.$template->name,
            'message_template',
            $request,
            $template,
        );

        return response()->json($template, 201);
    }

    public function update(Request $request, MessageTemplate $messageTemplate): JsonResponse
    {
        $this->ensureCanManage($request);

        $data = $this->validated($request, $messageTemplate);
        DB::transaction(function () use ($messageTemplate, $data) {
            $messageTemplate->update($data);

            if ($messageTemplate->is_default) {
                $this->clearOtherDefaults($messageTemplate);
            }
        });

        app(ActivityLogger::class)->record(
            $request->user(),
            'updated',
            'Kiolezo: '.$messageTemplate->name,
            'message_template',
            $request,
            $messageTemplate,
        );

        return response()->json($messageTemplate->fresh());
    }

    public function destroy(Request $request, MessageTemplate $messageTemplate): JsonResponse
    {
        $this->ensureCanManage($request);

        abort_if(
            $messageTemplate->is_system,
            422,
            'Kiolezo cha mfumo hakiwezi kufutwa. Unaweza kukihariri au kuunda chako.',
        );

        $name = $messageTemplate->name;
        $messageTemplate->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'deleted',
            'Kiolezo: '.$name,
            'message_template',
            $request,
        );

        return response()->json(['message' => 'Kiolezo kimefutwa.']);
    }

    /** Notifications only exposes a create privilege; that gate covers template edits too. */
    private function ensureCanManage(Request $request): void
    {
        $this->ensureCan($request, 'notifications', 'create');
    }

    /** @return array{topic: string, kind: string, name: string, body: string, is_default: bool} */
    private function validated(Request $request, ?MessageTemplate $existing = null): array
    {
        $topics = array_keys(Message::TOPICS);
        $thankYouTopics = MessageTemplate::THANK_YOU_TOPICS;

        $data = $request->validate([
            'topic' => ['required', Rule::in($topics)],
            'kind' => ['required', Rule::in(MessageTemplate::KINDS)],
            'name' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:1600'],
            'is_default' => ['sometimes', 'boolean'],
        ], [
            'topic.required' => 'Chagua mada ya kiolezo.',
            'topic.in' => 'Chagua mada ya kiolezo.',
            'kind.required' => 'Chagua aina ya kiolezo.',
            'kind.in' => 'Chagua aina ya kiolezo.',
            'name.required' => 'Andika jina la kiolezo.',
            'body.required' => 'Andika maandishi ya kiolezo.',
            'body.max' => 'Kiolezo ni kirefu mno (herufi 1600 zinaruhusiwa).',
        ]);

        abort_if(
            $data['kind'] === MessageTemplate::KIND_THANK_YOU
                && ! in_array($data['topic'], $thankYouTopics, true),
            422,
            'SMS ya shukrani inaruhusiwa kwa michango pekee (sadaka, zaka, fungu la kumi, majitoleo, shukrani, ujenzi).',
        );

        // System rows keep their topic/kind so seeded thank-you templates stay findable.
        if ($existing?->is_system) {
            $data['topic'] = $existing->topic;
            $data['kind'] = $existing->kind;
        }

        $data['is_default'] = $request->boolean('is_default', $existing?->is_default ?? false);

        return $data;
    }

    private function clearOtherDefaults(MessageTemplate $template): void
    {
        MessageTemplate::query()
            ->where('topic', $template->topic)
            ->where('kind', $template->kind)
            ->whereKeyNot($template->id)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    private function ensureModule(Request $request): void
    {
        abort_unless(
            \App\Support\Modules::canAccess($request->user(), 'notifications'),
            403,
            'Huna ruhusa ya kutuma arifa na SMS.',
        );
    }
}
