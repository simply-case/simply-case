import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  classifyStatus,
  displayCaseKey,
  parseCeacCaseKey,
  statusClasses,
  statusLabels,
  type Database,
  type StatusClass,
} from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { BottomSheet, EmptyState, Input, ListRow, SheetOption, StatusPill } from "@/components/ui";
import { CaseListSkeleton } from "@/components/ui/Skeleton";
import { AppHeader } from "@/components/AppHeader";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];

const APP_ICON = require("../../../assets/app-icon.png");

/** What a case "is" for filtering purposes — collapses CEAC's two case
 * shapes (see parseCeacCaseKey) into the two labels the user actually
 * chose between when adding it (see cases/add.tsx's CASE_TYPES). */
type CaseTypeFilter = "uscis" | "nvc" | "ds160" | "eoir";

function caseTypeOf(c: CaseRow): CaseTypeFilter | null {
  if (c.provider === "uscis") return "uscis";
  if (c.provider === "eoir") return "eoir";
  if (c.provider === "ceac") {
    const parsed = parseCeacCaseKey(c.case_key ?? "");
    if (parsed?.type === "immigrant") return "nvc";
    if (parsed?.type === "nonimmigrant") return "ds160";
  }
  return null;
}

const CASE_TYPE_LABELS: Record<CaseTypeFilter, string> = {
  uscis: "USCIS",
  nvc: "NVC case",
  ds160: "Visa application (DS-160)",
  eoir: "Immigration court",
};

type SortOption = "recent" | "added" | "az" | "status";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Most recently updated",
  added: "Newest added",
  az: "A-Z by name",
  status: "Status",
};

// Priority order when sorting by status — action-needed cases are the ones
// worth surfacing first, unknown/approved/denied are the least urgent to
// see at a glance. Mirrors the reasoning in packages/shared/src/status.ts
// (never bias toward alarm, but action-needed genuinely IS the most
// actionable state to put at the top).
const STATUS_SORT_ORDER: StatusClass[] = ["actionNeeded", "pending", "inProgress", "unknown", "approved", "denied"];

function sortCases(rows: CaseRow[], sortBy: SortOption): CaseRow[] {
  const sorted = [...rows];
  switch (sortBy) {
    case "added":
      sorted.sort((a, b) => (b.subscribed_at ?? "").localeCompare(a.subscribed_at ?? ""));
      break;
    case "az":
      sorted.sort((a, b) => (a.nickname || a.case_key || "").localeCompare(b.nickname || b.case_key || ""));
      break;
    case "status":
      sorted.sort(
        (a, b) =>
          STATUS_SORT_ORDER.indexOf(classifyStatus(a.status_text_en)) -
          STATUS_SORT_ORDER.indexOf(classifyStatus(b.status_text_en)),
      );
      break;
    case "recent":
    default:
      // Falls back to subscribed_at for a case that's never been checked
      // (last_changed_at is null) rather than sorting it as oldest.
      sorted.sort((a, b) => (b.last_changed_at ?? b.subscribed_at ?? "").localeCompare(a.last_changed_at ?? a.subscribed_at ?? ""));
      break;
  }
  return sorted;
}

export default function DashboardScreen() {
  const { colors, spacing, fontSize, radii } = useTheme();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Two separate flags on purpose: `refreshing` drives the pull-to-refresh
  // spinner (which pushes the list down), `buttonRefreshing` only swaps the
  // header button's icon for a small spinner — tapping the button must not
  // make the page jump.
  const [refreshing, setRefreshing] = useState(false);
  const [buttonRefreshing, setButtonRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [typeFilter, setTypeFilter] = useState<Set<CaseTypeFilter>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<StatusClass>>(new Set());
  const [sheet, setSheet] = useState<"menu" | "sort" | "filter" | null>(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const activeFilterCount = typeFilter.size + statusFilter.size;

  function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }

  function matchesFilters(c: CaseRow): boolean {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${c.nickname ?? ""} ${displayCaseKey(c.case_key ?? "")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    const type = caseTypeOf(c);
    if (typeFilter.size > 0 && (!type || !typeFilter.has(type))) return false;
    if (statusFilter.size > 0 && !statusFilter.has(classifyStatus(c.status_text_en))) return false;
    return true;
  }

  const loadCases = useCallback(async () => {
    // Reads through my_case_details, never tracked_cases directly — same
    // RLS-scoped view the web app uses (supabase/migrations/0002_rls.sql).
    const { data, error } = await supabase
      .from("my_case_details")
      .select("*")
      .order("subscribed_at", { ascending: false });
    if (!error) setCases(data ?? []);
  }, []);

  // Reloads every time this screen regains focus — not just on mount —
  // so a case added via the add-case modal (a separate route, see
  // cases/add.tsx) shows up the moment you're back here, with no callback
  // needing to cross the modal boundary.
  useFocusEffect(
    useCallback(() => {
      loadCases().finally(() => setLoading(false));
    }, [loadCases]),
  );

  async function handleButtonRefresh() {
    setButtonRefreshing(true);
    await loadCases();
    setButtonRefreshing(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadCases();
    setRefreshing(false);
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

  // Cases is currently the only tab with a header icon: a hamburger that
  // opens the HeaderMenu dropdown below (Notification settings, Help; more
  // items get added there). See components/AppHeader.tsx.
  const menuAction = {
    icon: "menu-outline" as const,
    onPress: () => setSheet("menu"),
    accessibilityLabel: "Menu",
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader leftAction={menuAction} />
        <CaseListSkeleton />
      </View>
    );
  }

  // Plain computation, not useMemo — cases lists are small (dozens at
  // most), and this runs after the loading early-return above, where a
  // hook can't safely live (conditional hook count across renders).
  const active = sortCases(
    cases.filter((c) => c.archived_at === null).filter(matchesFilters),
    sortBy,
  );
  const archived = cases.filter((c) => c.archived_at !== null).filter(matchesFilters);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader leftAction={menuAction} />
      <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
              {active.length > 0 ? `My Cases (${active.length})` : "My Cases"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pressable
                onPress={handleButtonRefresh}
                disabled={buttonRefreshing || refreshing}
                accessibilityRole="button"
                accessibilityLabel="Refresh cases"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {buttonRefreshing ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push("/cases/add")}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.full,
                  backgroundColor: colors.accent,
                }}
              >
                <Ionicons name="add" size={16} color={colors.accentText} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: colors.accentText }}>Add case</Text>
              </Pressable>
            </View>
          </View>

          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search your cases"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <FilterPillButton
              label={sortBy === "recent" ? "Sort" : SORT_LABELS[sortBy]}
              icon="swap-vertical-outline"
              active={sortBy !== "recent"}
              onPress={() => setSheet("sort")}
            />
            <FilterPillButton
              label={activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
              icon="filter-outline"
              active={activeFilterCount > 0}
              onPress={() => setSheet("filter")}
            />
          </View>
        </View>
      }
      data={active}
      keyExtractor={(c) => c.user_case_id ?? c.tracked_case_id ?? ""}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => <CaseCard c={item} onArchive={handleArchive} onRemove={handleRemove} />}
      ListEmptyComponent={
        cases.filter((c) => c.archived_at === null).length === 0 ? (
          <EmptyState
            icon={APP_ICON}
            title="Track your first case"
            message="Add a USCIS receipt or NVC case number to start tracking its status."
            actionLabel="+ Add case number"
            onAction={() => router.push("/cases/add")}
          />
        ) : (
          <EmptyState title="No cases match" message="Try a different search, or clear your filters." />
        )
      }
      ListFooterComponent={
        archived.length > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <Pressable
              onPress={() => setArchivedExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: archivedExpanded }}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm }}
            >
              <Ionicons name={archivedExpanded ? "chevron-down" : "chevron-forward"} size={16} color={colors.textMuted} />
              <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
                Archived ({archived.length})
              </Text>
            </Pressable>
            {archivedExpanded && (
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                {archived.map((c) => (
                  <CaseCard key={c.user_case_id} c={c} onArchive={handleArchive} onRemove={handleRemove} />
                ))}
              </View>
            )}
          </View>
        ) : null
      }
      />

      <HeaderMenu
        visible={sheet === "menu"}
        onClose={() => setSheet(null)}
        items={[
          { icon: "notifications-outline", label: "Notification settings", href: "/notifications" },
          { icon: "help-circle-outline", label: "Help & feedback", href: "/help" },
        ]}
      />

      <BottomSheet visible={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
          <SheetOption key={opt} label={SORT_LABELS[opt]} selected={sortBy === opt} onPress={() => { setSortBy(opt); setSheet(null); }} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === "filter"} onClose={() => setSheet(null)} title="Filter">
        <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase", marginTop: spacing.xs }}>
          Case type
        </Text>
        {(Object.keys(CASE_TYPE_LABELS) as CaseTypeFilter[]).map((t) => (
          <SheetOption
            key={t}
            label={CASE_TYPE_LABELS[t]}
            selected={typeFilter.has(t)}
            multi
            onPress={() => setTypeFilter((prev) => toggleInSet(prev, t))}
          />
        ))}

        <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase", marginTop: spacing.sm }}>
          Status
        </Text>
        {statusClasses.map((s) => (
          <SheetOption
            key={s}
            label={statusLabels[s]}
            selected={statusFilter.has(s)}
            multi
            onPress={() => setStatusFilter((prev) => toggleInSet(prev, s))}
          />
        ))}

        {activeFilterCount > 0 && (
          <Pressable
            onPress={() => {
              setTypeFilter(new Set());
              setStatusFilter(new Set());
            }}
            accessibilityRole="button"
            style={{ marginTop: spacing.sm, alignItems: "center" }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>Clear filters</Text>
          </Pressable>
        )}
      </BottomSheet>
    </View>
  );
}

/**
 * Dropdown anchored under the hamburger in the top-left corner, rather than
 * a bottom sheet: it should visibly come from the button that opened it.
 * The offset mirrors AppHeader's own layout (safe-area inset + its
 * vertical padding + icon height), so it lands just below the header.
 */
function HeaderMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; href: "/notifications" | "/help" }>;
}) {
  const { colors, spacing, radii, fontSize, cardShadow } = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + spacing.sm + 26 + spacing.sm + spacing.xs;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} onPress={onClose} accessibilityLabel="Close menu">
        <View
          style={{
            position: "absolute",
            top,
            left: spacing.lg,
            minWidth: 230,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            ...cardShadow,
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          {items.map((item, i) => (
            <Pressable
              key={item.href}
              onPress={() => {
                onClose();
                router.push(item.href);
              }}
              accessibilityRole="menuitem"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              })}
            >
              <Ionicons name={item.icon} size={20} color={colors.accent} />
              <Text style={{ fontSize: fontSize.base, color: colors.text }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function FilterPillButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radii, fontSize } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.surfaceMuted : "transparent",
      }}
    >
      <Ionicons name={icon} size={15} color={active ? colors.accent : colors.textMuted} />
      <Text style={{ fontSize: fontSize.sm, color: active ? colors.accent : colors.textMuted, fontWeight: active ? "700" : "500" }}>
        {label}
      </Text>
    </Pressable>
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
    <ListRow
      onPress={() =>
        // CEAC and EOIR cases go straight into their refresh screen (which
        // auto-loads the real government page) instead of the generic
        // detail screen with a "Refresh" button first — one less tap to
        // get to the thing the user actually opened the case for.
        // History/status are still one link away from there (see
        // ceac-refresh/[id].tsx and eoir-refresh/[id].tsx), so nothing is
        // lost.
        c.provider === "ceac"
          ? router.push(`/cases/ceac-refresh/${c.tracked_case_id}`)
          : c.provider === "eoir"
            ? router.push(`/cases/eoir-refresh/${c.tracked_case_id}`)
            : router.push(`/cases/${c.tracked_case_id}`)
      }
      style={isArchived ? { opacity: 0.65 } : undefined}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: "600", color: colors.text }}>
            {c.nickname || c.case_key}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, marginTop: 2, textTransform: "uppercase" }}>
            {c.provider} · {displayCaseKey(c.case_key ?? "")}
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
