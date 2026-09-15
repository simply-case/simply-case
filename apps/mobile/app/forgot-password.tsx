import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Input } from "@/components/ui";

/**
 * Resolves to exp://…/--/auth/confirm in Expo Go, or mycasepro://auth/confirm
 * in a dev-client/standalone build. Hardcoding the scheme would silently
 * break Expo Go, which is where most testing happens.
 */
const redirectTo = makeRedirectUri({ path: "/auth/confirm" });

export default function ForgotPasswordScreen() {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSend() {
    setSending(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    setSending(false);

    // Always phrased as "if an account exists" — confirming whether an
    // address is registered would make this screen an account-enumeration
    // tool. Only genuine send failures (rate limits, etc.) surface as errors.
    setMessage(
      error
        ? { text: error.message, isError: true }
        : {
            text: `If an account exists for ${email.trim()}, a reset link is on its way.`,
            isError: false,
          },
    );
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
          Reset your password
        </Text>
        <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }}>
          We&apos;ll email you a link to set a new one.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            onSubmitEditing={email.length > 0 ? handleSend : undefined}
          />
          <Button label="Send reset link" onPress={handleSend} loading={sending} disabled={email.length === 0} />

          {message && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, textAlign: "center" }}
            >
              {message.text}
            </Text>
          )}

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            hitSlop={12}
            style={{ marginTop: spacing.md }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.link, textAlign: "center", fontWeight: "600" }}>
              ← Back to sign in
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
