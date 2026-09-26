import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'grid'
  | 'users'
  | 'check'
  | 'coin'
  | 'calendar'
  | 'heart'
  | 'book'
  | 'map'
  | 'gear';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.class]="class()"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('grid') {
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        }
        @case ('users') {
          <path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19" />
          <circle cx="9.5" cy="7.5" r="3" />
          <path d="M17 5.2a3 3 0 0 1 0 5.6M21 19v-1.4a3.6 3.6 0 0 0-2.6-3.4" />
        }
        @case ('check') {
          <path d="M9 11.5 11.5 14 16 9" />
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        }
        @case ('coin') {
          <circle cx="12" cy="12" r="8" />
          <path d="M14 9.5a2.5 2.5 0 0 0-2-1c-1.2 0-2 .7-2 1.6 0 2.2 4 1.3 4 3.5 0 .9-.9 1.6-2 1.6a2.5 2.5 0 0 1-2-1M12 6.8v1.2m0 8v1.2" />
        }
        @case ('calendar') {
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3.5V6M16 3.5V6" />
        }
        @case ('heart') {
          <path d="M12 19.5s-7-4.3-7-9a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 10.5c0 4.7-7 9-7 9Z" />
        }
        @case ('book') {
          <path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z" />
          <path d="M4 17.5v1a2 2 0 0 0 2 2h13" />
        }
        @case ('map') {
          <path d="M9 4.5 3.5 6.5v13L9 17.5 15 19.5l5.5-2v-13L15 6.5 9 4.5z" />
          <path d="M9 4.5v13M15 6.5v13" />
        }
        @default {
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly class = input('h-4.5 w-4.5');
}
