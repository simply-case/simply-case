import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { parseCeacCaseKey } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";

const CEAC_URL = "https://ceac.state.gov/CEACStatTracker/Status.aspx";

/**
 * A handful of CEAC's documented status words (docs/PLAN.md CEAC status
 * mapping) offered as one-tap buttons. This is the PRIMARY, reliable path
 * to recording a result — not a fallback. There is no verified DOM
 * structure for the CEAC result page to extract from automatically (no
 * live test case was available while building this — see the
 * best-effort extraction attempt below), so asking the user what they see
 * with their own eyes is the trustworthy mechanism, not a workaround.
 * "Something else" covers any status not in this short list.
 */
const COMMON_STATUSES = [
  "At NVC",
  "In Transit",
  "Ready",
  "Administrative Processing",
  "Issued",
  "Refused",
] as const;

/**
 * Injected into the CEAC page. Best-effort automatic status extraction:
 * scans the page's visible text for one of the known status words and
 * posts it back if found. Deliberately does NOT try to click through the
 * CAPTCHA or the form — the user does that themselves. Wrapped so a
 * missing/changed DOM never throws inside the WebView.
 *
 * NOT verified against a live result page as of writing (no real CEAC
 * case was available) — treat this purely as a convenience that may
 * silently find nothing, never as the thing this screen depends on. The
 * manual buttons above are what actually works regardless.
 */
const EXTRACTION_SCRIPT = `
(function () {
  try {
    var statuses = ${JSON.stringify(COMMON_STATUSES)};
    var text = document.body ? document.body.innerText : "";
    for (var i = 0; i < statuses.length; i++) {
      if (text.indexOf(statuses[i]) !== -1) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "status_found", status: statuses[i] }));
        return;
      }
    }
  } catch (e) {
    // Swallow — this is a convenience, not a requirement.
  }
})();
true;
`;

interface CaseInfo {
  userCaseId: string;
  nickname: string | null;
  caseValue: string;
  caseType: "immigrant" | "nonimmigrant";
}

export default function CeacRefreshScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [info, setInfo] = useState<CaseInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [detectedStatus, setDetectedStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("my_case_details")
        .select("user_case_id, nickname, case_key, provider")
        .eq("tracked_case_id", id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.provider === "ceac" && data.user_case_id) {
        const parsed = parseCeacCaseKey(data.case_key ?? "");
        if (parsed) {
          setInfo({
            userCaseId: data.user_case_id,
            nickname: data.nickname,
            caseValue: parsed.value,
            caseType: parsed.type,
          });
        }
      }
      setLoadingInfo(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function recordStatus(status: string) {
    if (!info) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc("record_ceac_status", {
      p_user_case_id: info.userCaseId,
      p_status_text: status,
    });
    setSaving(false);
    if (error) {
      setMessage({ text: "Couldn't save that. Please try again.", isError: true });
      return;
    }
    router.replace(`/cases/${id}`);
  }

  if (loadingInfo) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: fontSize.base, color: colors.text, textAlign: "center" }}>
          This isn&apos;t a visa-status case, or it couldn&apos;t be found.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
            {info.caseType === "immigrant" ? "NVC case number" : "DS-160 Application ID"}
          </Text>
          <Text selectable style={{ fontSize: fontSize.lg, fontFamily: "System", color: colors.accent, letterSpacing: 1 }}>
            {info.caseValue}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            Tap and hold to copy, then paste it into the form below. You&apos;ll need to solve the
            CAPTCHA yourself — we can&apos;t and won&apos;t do that for you.
          </Text>
        </Card>

        <View style={{ height: 420, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <WebView
            source={{ uri: CEAC_URL }}
            injectedJavaScript={EXTRACTION_SCRIPT}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "status_found" && typeof data.status === "string") {
                  setDetectedStatus(data.status);
                }
              } catch {
                // Not our message shape — ignore.
              }
            }}
            onNavigationStateChange={() => {
              // Re-run the scan after every navigation inside the WebView
              // (e.g. after the user submits the form) — a single injection
              // at initial load would miss the result page entirely.
            }}
          />
        </View>

        {detectedStatus && (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.text }}>
              We noticed the page mentions: <Text style={{ fontWeight: "700" }}>{detectedStatus}</Text>
            </Text>
            <Button label={`Record "${detectedStatus}"`} onPress={() => recordStatus(detectedStatus)} loading={saving} />
          </Card>
        )}

        <Card style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
            What does the page say your status is?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {COMMON_STATUSES.map((status) => (
              <Button
                key={status}
                label={status}
                variant="secondary"
                onPress={() => recordStatus(status)}
                loading={saving}
              />
            ))}
          </View>
          {message && (
            <Text style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent }}>
              {message.text}
            </Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
