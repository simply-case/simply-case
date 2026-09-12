# Simply Case (mycase pro) — session handoff

Written 2026-09-12, mid-session, at the user's request. This is a snapshot,
not a replacement for `docs/HANDOFF.md` (broader project history) or
`docs/ROADMAP.md` (the phased plan this session has been executing).

---

## ⚠️ How the user wants you to work (standing instructions)

**Ask before committing, pushing, or writing summary/handoff docs.** Say
what you intend to do and wait for a yes. This was corrected on
2026-09-12 — an earlier version of the project memory said "committing
locally is fine without asking," and that is no longer true. Both commits
and pushes are now gated.

**After every commit, explain it in plain language.** What went in, why,
and anything worth knowing. A few lines, not a changelog, and not a wall
of technical jargon — the user wants to actually understand what entered
their git history.

**Pushes are still the highest-stakes step** — a push to `main`
auto-deploys the web app to Vercel, so it's a production deploy, not a
code sync.

**Other standing rules** (from `docs/HANDOFF.md`, still in force):
feature branch per feature → PR → `main`; flag any `supabase db push` or
`config push` before running it (one shared Supabase project across all
branches); never print secret values; verify against the running
app/live project rather than assuming.

**Model split:** Opus for plans, ideas, and questions. Sonnet 5 for
coding and execution. Flag the switch when moving between the two.

---

## Goal (this session)

Two threads, run back to back:

1. **Ship and deploy** three already-built feature branches (backend
   observability, mobile UI pass, web UI pass) that existed from a prior
   session — review, fix bugs found in review, push, merge, deploy the
   backend pieces that don't auto-deploy.
2. **Live mobile UI development** — once merged, start iterating on the
   mobile app's design with the user watching a simulator in real time via
   Expo Go + Fast Refresh, rebranding it from placeholder "mycase pro" to
   the real "Simply Case" identity (logo assets the user supplied),
   restructuring navigation into a 4-tab layout, and fixing UI issues as
   the user spots them live.

---

## Where things stand right now

**Branch:** `feature/mobile-branding`. One commit (`cc9e02e`), **committed
locally but NOT pushed**. Created as a fresh branch because this work had
been accumulating on `fix/deploy-corrections`, which should only contain
the earlier cron-query fix.

⚠️ Note: that commit was made WITHOUT asking first, which the user
subsequently corrected (see the standing instructions at the top of this
file). Going forward, ask before committing.

**Verified clean right now:** `npm run typecheck` (mobile + web + shared),
`npm test` (48/48 pass). Not yet re-verified live in the simulator since
the last fix (see "in-flight" below) — Metro and the simulator were both
shut down partway through and haven't been restarted.

---

## What's already live in production

Three PRs merged to `main`, all pushed and confirmed on GitHub:
- `feature/backend-hardening` → PR #2
- `feature/mobile-ui` → PR #3
- `feature/web-ui` → PR #4
- Plus one follow-up commit `95b9a65` (dark-mode focus-ring fix, found in
  a re-review before merge) and `b16c50e` (fixed a broken SQL query in
  `scripts/check-poll-health.sql`, and corrected an inaccurate commit
  message claim — see "what didn't work" below).

**Backend deploy status (verified against the live Supabase project, not
assumed):**
- `check-cases` Edge Function deployed with `--no-verify-jwt --use-api`
  (the flag is mandatory — cron auth is a shared-secret header, not a JWT).
- Migrations 0009 (`poll_runs` table) and 0010 (push-queue constraint
  widen) applied — confirmed via `supabase migration list`, 0001-0010 all
  in sync, no drift.
- Confirmed live: cron fired at 03:15 UTC and wrote a real `poll_runs` row
  (`claimed: 0, crashed: false`) — proof the new code is actually running,
  not just that the CLI reported success.

**Still open from that work**, unrelated to the current UI thread:
rotating 3 credentials, deleting a test admin account, enabling
`secure_password_change`, USCIS production access (user said not to worry
about this one for now).

---

## Active files (the mobile branding work)

**Config / assets:**
- `apps/mobile/app.json` — renamed app to "Simply Case", real app icon,
  `expo-splash-screen` plugin configured. **Just cleaned up**: an earlier
  pass (mid-session, different model) had added a legacy top-level
  `splash` key that duplicated/conflicted with the modern plugin config —
  removed, plugin config is now the only source of truth.
- `apps/mobile/assets/` — new real logo assets from the user
  (`icon.PNG`, `iconandwriting.PNG`, `simplycase.png` are the raw
  sources; `app-icon.png`, `splash-logo.png`, `header-logo.png` are
  processed/derived versions actually referenced by code/config).

**Navigation restructure** (Stack → 4-tab `Tabs` layout):
- `apps/mobile/app/(app)/_layout.tsx` — now a `Tabs` layout: Cases (own
  nested stack) · News · More · Profile.
- `apps/mobile/app/(app)/index.tsx` — new. A Tabs layout has no implicit
  `/` route the way a Stack's `index.tsx` did; this redirects `/` to
  `/cases` and is hidden from the tab bar (`href: null`).
- `apps/mobile/app/(app)/cases/_layout.tsx` — new. Nested Stack for the
  Cases tab (list → detail).
- `apps/mobile/app/(app)/cases/index.tsx` — the case list, moved here
  from the old flat `(app)/index.tsx`. Header row removed (email/sign-out
  moved to the new Profile tab); now renders `<AppHeader/>` itself since
  its Stack header is hidden.
- `apps/mobile/app/(app)/news.tsx`, `more.tsx`, `profile.tsx` — new
  screens. News is explicitly placeholder content (see comment in the
  file — no real content source has been picked). Profile has a working
  quiet-hours editor wired to the real `profiles` table.
- `apps/mobile/components/AppHeader.tsx` — new shared header component
  (wordmark logo, top-left) used by all 4 tab roots, since the Tabs
  layout's own header is off (`headerShown:false` at the Tabs level) to
  avoid double-rendering with the Cases tab's nested Stack header.

**Design tokens:**
- `packages/shared/src/theme.ts` — repainted from the original
  warm/editorial palette to a "crisp & official" direction per the user's
  choice: cooler neutral grays, sharper corners, navy accent
  (`#0C3D81`) sampled directly from the real logo file.

**Auth flow:**
- `apps/mobile/app/sign-in.tsx` — now defaults to sign-up mode ("Create
  account" is the first thing a new user sees, not "Sign in"), per the
  user's explicit request. Apple/Google sign-in noted as planned in a
  comment, deliberately NOT stubbed as dead buttons.
- `apps/mobile/app/reset-password.tsx`, `apps/mobile/app/auth/confirm.tsx`
  — updated their `router.replace("/")` calls to account for the Tabs
  restructure (briefly broken, then fixed — see below).

---

## What worked

- **Fast Refresh + Expo Go loop.** Once Metro was running and Expo Go was
  pointed at it (`npx expo start --go`, then `xcrun simctl openurl <udid>
  "exp://127.0.0.1:8081"`), edits landed on the simulator in ~1s and the
  user could react to real screenshots. This was the whole point of the
  session and it worked well.
- **Extracting real design values from the user's logo files** (via
  `sharp`, since no ImageMagick/PIL was installed) rather than guessing —
  sampled the exact navy hex (`#0C3D81`) directly from the icon PNG for
  the new accent color, and used `sharp().trim()` to detect and quantify
  baked-in transparent padding in the source assets before it became a
  visible bug (see below).
- **Reviewing before merging** caught a real dark-mode bug (hardcoded
  white `ring-offset-color` on buttons) and a real logic bug in the status
  classifier (a status meaning "already responded" was being classified
  as "action needed" — the worst possible misclassification for this
  app) before either reached production.
- **Verifying deploys against the live database** instead of trusting CLI
  exit codes — caught that `pod install` had silently failed (exit code 0
  reported, but the built `.app` bundle was empty) and that a background
  build process's "completed successfully" notification was also wrong
  for the same reason.

## What didn't work / mistakes made and corrected

- **Space in the project's folder path** (`personal projects`, not
  `personal-projects`) breaks native iOS builds — a CocoaPods script phase
  runs via `bash -l -c "$PATH/script.sh"` unquoted, so the shell splits on
  the space and the build fails with a "No such file or directory" error
  that doesn't obviously point at the real cause. This blocked every
  `npx expo run:ios` attempt. **Not yet fixed** — the folder has not been
  renamed (user's call to make, since other projects share that
  directory). Workaround in use: Expo Go (`npx expo start --go`) instead
  of a native dev build. This is suffficient for UI work but will block
  push notifications later, which genuinely need a dev build.
- **Two exit-code-0 lies in a row** during dev-build attempts: a `pod
  install` failure and a stale-Pods `xcodebuild` failure both reported
  success while actually failing. Root cause both times: native package
  versions were bumped (`npx expo install --fix`) *after* pods were
  already installed, invalidating `Podfile.lock`. Lesson recorded: update
  packages BEFORE building, never after.
- **A Tabs layout has no implicit `/` route.** Converting `(app)` from a
  Stack to a Tabs layout broke `router.replace("/")` in two files
  (silently — "Unmatched Route" was only caught by actually reloading the
  app and screenshotting it, not by typecheck, since the route literal
  was still technically a valid string until the types regenerated).
  Fixed with a hidden redirect file — see `(app)/index.tsx` above.
- **Expo Router's generated route types go stale** and don't reliably
  regenerate from file edits alone while a dev server is already running
  — had to kill Metro, delete `.expo/types/router.d.ts`, and do a full
  cold restart to force a re-scan after adding/moving routes. This cost
  real time twice in this session; worth remembering for next time a
  route is added or moved.
- **Two source logo assets had heavy baked-in transparent padding**
  (81% on the wordmark, 40% on the splash lockup, 31% on the app icon)
  that wasn't obvious from looking at the files casually — only found by
  measuring with `sharp().trim()`. This caused two rounds of "the logo
  looks small/has a white border around it" feedback before being
  properly fixed by trimming the source before compositing, not just
  resizing it.
- **A legacy top-level `app.json` "splash" key got added mid-session**
  (during a different model's turn) that duplicated and partially
  conflicted with the already-correct `expo-splash-screen` plugin config.
  Removed. Worth double-checking `app.json` after any session handoff for
  this kind of accidental duplication.
- **This mobile branding work was accumulating on the wrong git branch**
  (`fix/deploy-corrections`, which should only contain the earlier
  cron-query fix). Moved to a fresh `feature/mobile-branding` branch just
  now, before committing. **Not yet committed or pushed.**
- **Model-switching mid-session** (Sonnet → Opus → Sonnet → Haiku →
  Sonnet, per the user's own `/model` commands) means some context (e.g.
  the exact reasoning behind a specific in-progress fix) may not have
  carried perfectly across the switches. This file exists partly to
  paper over that.

---

## Planned next actions

**Immediate (blocking further live UI work):**
1. Restart Metro (`cd apps/mobile && npx expo start --go`) and the iOS
   simulator, reopen Expo Go, and re-verify the two most recent fixes
   live (they're only verified by static file inspection right now, not
   by looking at the running app):
   - App icon should no longer show a visible white border/margin around
     the navy mark (was 31% baked-in padding, now trimmed).
   - Nickname field should no longer auto-capitalize the first letter.
2. Get the user's reaction to News/More/Profile tabs (only Cases has been
   visually confirmed live so far).

**Soon:**
3. Commit and push `feature/mobile-branding`, open a PR.
4. Splash screen is configured but **cannot be verified in Expo Go** —
   Expo Go always shows its own loading UI, never the app's real splash.
   Only verifiable in a real dev build, which is blocked on the
   space-in-path issue.
5. Decide on the folder rename (`personal projects` → `personal-projects`)
   whenever push notifications or another dev-build-requiring feature
   becomes the priority. Not urgent before then.
6. Pick a real News tab content source (RSS feed, licensed API, or manual
   posts) — currently placeholder sample cards only, explicitly marked as
   such in the code.
7. Consider Android — no Android SDK is installed on this machine, so
   nothing has been visually verified on Android at all, only iOS.

**Not forgotten, just lower priority** (from the earlier backend-hardening
thread): rotate 3 live credentials, delete the disposable test admin
account, enable `secure_password_change`, USCIS production-access
application (explicitly deprioritized by the user for now).
