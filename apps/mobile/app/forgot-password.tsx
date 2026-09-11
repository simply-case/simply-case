import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

/**
 * Resolves to exp://…/--/auth/confirm in Expo Go, or mycasepro://auth/confirm
 * in a dev-client/standalone build. Hardcoding the scheme would silently
 * break Expo Go, which is where most testing happens.
 */
const redirectTo = makeRedirectUri({ path: "/auth/confirm" });

export default function ForgotPasswordScreen() {
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
    <View style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>We&apos;ll email you a link to set a new one.</Text>

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
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send reset link</Text>
        )}
      </Pressable>

      {message && (
        <Text style={[styles.message, message.isError && styles.messageError]}>{message.text}</Text>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 12, fontSize: 14, marginBottom: 10 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  message: { fontSize: 13, color: "#15803d", marginTop: 16 },
  messageError: { color: "#dc2626" },
  back: { fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" },
});
