import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { parseCeacCaseKey } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";

const CEAC_URL = "https://ceac.state.gov/CEACStatTracker/Status.aspx";

// CEAC (like most state.gov pages) sits behind a bot-check interstitial
// ("Performing security check…") that only resolves for what it judges a
// real browser. react-native-webview's default user agent identifies
// itself as an embedded WebView (Android appends "; wv", both platforms
// omit a version string real Safari/Chrome send), which some checks flag
// outright — so the check never completes and the page spins forever.
// Sending a mainstream desktop-class Chrome UA instead is the standard,
// ToS-neutral fix (it changes only what the WebView announces itself as,
// not how the page is fetched — no third-party scraping/unblocking
// service involved, which the product deliberately avoids, see
// docs/PLAN.md and docs/HANDOFF.md §5). It isn't guaranteed against every
// future check, which is why the "open in your regular browser" escape
// hatch below exists as a fallback that always works.
const WEBVIEW_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

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
 * Injected into the CEAC page after every load PAST the first one (see
 * onLoadEnd below — the initial form page is deliberately skipped, since
 * it may itself list these status words as a legend/key, which would
 * misfire before the user has even submitted anything). Best-effort
 * automatic status extraction: scans the page's visible text for one of
 * the known status words and posts it back if found. Deliberately does
 * NOT try to click through the CAPTCHA or the form — the user does that
 * themselves. Wrapped so a missing/changed DOM never throws inside the
 * WebView.
 *
 * NOT verified against a live result page as of writing (no real CEAC
 * case was available) — treat this purely as a convenience that may
 * silently find nothing, or even fire on the wrong page, never as the
 * thing this screen depends on. The manual buttons above are what
 * actually works regardless.
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
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [info, setInfo] = useState<CaseInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [detectedStatus, setDetectedStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const webViewRef = useRef<WebView>(null);
  const loadCountRef = useRef(0);

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
        <Pressable
          onPress={() => router.push(`/cases/${id}`)}
          accessibilityRole="button"
          hitSlop={8}
          style={{ alignSelf: "flex-start" }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>
            ← View status & history
          </Text>
        </Pressable>

        {info.nickname && (
          <Text style={{ fontSize: fontSize.lg, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>{info.nickname}</Text>
        )}

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
            ref={webViewRef}
            source={{ uri: CEAC_URL }}
            userAgent={WEBVIEW_USER_AGENT}
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
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
            onLoadEnd={() => {
              // CEAC's form posts back to the same URL rather than
              // navigating to a new one, so onNavigationStateChange (which
              // watches for URL changes) would miss the result entirely —
              // onLoadEnd fires on every full page load, postback included.
              // loadCount starts at 0 for the initial form page; only
              // re-inject from the second load onward (see EXTRACTION_SCRIPT
              // comment above for why the first load is skipped).
              if (loadCountRef.current > 0) {
                webViewRef.current?.injectJavaScript(EXTRACTION_SCRIPT);
              }
              loadCountRef.current += 1;
            }}
          />
        </View>

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(CEAC_URL)}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", textDecorationLine: "underline" }}>
            Page stuck on a security check? Open it in your regular browser instead
          </Text>
        </Pressable>

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
