import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { normalizeCaseKey, type Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);

  const loadCases = useCallback(async () => {
    // Reads through my_case_details, never tracked_cases directly — same
    // RLS-scoped view the web app uses (supabase/migrations/0002_rls.sql).
    const { data, error } = await supabase
      .from("my_case_details")
      .select("*")
      .order("subscribed_at", { ascending: false });
    if (!error) setCases(data ?? []);
  }, []);

  useEffect(() => {
    loadCases().finally(() => setLoading(false));
  }, [loadCases]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadCases();
    setRefreshing(false);
  }

  async function handleAddCase() {
    let normalized: string;
    try {
      normalized = normalizeCaseKey("uscis", receiptNumber);
    } catch {
      Alert.alert("Invalid receipt number", "Expected 3 letters followed by 10 digits, e.g. IOE0912345678.");
      return;
    }

    setAdding(true);
    // Same add_case() RPC the web app calls (supabase/migrations/0007) —
    // tracked_cases has no insert policy for authenticated users by design,
    // so a direct insert isn't an option; this is the only path in.
    const { error } = await supabase.rpc("add_case", {
      p_provider: "uscis",
      p_case_key: normalized,
      p_nickname: nickname.trim() || undefined,
    });
    setAdding(false);

    if (error) {
      Alert.alert("Couldn't add case", error.message);
      return;
    }
    setReceiptNumber("");
    setNickname("");
    await loadCases();
  }

  async function handleArchive(userCaseId: string, currentlyArchived: boolean) {
    await supabase
      .from("user_cases")
      .update({ archived_at: currentlyArchived ? null : new Date().toISOString() })
      .eq("id", userCaseId);
    await loadCases();
  }

  async function handleRemove(userCaseId: string) {
    Alert.alert("Remove case?", "Its history will still exist, but you'll stop tracking it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("user_cases").delete().eq("id", userCaseId);
          await loadCases();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const active = cases.filter((c) => c.archived_at === null);
  const archived = cases.filter((c) => c.archived_at !== null);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={styles.email}>{session?.user.email}</Text>
            <Pressable onPress={signOut}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Add a case (USCIS)</Text>
            <TextInput
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              placeholder="Receipt number, e.g. IOE0912345678"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Nickname (optional)"
              style={styles.input}
            />
            <Pressable
              onPress={handleAddCase}
              disabled={adding || receiptNumber.length === 0}
              style={[styles.button, (adding || receiptNumber.length === 0) && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{adding ? "Adding…" : "Add case"}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Your cases {active.length > 0 && `(${active.length})`}</Text>
        </>
      }
      data={active}
      keyExtractor={(c) => c.user_case_id ?? c.tracked_case_id ?? ""}
      renderItem={({ item }) => (
        <CaseCard c={item} onArchive={handleArchive} onRemove={handleRemove} />
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No cases yet — add one above to start tracking it.</Text>
      }
      ListFooterComponent={
        archived.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Archived ({archived.length})</Text>
            {archived.map((c) => (
              <CaseCard
                key={c.user_case_id}
                c={c}
                onArchive={handleArchive}
                onRemove={handleRemove}
              />
            ))}
          </>
        ) : null
      }
    />
  );
}

function CaseCard({
  c,
  onArchive,
  onRemove,
}: {
  c: CaseRow;
  onArchive: (id: string, archived: boolean) => void;
  onRemove: (id: string) => void;
}) {
  if (!c.user_case_id || !c.tracked_case_id) return null;
  const isArchived = c.archived_at !== null;

  return (
    <Pressable
      onPress={() => router.push(`/cases/${c.tracked_case_id}`)}
      style={styles.card}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{c.nickname || c.case_key}</Text>
        <Text style={styles.cardMeta}>
          {c.provider?.toUpperCase()} · {c.case_key}
          {c.form_type ? ` · ${c.form_type}` : ""}
        </Text>
        <Text style={styles.cardStatus}>
          {c.status_text_en ?? (c.last_checked_at ? "No status yet" : "Pending first check…")}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={() => onArchive(c.user_case_id!, isArchived)} hitSlop={8}>
          <Text style={styles.cardAction}>{isArchived ? "Unarchive" : "Archive"}</Text>
        </Pressable>
        <Pressable onPress={() => onRemove(c.user_case_id!)} hitSlop={8}>
          <Text style={[styles.cardAction, styles.cardActionDanger]}>Remove</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  email: { fontSize: 13, color: "#666" },
  signOut: { fontSize: 13, color: "#666" },
  form: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 12, marginBottom: 20, gap: 8 },
  formTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 6, padding: 10, fontSize: 14 },
  button: { backgroundColor: "#171717", borderRadius: 6, padding: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 8 },
  empty: { fontSize: 14, color: "#888" },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { fontSize: 11, color: "#888", textTransform: "uppercase", marginTop: 2 },
  cardStatus: { fontSize: 13, color: "#333", marginTop: 6 },
  cardActions: { justifyContent: "center", gap: 8 },
  cardAction: { fontSize: 12, color: "#666" },
  cardActionDanger: { color: "#dc2626" },
});
