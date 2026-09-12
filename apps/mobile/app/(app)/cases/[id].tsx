import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Card, EmptyState, Skeleton, StatusPill } from "@/components/ui";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];
type EventRow = Database["public"]["Views"]["my_case_events"]["Row"];

export default function CaseDetailScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Both reads go through the my_case_* views, scoped to this user's own
      // subscriptions — a tracked_case_id the user hasn't added returns no
      // rows here, not someone else's data (supabase/migrations/0002_rls.sql).
      const [{ data: detail }, { data: eventRows }] = await Promise.all([
        supabase.from("my_case_details").select("*").eq("tracked_case_id", id).maybeSingle(),
        supabase
          .from("my_case_events")
          .select("*")
          .eq("tracked_case_id", id)
          .order("observed_at", { ascending: false }),
      ]);
      if (!cancelled) {
        setCaseDetail(detail);
        setEvents(eventRows ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md }}>
        <Skeleton style={{ height: 22, width: "60%" }} />
        <Skeleton style={{ height: 12, width: "40%" }} />
        <Skeleton style={{ height: 90, borderRadius: 14, marginTop: spacing.md }} />
        <Skeleton style={{ height: 60, borderRadius: 8, marginTop: spacing.lg }} />
        <Skeleton style={{ height: 60, borderRadius: 8 }} />
      </View>
    );
  }

  if (!caseDetail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState title="Case not found" message="It may have been removed, or the link is out of date." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
      <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.text }}>
        {caseDetail.nickname || caseDetail.case_key}
      </Text>
      <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.xs, textTransform: "uppercase" }}>
        {caseDetail.provider} · {caseDetail.case_key}
        {caseDetail.form_type ? ` · ${caseDetail.form_type}` : ""}
      </Text>

      <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <StatusPill statusText={caseDetail.status_text_en} />
        <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginTop: spacing.xs }}>
          {caseDetail.status_text_en ?? "Pending first check…"}
        </Text>
        {caseDetail.status_detail_en && (
          <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>{caseDetail.status_detail_en}</Text>
        )}
        {caseDetail.last_checked_at && (
          <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.xs }}>
            Last checked {new Date(caseDetail.last_checked_at).toLocaleString()}
          </Text>
        )}
      </Card>

      <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm }}>
        History
      </Text>
      {events.length === 0 ? (
        <EmptyState title="No history yet" message="This case hasn't been checked yet, or nothing has changed." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {events.map((e) => (
            <View
              key={e.event_id}
              style={{ borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.md }}
            >
              <Text style={{ fontSize: fontSize.xs, color: colors.textFaint }}>
                {e.observed_at && new Date(e.observed_at).toLocaleDateString()}
              </Text>
              <Text style={{ fontSize: fontSize.base, color: colors.text, marginTop: 2 }}>{e.status_text_en}</Text>
              {e.status_detail_en && (
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 }}>{e.status_detail_en}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
