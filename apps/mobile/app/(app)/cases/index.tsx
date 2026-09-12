import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { normalizeCaseKey, type Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Card, EmptyState, Input, ListRow, StatusPill } from "@/components/ui";
import { CaseListSkeleton } from "@/components/ui/Skeleton";
import { AppHeader } from "@/components/AppHeader";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];

export default function DashboardScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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
      setAddError("Expected 3 letters followed by 10 digits, e.g. IOE0912345678.");
      return;
    }

    setAddError(null);
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
      setAddError(error.message);
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
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <CaseListSkeleton />
      </View>
    );
  }

  const active = cases.filter((c) => c.archived_at === null);
  const archived = cases.filter((c) => c.archived_at !== null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <>
          <Card style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs }}>
              Add a case (USCIS)
            </Text>
            <Input
              value={receiptNumber}
              onChangeText={(t) => {
                setReceiptNumber(t);
                if (addError) setAddError(null);
              }}
              placeholder="Receipt number, e.g. IOE0912345678"
              autoCapitalize="characters"
              autoCorrect={false}
              error={addError ?? undefined}
            />
            {/* autoCapitalize="none": a nickname shouldn't be forced into
                Title Case as you type (RN's TextInput defaults to
                "sentences", capitalizing the first letter automatically).
                The user can still capitalize manually — this only removes
                the automatic behavior, not the ability. */}
            <Input
              value={nickname}
              onChangeText={setNickname}
              placeholder="Nickname (optional)"
              autoCapitalize="none"
            />
            <Button
              label="Add case"
              onPress={handleAddCase}
              loading={adding}
              disabled={receiptNumber.length === 0}
            />
          </Card>

          {active.length > 0 && (
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.sm }}>
              Your cases ({active.length})
            </Text>
          )}
        </>
      }
      data={active}
      keyExtractor={(c) => c.user_case_id ?? c.tracked_case_id ?? ""}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => <CaseCard c={item} onArchive={handleArchive} onRemove={handleRemove} />}
      ListEmptyComponent={
        <EmptyState
          title="No cases yet"
          message="Add a USCIS receipt number above to start tracking its status."
        />
      }
      ListFooterComponent={
        archived.length > 0 ? (
          <>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm }}>
              Archived ({archived.length})
            </Text>
            <View style={{ gap: spacing.sm }}>
              {archived.map((c) => (
                <CaseCard key={c.user_case_id} c={c} onArchive={handleArchive} onRemove={handleRemove} />
              ))}
            </View>
          </>
        ) : null
      }
      />
    </View>
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
  const { colors, spacing, fontSize } = useTheme();
  if (!c.user_case_id || !c.tracked_case_id) return null;
  const isArchived = c.archived_at !== null;

  return (
    <ListRow onPress={() => router.push(`/cases/${c.tracked_case_id}`)} style={isArchived ? { opacity: 0.65 } : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: "600", color: colors.text }}>
            {c.nickname || c.case_key}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, marginTop: 2, textTransform: "uppercase" }}>
            {c.provider} · {c.case_key}
            {c.form_type ? ` · ${c.form_type}` : ""}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <StatusPill statusText={c.status_text_en} />
          </View>
        </View>
        {/* Pressable + hitSlop rather than <Text onPress>: these labels are
            11px, well under a comfortable touch target, and they sit inside
            ListRow's own Pressable — the nested Pressable is what reliably
            claims the touch so tapping "Remove" doesn't also navigate. */}
        <View style={{ gap: spacing.md, alignItems: "flex-end" }}>
          <Pressable
            onPress={() => onArchive(c.user_case_id!, isArchived)}
            accessibilityRole="button"
            hitSlop={12}
          >
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              {isArchived ? "Unarchive" : "Archive"}
            </Text>
          </Pressable>
          <Pressable onPress={() => onRemove(c.user_case_id!)} accessibilityRole="button" hitSlop={12}>
            <Text style={{ fontSize: fontSize.xs, color: colors.danger }}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </ListRow>
  );
}
