import { HttpErrorResponse } from '@angular/common/http';
import { translate } from './i18n';

/** Server messages and the fallback are both passed through the dictionary, so Swahili API errors show in English too. */
export function httpErrorMessage(error: unknown, fallback = 'Hitilafu imetokea.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; errors?: Record<string, string[]> } | null;
    const firstField = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return translate(firstField ?? body?.message ?? fallback);
  }

  return translate(fallback);
}
