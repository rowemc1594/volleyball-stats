# Side Out Stats: Development Plan

Handoff spec for building with Claude Code. UX reference prototype (claude.ai-hosted, not the production base): https://claude.ai/artifact/Jqu5t5qzihJyimY9wwZgFG

## 1. Goal and users
A fast, simple volleyball stat tracker for one 15-year-old's team. A parent taps stats courtside on an iPhone; other parents and coaches view results.

- **Recorder** (Mike, maybe one other parent): enters stats, manages matches. Needs one-handed, no-scroll entry that tolerates a bad gym signal.
- **Viewers** (parents, coach): read-only, ideally with just a link and no account.

**Non-goals (v1):** full team stats, rotations, serve-receive zones, blocks/digs/assists, live scoreboards, per-point rally tracking.

## 2. Decisions and open questions
| # | Item | Status |
|---|------|--------|
| D1 | Scope: track a single player (the son). Model keeps `player_id` so team tracking is a later add. | Decided |
| D2 | Stats: passing (0-3), serving (ace/in/error), hitting (kill/in/error). | Decided |
| D3 | True installable PWA with offline entry, plus shared data. | Decided |
| D4 | Database and auth: **Supabase** (Postgres, row-level security, magic-link email sign-in for the recorder). | Decided |
| Q2 | Viewer access: public read-only link (recommended) vs. login required. Working assumption: public read-only link. Privacy note: the data concerns a minor's performance, so use an unguessable share token and no personal data beyond first name and jersey number. | Open, confirm |
| D5 | Hosting: **GitHub Pages** from a public repo, deployed by GitHub Actions, served from a subpath (`/volleyball-stats/`). | Decided |
| Q4 | Should viewers see a match live while it's being tracked? Recommended: yes, via refresh on focus. Realtime is optional. | Open |

## 3. Stat definitions
Collected from standard volleyball statistics sources.

- **Pass (serve receive), 0-3:** 3 = setter can run any play; 2 = setter has two options, ball off the net slightly; 1 = playable, only a high ball; 0 = aced or shanked.
  - Pass average = (1·n1 + 2·n2 + 3·n3) / total passes. 2.0 or higher is solid at this level.
- **Serve:** Ace, In (in play, no point), Error.
  - Serve-in % = (aces + in) / serves. Ace % = aces / serves. Error % = errors / serves.
- **Hit:** Kill, In (continues the rally: dug or blocked and kept in play), Error (out, net, or blocked for a point).
  - Hitting % = (kills − errors) / total attempts. Around .200 is good at this age; .300 or higher is excellent.
  - Attempts = kills + in + errors.
- Every stat is attached to a **set**, which belongs to a **match**. Season totals are derived, never stored.

## 4. Data model
Event-sourced and append-only. Aggregates are computed from events.

```
players      id, name, jersey, owner_id
matches      id, player_id, opponent, match_date, event, sets (count), scores {n:{us,them}}, done (bool), created_at
sets         id, match_id, set_number, score_us, score_them
events       id (client-generated UUID), set_id, match_id, kind ('pass'|'serve'|'hit'),
             value (pass: 0-3; serve: 'ace'|'in'|'error'; hit: 'kill'|'in'|'error'),
             occurred_at, deleted_at (soft delete for undo)
share_links  id, player_id, token (random, unguessable), created_at, revoked_at
```

Rules:
- Event IDs are generated on the device. Inserts are **idempotent** (`upsert` on `id`), so a retried sync never double-counts.
- Undo marks the last event `deleted_at` and does not remove the row.
- Aggregates come from a SQL view or computed client-side; at roughly 300 events per match, client-side is fine.

## 5. UX spec

**Visual direction:** dark "courtside console", based on the Gemini-made design the owner prefers. Deep navy background, rounded cards, a sky-blue active tab with glow, and colour-coded gradient tap buttons (green = good/point, blue = playable, amber = out of system, red = error, gray = neutral in-play). Large mono numerals for stats, a small count badge on every button. Dark theme only. Reference: the prototype link above.

**Flow (match first):** the app opens on **Matches**, never on a bare tracking screen. Sets only exist inside a match.
1. **Matches home:** "Resume match" shortcut if one is active, a "Start a match" form (opponent, date, optional event), the list of past matches, and a player card (name, jersey).
2. **Start match** creates the match with Set 1 and launches **Track**.
3. **Track** is for that match only. Leaving returns to Matches.
4. **Season** tab on the home screen shows totals and a table by match; tapping a match opens **Match details** (stats by set, set scores, delete).

**Track screen:**
- Sticky header: logo (returns to Matches), "<Name>'s Stats", sub-line "vs Opponent · date", sync dot, **Undo**, and a details button.
- Set tabs: **All Sets** | Set 1 | Set 2 | … Opens on the latest set. Taps in All Sets record to the latest set.
- **Score** card under the Serving band: Us / Them with − and + buttons for the current set (stored as the set's score, so End Set pre-fills it).
- **End Set N** button under the Score card opens a sheet: optional final score (Us / Them), then **Start Set N+1** or **Finish match**. Finishing creates no empty extra set; it marks the match Final and opens the match summary. Final matches show a Final tag and sets-won in the Matches list, disable the tap buttons, and can be reopened.
- Summary card: Pass Avg, Hit %, Serve In % with sub-counts, scoped to the selected tab.
- Three bands, each with a live readout and big targets (about 70pt tall):
  - Serve Receive (0–3): 3 Perfect, 2 Playable, 1 OOS, 0 Error. Readout: In-Sys % (3s + 2s).
  - Attacking / Hitting: Kill, Play (in-play), Err.
  - Serving: Ace, In, Fault.
- Live action history (last 10 touches, each removable) and a **Copy Text Report** button.
- Controls fit above the fold on an iPhone; only the history scrolls.
- Keep the screen awake while tracking (Wake Lock, re-requested on visibility change).

**Viewer mode:** same Matches and Stats screens; no start-match form and disabled tap buttons.

## 6. Architecture
- **Frontend:** Vite + TypeScript + Preact (or React). Small bundle, no routing library needed (hash routes for track / matches / stats).
- **PWA:** `vite-plugin-pwa` (Workbox). `manifest.webmanifest` with name, icons (180, 192, 512, maskable), `display: standalone`, theme color, `apple-touch-icon` and iOS meta tags. Precache the app shell.
- **Offline storage:** IndexedDB via Dexie.
  - Local DB is the source of truth for the UI.
  - An **outbox** table queues writes.
  - On `online`, on app focus and on a timer, drain the outbox to Supabase.
  - iOS Safari has **no Background Sync**, so sync happens only while the app is open or foregrounded. Say so in the UI ("N to sync").
- **Backend:** Supabase.
  - Tables as in section 4.
  - **RLS:** the owner (authenticated) has full access to their player's rows. Anonymous read access comes only through a `SECURITY DEFINER` RPC (for example `get_shared_stats(token)`) that checks a non-revoked share token. Never open table-level anon read.
  - Auth: email magic link for the recorder(s) only.
- **Hosting:** GitHub Pages (public repo) deployed by a GitHub Actions workflow. HTTPS is required for service workers and is provided. The app is served from a subpath, so set Vite `base` to `/volleyball-stats/`, keep the manifest `start_url` and `scope` relative to it, and register the service worker with the same scope. Use hash routes so deep links work without server rewrites. Only the Supabase URL and anon key are in the client; never commit a service_role key.
- **Tests:** Vitest for the stat math (pass average, hit %, serve %, edge cases of zero attempts and negative hit %); Playwright for the tap, undo and offline-then-sync flow, including iPhone viewport emulation.

## 7. Build phases (each ends with a runnable, testable state)

1. **Scaffold and stat engine.** Vite/TS app, deploy pipeline, pure stat functions with unit tests. *Done when:* the stat tests pass and a blank app deploys over HTTPS.
2. **Local-only tracker.** Track screen, sets, matches, undo, IndexedDB, Stats screen. *Done when:* a full match can be entered with airplane mode on and totals are correct after a reload.
3. **PWA install and iOS polish.** Manifest, icons, service worker, wake lock, safe-area insets, no-scroll layout at 375×667 and up. *Done when:* it installs via Add to Home Screen, launches standalone, and works offline cold-start.
4. **Cloud sync and auth.** Supabase schema, RLS, magic-link login, outbox sync, idempotent upserts, sync status chip. *Done when:* events entered offline appear on a second device after reconnect, with no duplicates after forced retries.
5. **Sharing and viewer mode.** Share-token RPC, read-only views, revoke link, copy summary. *Done when:* an incognito browser with the link sees the stats, cannot write, and loses access once the link is revoked.
6. **Hardening.** Empty and error states, accessibility pass (focus states, contrast, reduced motion), and a real-match field test.

## 8. Risks and mitigations
- **iOS PWA quirks:** no install prompt (show Add to Home Screen instructions); storage can be evicted for sites that aren't installed (prompt to install; keep the outbox small; sync often); no Background Sync (sync on foreground).
- **Lost taps at the gym:** local-first writes and the outbox mean no tap depends on the network. Show unsynced count prominently.
- **Double counting:** client UUIDs plus upserts.
- **Privacy (minor's data):** unguessable share tokens, revocable, minimal personal data, no analytics trackers.
- **Scope creep:** v1 is three stats for one player. Anything else goes in a v2 list.

## 9. Acceptance for v1
- Start a match, then enter a 3-set match (about 120 taps) without scrolling, with a sync indicator that is always accurate.
- Works in airplane mode from a cold start, and syncs on reconnect without duplicates.
- Season and per-match stats match a hand calculation on a sample match.
- A parent opens a shared link on their phone and reads the season and match stats with no account.

## 10. First prompt for Claude Code
"Read CLAUDE.md and docs/PLAN.md. Do Phase 1 only: scaffold the Vite + TypeScript + Preact app with `vite-plugin-pwa`, with Vite `base` set to `/volleyball-stats/`. Implement the stat engine from section 3 with Vitest tests. Add a GitHub Actions workflow that builds and deploys to GitHub Pages. Explain any manual step I need to do in GitHub's settings. Stop and show me the test output before starting Phase 2."
