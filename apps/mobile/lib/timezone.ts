import { supabase } from "./supabase";

/**
 * Keeps profiles.timezone in step with the device's actual timezone.
 *
 * Why this exists: send-notifications evaluates each user's quiet hours in
 * profiles.timezone, but nothing ever wrote that column — every account sat
 * at the 'UTC' default from 0001_core_schema.sql. Quiet hours of 22:00-07:00
 * for someone in California were therefore applied 7 hours out, silently:
 * no error, just email at the wrong time of day. Found 2026-09-22.
 *
 * Read from the device rather than asked. The phone already knows, and
 * "what timezone are you in?" is a question with a correct answer we can
 * just look up. It also means it self-corrects when someone travels or
 * moves, which a one-time question at signup would not.
 */

/** The device's IANA timezone (e.g. "America/Los_Angeles"), or null. */
export function getDeviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : null;
  } catch {
    // Intl should always be present on Hermes, but a missing/odd
    // implementation must not take the app down over a timezone.
    return null;
  }
}

/**
 * Writes the device timezone to the user's profile when it differs from
 * what's stored. Reads first so an unchanged timezone (the overwhelmingly
 * common case, every app open) costs no write.
 *
 * Deliberately best-effort and silent: this runs on app start, and a
 * failure here must never block sign-in or surface an error to someone who
 * didn't ask for anything. A wrong timezone degrades quiet hours; a thrown
 * error here would degrade the whole app.
 */
export async function syncProfileTimezone(userId: string): Promise<void> {
  const deviceTz = getDeviceTimezone();
  if (!deviceTz) return;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .single();

    if (error || !data) return;
    if (data.timezone === deviceTz) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ timezone: deviceTz })
      .eq("id", userId);

    if (updateError) {
      console.warn("[timezone] could not update profile timezone:", updateError.message);
    }
  } catch (cause) {
    console.warn("[timezone] timezone sync failed:", cause);
  }
}
