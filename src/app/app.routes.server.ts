import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Rendered per request: both routes depend on a session that only exists in
    // the browser, so there is nothing stable to prerender.
    path: '**',
    renderMode: RenderMode.Server,
  },
];
