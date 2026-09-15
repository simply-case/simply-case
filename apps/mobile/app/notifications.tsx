import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Card, Input, Skeleton } from "@/components/ui";

/** "" / null both mean "not set" in the UI; only a valid 0-23 integer is
 * sent to the database. Kept as strings while editing so the field can be
 * legitimately empty mid-edit without coercing to 0. */
function hourToInput(h: number | null): string {
  return h === null || h === undefined ? "" : String(h);
}

function parseHour(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 23) return null;
  return n;
}

/**
 * Notification settings, reached from Profile. Currently just quiet hours
 * (moved here from the Profile screen) — email is the only channel, push
 * is paused until the Apple Developer account exists (HANDOFF §5).
 */
export default function NotificationSettingsScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // RLS (0002_rls.sql: profiles_select_own) scopes this to the caller's
      // own row — no user_id filter needed.
      const { data } = await supabase.from("profiles").select("id, quiet_hours_start, quiet_hours_end").single();
      if (!cancelled && data) {
        setProfileId(data.id);
        setQuietStart(hourToInput(data.quiet_hours_start));
        setQuietEnd(hourToInput(data.quiet_hours_end));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const startVal = parseHour(quietStart);
  const endVal = parseHour(quietEnd);
  const startInvalid = quietStart.trim() !== "" && startVal === null;
  const endInvalid = quietEnd.trim() !== "" && endVal === null;
  const canSave = !!profileId && !startInvalid && !endInvalid && !saving;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ quiet_hours_start: startVal, quiet_hours_end: endVal })
      .eq("id", profileId!);
    setSaving(false);
    setMessage(error ? { text: error.message, isError: true } : { text: "Saved.", isError: false });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Skeleton style={{ height: 180, borderRadius: 16 }} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card style={{ gap: spacing.xs }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>Email notifications</Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
          We email you when a USCIS case status changes. Visa (NVC / DS-160) cases only update when you refresh
          them yourself.
        </Text>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>Quiet hours</Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
          No notifications will be sent during this window, in your local time. Leave blank for no quiet hours.
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Start (0-23)"
              value={quietStart}
              onChangeText={setQuietStart}
              keyboardType="number-pad"
              placeholder="e.g. 22"
              error={startInvalid ? "0-23" : undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="End (0-23)"
              value={quietEnd}
              onChangeText={setQuietEnd}
              keyboardType="number-pad"
              placeholder="e.g. 7"
              error={endInvalid ? "0-23" : undefined}
            />
          </View>
        </View>

        <Button label="Save" onPress={handleSave} loading={saving} disabled={!canSave} />

        {message && (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent }}>
            {message.text}
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}
