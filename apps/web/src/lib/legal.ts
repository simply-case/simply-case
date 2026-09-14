/**
 * Contact address shown on the Terms and Privacy Policy pages.
 *
 * PLACEHOLDER — the user is creating a dedicated address later (decided
 * 2026-09-13, docs/PHASE_F_PLAN.md). This is the ONE place it's defined;
 * both legal pages import it, so replacing the placeholder before launch
 * is a one-line change here, not a find-and-replace across the app.
 *
 * ⚠️ LAUNCH BLOCKER: this must be replaced with a real, monitored address
 * before any real user (beyond the account owner) can sign up — it's
 * where someone would write to ask for their data to be deleted.
 */
export const LEGAL_CONTACT_EMAIL = "contact@REPLACE-BEFORE-LAUNCH.invalid";

/** "Last updated" date shown on both legal pages — bump when the text changes. */
export const LEGAL_LAST_UPDATED = "September 13, 2026";
