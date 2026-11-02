# Volleyball Stats (Side Out Stats)

A simple volleyball stat tracker PWA for a youth team. Passing, serving and hitting, across sets and matches. Read `docs/PLAN.md` first and follow it phase by phase.

## Rules
- Work **one phase at a time**. After each phase: run the tests, summarize what changed, **stop and wait for approval** before starting the next phase.
- UX reference: `docs/prototype.html`, a working prototype. Match its screens, flow and look. Do not copy its storage code (it uses claude.ai-only APIs); replace it with local IndexedDB plus Supabase.
- Stack: Vite + TypeScript + Preact, vite-plugin-pwa, Dexie (IndexedDB), Supabase (Postgres, RLS, magic-link auth), Vitest, Playwright.
- Hosting: GitHub Pages from a public repo, deployed by GitHub Actions, served from the subpath `/volleyball-stats/`. Set Vite `base` accordingly. The manifest `start_url`/`scope` and the service worker must work under that subpath. Use hash routes.
- Secrets: never commit secrets. Only the Supabase URL and anon key may be in client code (env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Never use the service_role key in the app.
- Privacy: the data concerns a minor. Viewer access only through an unguessable, revocable share token via a SECURITY DEFINER RPC. No table-level anonymous read. No analytics or trackers.
- Offline first: every tap writes to IndexedDB immediately and syncs later through an outbox. Event IDs are client-generated UUIDs and writes are idempotent.
- Stat definitions in `docs/PLAN.md` section 3 are authoritative. Unit-test them.
- Commit after each phase with a clear message.
- The owner is not a terminal expert. Explain commands and any manual step (for example SQL to paste into the Supabase SQL editor) in plain language.
