import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

/** Placeholder stamped onto `ngCspNonce` / inline scripts at build time; replaced per request. */
const CSP_NONCE_PLACEHOLDER = 'NG_CSP_NONCE';

const app = express();
const angularApp = new AngularNodeAppEngine();

/** Origins the SPA may call. Local Laravel plus the production API on Vercel. */
const apiConnect =
  process.env['API_ORIGIN'] ??
  'http://127.0.0.1:8000 http://localhost:8000 https://chrms-api.vercel.app';

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Angular SSR hydration / event-replay injects inline scripts; they carry this nonce.
    `script-src 'self' 'nonce-${nonce}'`,
    // Google Fonts: CSS from fonts.googleapis.com, font files from fonts.gstatic.com.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    `connect-src 'self' ${apiConnect} https:`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 * Per-request CSP nonce so SSR inline scripts (hydration / event replay) are allowed.
 */
app.use((req, res, next) => {
  const nonce = randomBytes(16).toString('base64url');
  res.setHeader('Content-Security-Policy', buildCsp(nonce));

  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        return writeResponseToNodeResponse(response, res);
      }

      const body = (await response.text()).replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
      await writeResponseToNodeResponse(new Response(body, response), res);
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
