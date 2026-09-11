import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];
type EventRow = Database["public"]["Views"]["my_case_events"]["Row"];

export default function CaseDetailScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!caseDetail) {
    return (
      <View style={styles.center}>
        <Text>Case not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{caseDetail.nickname || caseDetail.case_key}</Text>
      <Text style={styles.meta}>
        {caseDetail.provider?.toUpperCase()} · {caseDetail.case_key}
        {caseDetail.form_type ? ` · ${caseDetail.form_type}` : ""}
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>{caseDetail.status_text_en ?? "Pending first check…"}</Text>
        {caseDetail.status_detail_en && (
          <Text style={styles.statusDetail}>{caseDetail.status_detail_en}</Text>
        )}
        {caseDetail.last_checked_at && (
          <Text style={styles.checkedAt}>
            Last checked {new Date(caseDetail.last_checked_at).toLocaleString()}
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>No history yet.</Text>
      ) : (
        events.map((e) => (
          <View key={e.event_id} style={styles.eventRow}>
            <Text style={styles.eventDate}>
              {e.observed_at && new Date(e.observed_at).toLocaleDateString()}
            </Text>
            <Text style={styles.eventText}>{e.status_text_en}</Text>
            {e.status_detail_en && <Text style={styles.eventDetail}>{e.status_detail_en}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: "700" },
  meta: { fontSize: 11, color: "#888", textTransform: "uppercase", marginTop: 4 },
  statusCard: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 14, marginTop: 16 },
  statusText: { fontSize: 15, fontWeight: "600" },
  statusDetail: { fontSize: 13, color: "#555", marginTop: 6 },
  checkedAt: { fontSize: 11, color: "#999", marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginTop: 24, marginBottom: 8 },
  empty: { fontSize: 14, color: "#888" },
  eventRow: { borderLeftWidth: 2, borderLeftColor: "#e5e5e5", paddingLeft: 12, marginBottom: 14 },
  eventDate: { fontSize: 11, color: "#999" },
  eventText: { fontSize: 14, color: "#222", marginTop: 2 },
  eventDetail: { fontSize: 13, color: "#777", marginTop: 2 },
});
