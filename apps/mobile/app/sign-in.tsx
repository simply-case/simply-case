import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { PRIVACY_URL, TERMS_URL } from "@/lib/links";
import { Button, Input } from "@/components/ui";

// The combined wordmark + icon lockup used on the splash screen (app.json
// -> expo-splash-screen). It's flat navy with no dark-mode variant, but
// app.json pins userInterfaceStyle to "light" app-wide, so useTheme() here
// always resolves to the light palette anyway — safe to use as-is.
const LOGO = require("../assets/splash-logo.png");

export default function SignInScreen() {
  const { colors, spacing } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <Image source={LOGO} style={{ width: 168, height: 148 }} resizeMode="contain" />
        </View>

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
  const { colors, spacing, fontSize, fontFamily } = useTheme();
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
      <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </Text>
      <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm }}>
        {mode === "signin"
          ? "Sign in to your account to continue with Simply Case."
          : "Track your immigration case status, in one place."}
      </Text>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        secureToggle
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

      {mode === "signin" && (
        <Link href="/forgot-password" style={{ fontSize: fontSize.sm, color: colors.link, textAlign: "center", fontWeight: "600" }}>
          Forgot password?
        </Link>
      )}

      {mode === "signup" && (
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center" }}>
          By creating an account you agree to the{" "}
          <Text style={{ color: colors.link, textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
            Terms
          </Text>{" "}
          and{" "}
          <Text style={{ color: colors.link, textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            Privacy Policy
          </Text>
          .
        </Text>
      )}

      {message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, textAlign: "center" }}
        >
          {message.text}
        </Text>
      )}

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          marginTop: spacing.sm,
          paddingTop: spacing.lg,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          {mode === "signin" ? "Don’t have an account?" : "Already have an account?"}
        </Text>
        <Pressable
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          accessibilityRole="button"
          hitSlop={12}
          style={{ marginTop: spacing.xs }}
        >
          <Text style={{ fontSize: fontSize.base, color: colors.link, fontWeight: "700" }}>
            {mode === "signin" ? "Create account" : "Sign in"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
