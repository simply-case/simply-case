import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Button, Card, Input, Skeleton } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

export default function ProfileScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // RLS (0002_rls.sql: profiles_select_own) scopes this to the caller's
      // own row — there's no user_id filter to add here, same pattern as
      // the my_case_* views used elsewhere in the app.
      const { data } = await supabase.from("profiles").select("*").single();
      if (!cancelled && data) {
        setProfile(data);
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

  const startVal = quietStart.trim() === "" ? null : parseHour(quietStart);
  const endVal = quietEnd.trim() === "" ? null : parseHour(quietEnd);
  const startInvalid = quietStart.trim() !== "" && startVal === null;
  const endInvalid = quietEnd.trim() !== "" && endVal === null;
  const canSave = !startInvalid && !endInvalid && !saving;

  async function handleSaveQuietHours() {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ quiet_hours_start: startVal, quiet_hours_end: endVal })
      .eq("id", profile!.id);
    setSaving(false);
    setMessage(
      error ? { text: error.message, isError: true } : { text: "Saved.", isError: false },
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton style={{ height: 60, borderRadius: 10 }} />
          <Skeleton style={{ height: 140, borderRadius: 10 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
      >
      <Card style={{ gap: spacing.xs }}>
        <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase" }}>
          Signed in as
        </Text>
        <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
          {session?.user.email}
        </Text>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>Quiet hours</Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
          No notifications will be sent during this window, in your local time. Leave blank for no
          quiet hours.
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

        <Button label="Save" onPress={handleSaveQuietHours} loading={saving} disabled={!canSave} />

        {message && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent }}
          >
            {message.text}
          </Text>
        )}
      </Card>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
      </ScrollView>
    </View>
  );
}
