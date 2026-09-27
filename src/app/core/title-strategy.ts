import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService, translate } from './i18n';

/** Route titles are written in Swahili as "Page · App"; each part is translated and re-applied on language change. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private source: string | undefined;

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.source = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    if (this.source) {
      this.title.setTitle(
        this.source
          .split(' · ')
          .map((part) => translate(part))
          .join(' · '),
      );
    }
  }
}
