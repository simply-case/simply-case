# Simply Case — working rules

Full project context, current state, and plan live in `docs/HANDOFF.md` —
read it at the start of any session (paste/attach it, or just read the
file). This is the short, auto-loaded list of *how to work*; HANDOFF.md is
*what's going on*.

- **Ask before `git commit`, `git push`, and before writing summary or
  handoff docs.** Say what you intend to do and wait for a yes.
- **After every commit, explain in plain language** what went in and why
  — a few lines, not a changelog.
- **Feature branch per feature → PR → `main`.** Never commit directly to
  `main`.
- **Don't change things not asked for** — especially sign-in/sign-up —
  without asking first, even a small "while I'm here" refactor. Propose
  it instead.
- **Flag every `supabase db push` / `supabase config push` before running
  it.** One Supabase project is shared by every branch, so a push from
  anywhere hits production immediately. Always `--dry-run` / `config diff`
  first.
- **Never print secret values.** Presence-check instead
  (`grep -c "^KEY=" file`), or compare SHA-256 digests.
- **Verify against the live system, not exit codes or assumptions.** Most
  real bugs here were "successful" commands that didn't actually work.
- **Be honest about uncertainty.** Say "unverified" rather than claim a
  fix works before seeing it work.
- **Explain things simply.** The user is not deeply technical — short,
  step-by-step, plain-language answers, including what a migration, a
  database column, or a bug actually means when asked.
- **Pin the Supabase CLI version** (e.g. `npx supabase@2.117.0 ...`)
  rather than bare `npx supabase` — the cached version drifts between
  sessions, and an uncached one triggers an interactive install prompt
  that fails non-interactively.
- **Always `npm run typecheck` immediately after regenerating
  `database.types.ts`.** A corrupted redirect (the CLI's own "update
  available" nag captured into the file) won't look wrong at a glance.
- **When asked to find unused files, list them — don't delete.** The user
  reviews and deletes manually.
- **The repo is public.** Never commit secrets, real case numbers, or
  text pasted from elsewhere that isn't ours to redistribute — gitignore
  that instead of committing it.
- **Don't assume a device test used a true cold start.** Backgrounding
  and resuming Expo Go doesn't remount app state the way a real relaunch
  does. Ask how it was tested, or have the user force-quit first, before
  concluding the code itself is wrong.
