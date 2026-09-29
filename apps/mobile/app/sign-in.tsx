import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Checkbox, GoogleIcon, Input } from "@/components/ui";
import { LegalSheet } from "@/components/LegalSheet";
import type { LegalDocId } from "@mycasepro/shared";

// The combined wordmark + icon lockup used on the splash screen (app.json
// -> expo-splash-screen). It's flat navy with no dark-mode variant, but
// app.json pins userInterfaceStyle to "light" app-wide, so useTheme() here
// always resolves to the light palette anyway — safe to use as-is.
const LOGO = require("../assets/splash-logo.png");

/**
 * Social sign-in buttons — LAYOUT PREVIEW ONLY, none of these are wired up.
 * Added at the user's request to see how the screen would look with them.
 *
 * Before any of this ships, three things are real blockers, not details:
 *  - Apple sign-in needs the paid Apple Developer account (not bought yet).
 *  - App Store review REQUIRES offering Sign in with Apple wherever
 *    Google/Facebook login is offered, so Apple can't be the one that
 *    slips.
 *  - Each provider needs to be enabled and configured in Supabase Auth.
 *
 * Google deliberately has no `icon`/`color` here: its mark is four-color,
 * so it can't be a font glyph and is drawn as SVG instead (GoogleIcon).
 * The absence of those fields is what selects that path below.
 */
const SOCIAL_PROVIDERS = [
  { id: "apple", label: "Apple", icon: "apple", color: "#000000" },
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook", icon: "facebook", color: "#1877F2" },
] as const;

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
  const { colors, spacing, fontSize, fontFamily, radii } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Explicit consent, replacing the old passive "by creating an account
  // you agree..." line. It gates submission below — a consent checkbox
  // that does not actually block anything would imply agreement was
  // collected when it was not.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Which legal document the sheet is showing, or null when closed. Shown
  // over the form rather than navigated to: someone half-way through
  // signing up shouldn't lose the screen (and their typed details) to read
  // what they're agreeing to.
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);
    const credentials = { email: email.trim().toLowerCase(), password };

    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({
            ...credentials,
            // Lands in auth.users.raw_user_meta_data, from where the
            // handle_new_user() trigger copies it into profiles.full_name
            // (migration 0018) so SQL-side code — notification emails —
            // can actually read it.
            options: { data: { full_name: name.trim() } },
          });

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

  const canSubmit =
    email.length > 0 &&
    password.length >= 6 &&
    (mode === "signin" || name.trim().length > 0) &&
    (mode === "signin" || agreedToTerms) &&
    !submitting;

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

      {mode === "signup" && (
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name"
        />
      )}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        secureToggle
        autoCapitalize="none"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        onSubmitEditing={canSubmit ? handleSubmit : undefined}
      />

      {mode === "signup" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Checkbox
            checked={agreedToTerms}
            onChange={setAgreedToTerms}
            accessibilityLabel="Agree with Terms and Privacy Policy"
          />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.textMuted }}>
            <Text onPress={() => setAgreedToTerms(!agreedToTerms)}>Agree with </Text>
            <Text
              style={{ color: colors.link, textDecorationLine: "underline" }}
              onPress={() => setLegalDoc("terms")}
            >
              Terms
            </Text>
            <Text onPress={() => setAgreedToTerms(!agreedToTerms)}> and </Text>
            <Text
              style={{ color: colors.link, textDecorationLine: "underline" }}
              onPress={() => setLegalDoc("privacy")}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      )}

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

      {message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, textAlign: "center" }}
        >
          {message.text}
        </Text>
      )}

      {/* Layout preview only — see SOCIAL_PROVIDERS above. Tapping one says
          it isn't available rather than doing nothing, because a button that
          silently does nothing reads as broken. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
          {mode === "signin" ? "Or sign in with" : "Or sign up with"}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.lg }}>
        {SOCIAL_PROVIDERS.map((provider) => (
          <Pressable
            key={provider.id}
            onPress={() =>
              setMessage({ text: `${provider.label} sign-in isn\u2019t available yet.`, isError: false })
            }
            accessibilityRole="button"
            accessibilityLabel={`${mode === "signin" ? "Sign in" : "Sign up"} with ${provider.label}`}
            hitSlop={8}
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {"icon" in provider ? (
              <FontAwesome name={provider.icon} size={24} color={provider.color} />
            ) : (
              <GoogleIcon size={24} />
            )}
          </Pressable>
        ))}
      </View>

      {/* One line, per the reference design: the question and the action sit
          together rather than stacking with a divider rule above them. */}
      <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs }}>
        {mode === "signin" ? "Don’t have an account? " : "Already have an account? "}
        <Text
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          accessibilityRole="button"
          style={{ color: colors.link, fontWeight: "700", textDecorationLine: "underline" }}
        >
          {mode === "signin" ? "Create account" : "Sign in"}
        </Text>
      </Text>

      <LegalSheet
        doc={legalDoc}
        onClose={() => setLegalDoc(null)}
        // Swap the sheet's content in place instead of navigating, so the
        // signup form underneath is never torn down.
        onNavigate={setLegalDoc}
      />
    </View>
  );
}
