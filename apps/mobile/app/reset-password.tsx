import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Input } from "@/components/ui";

/**
 * Reached after auth/confirm.tsx turns a recovery deep link into a session,
 * so the user is already authenticated here — updateUser() can set a new
 * password without needing the old one.
 */
export default function ResetPasswordScreen() {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm && !saving;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    // Session is already active, so the root layout's Stack.Protected will
    // render the app group — replace() just clears this screen off the stack.
    // (app)/index.tsx redirects "/" to "/cases" (a Tabs layout has no
    // implicit index the way a Stack's index.tsx did).
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>
          Set a new password
        </Text>
        <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }}>
          Choose a password you&apos;ll use to sign in from now on.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 6 characters"
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            autoComplete="new-password"
            error={tooShort ? "Password must be at least 6 characters." : undefined}
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter your new password"
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            autoComplete="new-password"
            error={mismatch ? "Passwords don't match." : undefined}
            onSubmitEditing={canSubmit ? handleSave : undefined}
          />

          <Button label="Save password" onPress={handleSave} loading={saving} disabled={!canSubmit} />

          {error && (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: fontSize.sm, color: colors.danger, textAlign: "center" }}>
              {error}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
