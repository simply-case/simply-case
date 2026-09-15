import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { PRIVACY_URL, TERMS_URL, openContactEmail, openLegalPage } from "@/lib/links";
import { Card } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** "external" shows an arrow-out icon for rows that leave the app
   * (browser / mail) instead of the chevron used for in-app screens. */
  kind?: "screen" | "external" | "plain";
  danger?: boolean;
  isLast?: boolean;
  disabled?: boolean;
}

function SettingsRow({ icon, label, onPress, kind = "screen", danger, isLast, disabled }: SettingsRowProps) {
  const { colors, spacing, fontSize } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.accent} />
      <Text style={{ flex: 1, fontSize: fontSize.base, color: tint }}>{label}</Text>
      {kind === "screen" && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
      {kind === "external" && <Ionicons name="open-outline" size={16} color={colors.textFaint} />}
    </Pressable>
  );
}

/** A titled, rounded group of rows — rows share one card with dividers
 * between them, the standard iOS settings-list shape. */
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {title && (
        <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase", marginLeft: spacing.xs }}>
          {title}
        </Text>
      )}
      <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const { session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  /**
   * Two-step confirmation (Apple's account-deletion guidance expects this
   * not to be a single accidental tap): a native Alert explaining exactly
   * what happens, then the actual call. delete-account (unlike every other
   * function in this project) IS JWT-verified — supabase-js's
   * functions.invoke() automatically sends the current session's access
   * token as the Authorization header, which is what the function checks.
   */
  function confirmDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, your tracked cases, and your notification history. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: handleDeleteAccount },
      ],
    );
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      setDeleting(false);
      Alert.alert("Couldn't delete your account", "Please try again.");
      return;
    }
    // The account is already gone server-side; signOut() just clears the
    // now-invalid local session so the app returns to sign-in.
    await signOut();
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
      >
        <Card style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase" }}>Signed in as</Text>
          <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>{session?.user.email}</Text>
        </Card>

        <Section title="Settings">
          <SettingsRow icon="notifications-outline" label="Notification settings" onPress={() => router.push("/notifications")} isLast />
        </Section>

        <Section title="Support">
          <SettingsRow icon="help-circle-outline" label="Help & feedback" onPress={() => router.push("/help")} />
          <SettingsRow icon="mail-outline" label="Contact us" kind="external" onPress={() => openContactEmail("Simply Case support")} isLast />
        </Section>

        <Section title="Legal">
          <SettingsRow icon="document-text-outline" label="Terms of Service" kind="external" onPress={() => openLegalPage(TERMS_URL)} />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy" kind="external" onPress={() => openLegalPage(PRIVACY_URL)} isLast />
        </Section>

        <Section>
          <SettingsRow icon="log-out-outline" label="Sign out" kind="plain" onPress={confirmSignOut} />
          <SettingsRow
            icon="trash-outline"
            label={deleting ? "Deleting account…" : "Delete account"}
            kind="plain"
            danger
            disabled={deleting}
            onPress={confirmDeleteAccount}
            isLast
          />
        </Section>
      </ScrollView>
    </View>
  );
}
