import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Input } from "@/components/ui";

export default function SignInScreen() {
  const { colors, spacing, fontSize } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.text }}>Simply Case</Text>
        <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }}>
          Track your immigration case status.
        </Text>
        <PasswordForm />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Email + password is now the only auth method (magic link removed at the
 * user's request). signInWithPassword/signUp set the session directly; the
 * AuthProvider's onAuthStateChange listener (lib/auth-context.tsx) picks it
 * up and Stack.Protected in the root layout swaps screens on its own — no
 * manual navigation needed here.
 *
 * Defaults to "signup": this is a new user's very first screen, and
 * "create an account" is a more honest first ask than "sign in" for
 * someone who doesn't have one yet.
 *
 * Apple/Google sign-in are planned but NOT implemented — deliberately not
 * stubbing disabled buttons for them here, since a dead button reads as
 * broken rather than "coming soon". Tracked in docs/ROADMAP.md.
 */
function PasswordForm() {
  const { colors, spacing, fontSize } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);
    const credentials = { email: email.trim().toLowerCase(), password };

    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    setSubmitting(false);

    if (error) {
      setMessage({ text: error.message, isError: true });
      return;
    }
    // auth.email.enable_confirmations is currently OFF (see
    // supabase/config.toml), so signup returns a session immediately. This
    // branch becomes live again if confirmations are re-enabled.
    if (mode === "signup" && !data.session) {
      setMessage({ text: "Account created — check your email to confirm it.", isError: false });
    }
  }

  const canSubmit = email.length > 0 && password.length >= 6 && !submitting;

  return (
    <View style={{ gap: spacing.md }}>
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min. 6 characters)"
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        onSubmitEditing={canSubmit ? handleSubmit : undefined}
      />

      <Button
        label={mode === "signin" ? "Sign in" : "Create account"}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />

      {message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, textAlign: "center" }}
        >
          {message.text}
        </Text>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
        <Pressable
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          accessibilityRole="button"
          hitSlop={12}
        >
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </Text>
        </Pressable>

        {mode === "signin" && (
          <Link href="/forgot-password" style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            Forgot password?
          </Link>
        )}
      </View>
    </View>
  );
}
