import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

/**
 * Reached after auth/confirm.tsx turns a recovery deep link into a session,
 * so the user is already authenticated here — updateUser() can set a new
 * password without needing the old one.
 */
export default function ResetPasswordScreen() {
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
    router.replace("/");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.subtitle}>Choose a password you&apos;ll use to sign in from now on.</Text>

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="New password (min. 6 characters)"
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm new password"
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
      />

      {tooShort && <Text style={styles.hint}>Password must be at least 6 characters.</Text>}
      {mismatch && <Text style={styles.hint}>Passwords don&apos;t match.</Text>}

      <Pressable
        onPress={handleSave}
        disabled={!canSubmit}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save password</Text>}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 12, fontSize: 14, marginBottom: 10 },
  hint: { fontSize: 12, color: "#a16207", marginBottom: 8 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 14, alignItems: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { fontSize: 13, color: "#dc2626", marginTop: 16 },
});
