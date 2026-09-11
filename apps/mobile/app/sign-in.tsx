import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/lib/supabase";

/**
 * makeRedirectUri() resolves to the right target for whichever environment
 * this is actually running in: an exp://host:port/--/... URL in Expo Go,
 * or the mycasepro:// custom scheme (app.json) in a dev client / standalone
 * build. Hardcoding "mycasepro://auth/confirm" would work in a standalone
 * build but silently fail in Expo Go, which is how most day-to-day testing
 * happens — this is the reason Supabase's own RN docs call out this helper
 * specifically rather than a plain scheme string.
 */
const redirectTo = makeRedirectUri({ path: "/auth/confirm" });

export default function SignInScreen() {
  const [tab, setTab] = useState<"password" | "magic">("password");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>mycase pro</Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("password")}
          style={[styles.tab, tab === "password" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "password" && styles.tabTextActive]}>Password</Text>
        </Pressable>
        <Pressable onPress={() => setTab("magic")} style={[styles.tab, tab === "magic" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "magic" && styles.tabTextActive]}>Email link</Text>
        </Pressable>
      </View>

      {tab === "password" ? <PasswordForm /> : <MagicLinkForm />}
    </View>
  );
}

/**
 * Added alongside magic link, not instead of it — magic link already works
 * end to end (deep link -> app/auth/confirm.tsx -> setSession). This exists
 * purely so testing on a device doesn't need an email round trip + tunnel
 * every time. signInWithPassword/signUp set the session directly; the
 * AuthProvider's onAuthStateChange listener (lib/auth-context.tsx) picks it
 * up and Stack.Protected in the root layout swaps screens on its own — no
 * manual navigation needed here, same as after the deep-link flow.
 */
function PasswordForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
    // Same email-confirmation policy as magic-link accounts applies here —
    // a brand-new signup with confirmations on returns no session yet.
    if (mode === "signup" && !data.session) {
      setMessage({ text: "Account created — check your email to confirm it.", isError: false });
    }
  }

  return (
    <>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min. 6 characters)"
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
      />
      <Pressable
        onPress={handleSubmit}
        disabled={submitting || email.length === 0 || password.length < 6}
        style={[
          styles.button,
          (submitting || email.length === 0 || password.length < 6) && styles.buttonDisabled,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
        )}
      </Pressable>

      {message && (
        <Text style={[styles.message, message.isError && styles.messageError]}>{message.text}</Text>
      )}

      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
        <Text style={styles.switchMode}>
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </Text>
      </Pressable>
    </>
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSend() {
    setSending(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    setSending(false);
    setMessage(
      error
        ? { text: error.message, isError: true }
        : { text: `Check ${email.trim()} for a sign-in link.`, isError: false },
    );
  }

  return (
    <>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Pressable
        onPress={handleSend}
        disabled={sending || email.length === 0}
        style={[styles.button, (sending || email.length === 0) && styles.buttonDisabled]}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send sign-in link</Text>}
      </Pressable>

      {message && (
        <Text style={[styles.message, message.isError && styles.messageError]}>{message.text}</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  tabs: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 6, padding: 3, marginBottom: 20 },
  tab: { flex: 1, borderRadius: 4, paddingVertical: 7, alignItems: "center" },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, color: "#888" },
  tabTextActive: { color: "#171717", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 12, fontSize: 14, marginBottom: 10 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 14, alignItems: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  message: { fontSize: 13, color: "#15803d", marginTop: 16 },
  messageError: { color: "#dc2626" },
  switchMode: { fontSize: 12, color: "#666", marginTop: 14, textAlign: "center" },
});
