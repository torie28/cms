import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';
import { I18nService, TranslatePipe } from '../core/i18n';
import { NoahLink, NoahReply, NoahService, NoahStatus, NoahSuggestion } from '../core/noah';

type Segment = { text: string; bold: boolean };
type Line = { kind: 'text' | 'step' | 'bullet'; marker: string; segments: Segment[] };
type Block = Line[];

interface ChatEntry {
  id: number;
  from: 'noah' | 'user';
  text?: string;
  blocks?: Block[];
  status?: NoahStatus;
  links?: NoahLink[];
  suggestions?: NoahSuggestion[];
}

/** Turns Noah's light markdown (blank-line paragraphs, "1." steps, "-" bullets, **bold**) into renderable pieces. */
function toBlocks(text: string): Block[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph.split('\n').map((raw): Line => {
        const step = raw.match(/^(\d+)\.\s+(.*)$/);
        const bullet = raw.match(/^-\s+(.*)$/);
        const body = step ? step[2] : bullet ? bullet[1] : raw;
        return {
          kind: step ? 'step' : bullet ? 'bullet' : 'text',
          marker: step ? `${step[1]}.` : bullet ? '•' : '',
          segments: body.split('**').map((part, index) => ({ text: part, bold: index % 2 === 1 })),
        };
      }),
    );
}

@Component({
  selector: 'app-noah-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  host: {
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @if (open()) {
      <section
        class="alert-in fixed right-3 bottom-20 left-3 z-40 flex h-[min(36rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl sm:right-5 sm:left-auto sm:w-[25rem]"
        role="dialog"
        aria-labelledby="noah-title"
      >
        <header class="flex items-center gap-3 border-b border-line bg-sunken px-4 py-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass-strong font-serif text-base text-canvas">N</span>
          <div class="min-w-0 flex-1">
            <h2 id="noah-title" class="font-serif text-base leading-tight">Noah</h2>
            <p class="truncate text-xs text-faint">{{ 'Mwongozo wa mfumo' | t }}</p>
          </div>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
            [title]="'Anza upya' | t"
            (click)="restart()"
          >
            {{ 'Anza upya' | t }}
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-muted hover:bg-surface hover:text-ink"
            [attr.aria-label]="'Funga' | t"
            (click)="open.set(false)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4.5 w-4.5">
              <path stroke-linecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div #scroller class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          @for (entry of entries(); track entry.id; let last = $last) {
            @if (entry.from === 'user') {
              <div class="flex justify-end">
                <p class="max-w-[85%] rounded-2xl rounded-br-sm bg-brass-strong px-3.5 py-2 text-sm whitespace-pre-wrap text-canvas">
                  {{ entry.text }}
                </p>
              </div>
            } @else {
              <div class="flex items-start gap-2">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass-tint font-serif text-xs text-brass-strong">N</span>
                <div class="min-w-0 max-w-[88%] space-y-2">
                  <div
                    class="space-y-2 rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-relaxed"
                    [class.border-line]="entry.status !== 'restricted' && entry.status !== 'disabled'"
                    [class.bg-sunken]="entry.status !== 'restricted' && entry.status !== 'disabled'"
                    [class.border-negative]="entry.status === 'restricted' || entry.status === 'disabled'"
                    [class.bg-surface]="entry.status === 'restricted' || entry.status === 'disabled'"
                  >
                    @if (entry.status === 'restricted' || entry.status === 'disabled') {
                      <p class="flex items-center gap-1.5 text-[0.65rem] font-medium tracking-[0.15em] text-negative uppercase">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-3.5 w-3.5">
                          <rect x="5" y="11" width="14" height="9" rx="2" />
                          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                        </svg>
                        {{ (entry.status === 'disabled' ? 'Moduli imezimwa' : 'Ruhusa inahitajika') | t }}
                      </p>
                    }
                    @for (block of entry.blocks ?? []; track $index) {
                      <div class="space-y-1">
                        @for (line of block; track $index) {
                          <p class="flex gap-1.5" [class.pl-1]="line.kind !== 'text'">
                            @if (line.marker) {
                              <span class="shrink-0 text-brass-strong tabular-nums">{{ line.marker }}</span>
                            }
                            <!-- Kept on one line: whitespace between segments would show before punctuation. -->
                            <span>@for (segment of line.segments; track $index) {<span [class.font-semibold]="segment.bold" [class.text-ink]="segment.bold">{{ segment.text }}</span>}</span>
                          </p>
                        }
                      </div>
                    }
                  </div>

                  @if (entry.links?.length) {
                    <div class="flex flex-wrap gap-2">
                      @for (link of entry.links; track link.path) {
                        <a
                          [routerLink]="link.path"
                          class="rounded-full bg-brass-strong px-3 py-1 text-xs font-medium text-canvas hover:opacity-90"
                        >
                          {{ link.label }} →
                        </a>
                      }
                    </div>
                  }

                  @if (last && entry.suggestions?.length && !busy()) {
                    <div class="flex flex-wrap gap-1.5">
                      @for (chip of entry.suggestions; track chip.topic) {
                        <button
                          type="button"
                          class="rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted hover:border-brass hover:text-ink"
                          (click)="choose(chip)"
                        >
                          {{ chip.label }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }

          @if (busy()) {
            <div class="flex items-center gap-2" [attr.aria-label]="'Noah anaandika…' | t">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass-tint font-serif text-xs text-brass-strong">N</span>
              <span class="flex gap-1 rounded-2xl rounded-tl-sm border border-line bg-sunken px-3.5 py-3">
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-faint"></span>
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:120ms]"></span>
                <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:240ms]"></span>
              </span>
            </div>
          }
        </div>

        <form class="flex items-end gap-2 border-t border-line p-3" (submit)="$event.preventDefault(); send()">
          <label for="noah-input" class="sr-only">{{ 'Andika swali lako…' | t }}</label>
          <input
            #input
            id="noah-input"
            type="text"
            autocomplete="off"
            maxlength="500"
            class="filter-input flex-1"
            [placeholder]="'Andika swali lako…' | t"
            [value]="draft()"
            (input)="draft.set(input.value)"
          />
          <button
            type="submit"
            class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded bg-brass-strong text-canvas hover:opacity-90 disabled:opacity-40"
            [disabled]="busy() || !draft().trim()"
            [attr.aria-label]="'Tuma' | t"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4.5 w-4.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 12 20 4l-6 16-3-7-7-1Z" />
            </svg>
          </button>
        </form>
      </section>
    }

    <button
      type="button"
      class="fixed right-5 bottom-5 z-40 flex h-12 items-center gap-2 rounded-full bg-brass-strong pr-4 pl-1.5 text-canvas shadow-lg hover:opacity-95"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [title]="'Uliza Noah' | t"
      (click)="toggle()"
    >
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/15 font-serif text-lg">N</span>
      <span class="text-sm font-medium">{{ (open() ? 'Funga' : 'Uliza Noah') | t }}</span>
    </button>
  `,
})
export class NoahChat {
  private readonly noah = inject(NoahService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly draft = signal('');
  protected readonly entries = signal<ChatEntry[]>([]);

  private nextId = 1;
  private lastModule: string | null = null;

  constructor() {
    // Re-greet in the new language while nothing has been asked yet.
    effect(() => {
      this.i18n.lang();
      untracked(() => {
        if (this.entries().length === 1 && !this.busy()) {
          void this.greet();
        }
      });
    });

    // A different person signing in on this tab must not see the previous conversation.
    effect(() => {
      this.auth.user()?.id;
      untracked(() => this.reset());
    });
  }

  protected toggle(): void {
    this.open.update((open) => !open);

    if (this.open()) {
      if (!this.entries().length) {
        void this.greet();
      }
      setTimeout(() => this.input()?.nativeElement.focus());
    }
  }

  protected restart(): void {
    this.reset();
    void this.greet();
  }

  protected send(): void {
    const message = this.draft().trim();

    if (!message || this.busy()) {
      return;
    }

    this.draft.set('');
    this.push({ from: 'user', text: message });
    void this.ask({ message });
  }

  protected choose(chip: NoahSuggestion): void {
    if (this.busy()) {
      return;
    }

    this.push({ from: 'user', text: chip.label });
    void this.ask({ topic: chip.topic });
  }

  private async greet(): Promise<void> {
    this.busy.set(true);

    try {
      const reply = await this.noah.intro();
      this.entries.set([]);
      this.receive(reply);
    } catch {
      this.fail();
    } finally {
      this.busy.set(false);
    }
  }

  private async ask(question: { message?: string; topic?: string }): Promise<void> {
    this.busy.set(true);
    this.scrollDown();

    try {
      this.receive(await this.noah.ask({ ...question, path: this.router.url, last_module: this.lastModule }));
    } catch {
      this.fail();
    } finally {
      this.busy.set(false);
      this.scrollDown();
    }
  }

  private receive(reply: NoahReply): void {
    if (reply.module) {
      this.lastModule = reply.module;
    }

    this.push({
      from: 'noah',
      blocks: toBlocks(reply.reply),
      status: reply.status,
      links: reply.links,
      suggestions: reply.suggestions,
    });
  }

  private fail(): void {
    this.push({
      from: 'noah',
      blocks: toBlocks(this.i18n.t('Noah hapatikani kwa sasa. Jaribu tena baada ya muda mfupi.')),
      status: 'unknown',
    });
  }

  private push(entry: Omit<ChatEntry, 'id'>): void {
    this.entries.update((list) => [...list, { ...entry, id: this.nextId++ }]);
    this.scrollDown();
  }

  private reset(): void {
    this.entries.set([]);
    this.draft.set('');
    this.lastModule = null;
  }

  private scrollDown(): void {
    setTimeout(() => {
      const element = this.scroller()?.nativeElement;
      element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    });
  }
}
