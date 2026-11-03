// Vercel serverless entry → Angular SSR Express handler (dist/cms/server/server.mjs).
export default import('../dist/cms/server/server.mjs').then((module) => module.reqHandler);
