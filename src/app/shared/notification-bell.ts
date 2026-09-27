import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { I18nService, TranslatePipe } from '../core/i18n';
import { InboxItem, MessagesService } from '../core/messages';
import { Icon } from './icon';

const POLL_MS = 60_000;

@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Icon, TranslatePipe],
  host: {
    class: 'relative',
    '(document:click)': 'closeIfOutside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <button
      type="button"
      class="relative rounded p-1.5 text-muted hover:bg-sunken hover:text-ink"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="unread() ? ('Arifa {count} mpya' | t: { count: unread() }) : ('Arifa' | t)"
      [title]="'Arifa' | t"
      (click)="toggle()"
    >
      <app-icon name="bell" class="h-5 w-5" />
      @if (unread()) {
        <span
          class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-negative px-1 text-center text-[0.6rem] leading-4 font-medium text-canvas tabular-nums"
        >
          {{ unread() > 9 ? '9+' : unread() }}
        </span>
      }
    </button>

    @if (open()) {
      <section
        class="alert-in absolute right-0 z-40 mt-2 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded border border-line bg-surface shadow-lg sm:w-96"
        role="dialog"
        [attr.aria-label]="'Arifa' | t"
      >
        <header class="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 class="font-serif text-base">{{ 'Arifa' | t }}</h2>
          @if (unread()) {
            <button type="button" class="text-xs text-brass-strong hover:underline" (click)="markAll()">
              {{ 'Weka zote zimesomwa' | t }}
            </button>
          }
        </header>
        <ul class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          @for (item of items(); track item.id) {
            <li>
              <button
                type="button"
                class="block w-full px-4 py-3 text-left hover:bg-sunken"
                [class.bg-brass-tint]="!item.read_at"
                (click)="read(item)"
              >
                <span class="flex items-start justify-between gap-2">
                  <span class="text-sm" [class.font-medium]="!item.read_at">
                    {{ item.title || ('Ujumbe kutoka {sender}' | t: { sender: item.sender || ('parokia' | t) }) }}
                  </span>
                  @if (!item.read_at) {
                    <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass-strong" [attr.aria-label]="'Mpya' | t"></span>
                  }
                </span>
                <span class="mt-1 block text-xs leading-relaxed whitespace-pre-wrap text-muted"
                      [class.line-clamp-3]="expanded() !== item.id">{{ item.body }}</span>
                <span class="mt-1 block text-[0.65rem] text-faint">
                  {{ item.sender }} · {{ item.created_at | date: 'd MMM y, HH:mm' : undefined : i18n.dateLocale() }}
                </span>
              </button>
            </li>
          } @empty {
            <li class="px-4 py-8 text-center text-sm text-muted">{{ 'Huna arifa bado.' | t }}</li>
          }
        </ul>
      </section>
    }
  `,
})
export class NotificationBell {
  private readonly messages = inject(MessagesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly i18n = inject(I18nService);

  protected readonly open = signal(false);
  protected readonly unread = signal(0);
  protected readonly items = signal<InboxItem[]>([]);
  protected readonly expanded = signal<number | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      void this.load();
      const timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void this.load();
        }
      }, POLL_MS);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  protected closeIfOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) {
      void this.load();
    }
  }

  protected async read(item: InboxItem): Promise<void> {
    this.expanded.update((current) => (current === item.id ? null : item.id));

    if (item.read_at) {
      return;
    }

    const readAt = new Date().toISOString();
    this.items.update((list) => list.map((entry) => (entry.id === item.id ? { ...entry, read_at: readAt } : entry)));
    this.unread.update((count) => Math.max(0, count - 1));

    try {
      await this.messages.markRead(item.id);
    } catch {
      void this.load();
    }
  }

  protected async markAll(): Promise<void> {
    const readAt = new Date().toISOString();
    this.items.update((list) => list.map((entry) => ({ ...entry, read_at: entry.read_at ?? readAt })));
    this.unread.set(0);

    try {
      await this.messages.markAllRead();
    } catch {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      const inbox = await this.messages.inbox();
      this.unread.set(inbox.unread);
      this.items.set(inbox.items);
    } catch {
      // The bell is secondary; a failed poll just waits for the next one.
    }
  }
}
