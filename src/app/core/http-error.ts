import { HttpErrorResponse } from '@angular/common/http';

export function httpErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; errors?: Record<string, string[]> } | null;
    const firstField = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return firstField ?? body?.message ?? fallback;
  }

  return fallback;
}
