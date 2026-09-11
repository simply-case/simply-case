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
    <View style={styles.container}>
      <Text style={styles.title}>mycase pro</Text>
      <Text style={styles.subtitle}>Sign in with your email — no password needed.</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 12, fontSize: 14 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 14, alignItems: "center", marginTop: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  message: { fontSize: 13, color: "#15803d", marginTop: 16 },
  messageError: { color: "#dc2626" },
});
