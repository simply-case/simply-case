import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>mycase pro</Text>
      <Text style={styles.subtitle}>Track your immigration case status.</Text>
      <PasswordForm />
    </View>
  );
}

/**
 * Email + password is now the only auth method (magic link removed at the
 * user's request). signInWithPassword/signUp set the session directly; the
 * AuthProvider's onAuthStateChange listener (lib/auth-context.tsx) picks it
 * up and Stack.Protected in the root layout swaps screens on its own — no
 * manual navigation needed here.
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
    // auth.email.enable_confirmations is currently OFF (see
    // supabase/config.toml), so signup returns a session immediately. This
    // branch becomes live again if confirmations are re-enabled.
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 12, fontSize: 14, marginBottom: 10 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 14, alignItems: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  message: { fontSize: 13, color: "#15803d", marginTop: 16 },
  messageError: { color: "#dc2626" },
  switchMode: { fontSize: 12, color: "#666", marginTop: 14, textAlign: "center" },
});
