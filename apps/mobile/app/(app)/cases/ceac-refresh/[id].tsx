import { useEffect, useRef, useState } from "react";
import { Pressable, ActivityIndicator, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { parseCeacCaseKey } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { type CeacDetails, getCeacDetails } from "@/lib/ceac-details";
import { Button, Card } from "@/components/ui";

const CEAC_URL = "https://ceac.state.gov/CEACStatTracker/Status.aspx";

// NO userAgent override on the WebView below, deliberately. An earlier
// attempt at getting past CEAC's "Performing security check…" wall set a
// desktop Windows Chrome UA — which made things worse, not better: iOS
// WKWebView IS Safari's engine, so claiming to be Windows Chrome while
// every other signal (platform, touch support, screen metrics, WebKit
// quirks) says iPhone is exactly the contradiction bot detection looks
// for. Reporting honestly as mobile Safari is the best chance of passing.

/**
 * The CEAC page is shown here, visible, and the USER taps its real Submit
 * button with a real finger — deliberately NOT automated (see history
 * below for why). Everything below just makes that easier: fields get
 * filled in automatically, and whatever CEAC says back — an error or a
 * real status — is read and surfaced as a clean message, so the user
 * doesn't have to parse the raw page themselves.
 *
 * History, 2026-09-16: three different ways of triggering Submit from
 * script were tried — clicking the visible Submit image, calling
 * `__doPostBack` with a guessed event-target name, then calling the EXACT
 * real function (`WebForm_DoPostBackWithOptions`, confirmed correct via a
 * live diagnostic pulled from the page's own DOM) — and all three failed
 * completely silently: no reload, no error, nothing. A real physical tap
 * on this same button, in earlier testing, worked every time. That
 * pattern — every scripted trigger fails identically, a real tap
 * succeeds — points at CEAC/Cloudflare's bot-management layer silently
 * discarding script-triggered submissions specifically, which no amount
 * of finding the "real" function call was going to get past. So: stop
 * trying to submit programmatically. Let the real tap do what only it
 * can, and spend the effort making everything AROUND that tap easier.
 */

/** A handful of CEAC's documented status words (docs/PLAN.md CEAC status
 * mapping) offered as one-tap buttons. This is the PRIMARY, reliable path
 * to recording a result — not a fallback. Asking the user what they see
 * with their own eyes is the trustworthy mechanism; EXTRACTION_SCRIPT
 * below is a convenience on top, not a replacement.
 * "Something else" covers any status not in this short list. */
const COMMON_STATUSES = [
  "At NVC",
  "In Transit",
  "Ready",
  "Administrative Processing",
  "Issued",
  "Refused",
] as const;

/** What the autofill script fills in — the case number and visa type
 * (always known) plus the optional per-device details from
 * lib/ceac-details.ts, which may not be saved yet. */
interface AutofillFields {
  caseType: "immigrant" | "nonimmigrant";
  caseValue: string;
  passportNumber?: string;
  surname?: string;
  /** Consulate CODE (e.g. "MTL"), not display text — see lib/ceac-details.ts. */
  location?: string | null;
}

/**
 * Autofill, targeting CEAC's REAL field ids (inspected 2026-09-16 from the
 * live page — see docs/HANDOFF.md for the full element list):
 *   #Visa_Application_Type  <select> value "IV" | "NIV"
 *   #Visa_Case_Number       <input>  case number OR DS-160 application id
 *   #Passport_Number        <input>
 *   #Surname                <input>  max 5 chars
 *   #Location_Dropdown      <select> value = consulate code, NIV only
 *
 * Visa_Application_Type has an onchange handler that calls
 * `__doPostBack` — changing it ALWAYS triggers a full page reload (this is
 * knowable from the id's own onchange attribute, not a guess), so this
 * function changes the type and returns without trying to fill anything
 * else that same tick. The reload's onLoadEnd re-injects this whole
 * script, and by then the type is already correct, so it proceeds
 * straight to filling.
 *
 * Safety per the safety-net rules in HANDOFF.md §5: only ever WRITES into
 * fields (never submits, never touches the CAPTCHA), and only fills an
 * input that is currently empty — never overwrites something the user
 * already typed themselves.
 */
function buildAutofillScript(fields: AutofillFields): string {
  const { caseType, caseValue, passportNumber, surname, location } = fields;
  const wantType = caseType === "immigrant" ? "IV" : "NIV";

  return `
(function () {
  try {
    function post(step, extra) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: "autofill_status", step: step }, extra || {})));
      } catch (e) {}
    }

    function setValue(id, value) {
      var el = document.getElementById(id);
      if (!el) return "not_found";
      if (el.value) return "already_filled";
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "filled";
    }

    function fillAll() {
      post("number_" + setValue("Visa_Case_Number", ${JSON.stringify(caseValue)}));
      ${passportNumber ? `post("passport_" + setValue("Passport_Number", ${JSON.stringify(passportNumber)}));` : ""}
      ${surname ? `post("surname_" + setValue("Surname", ${JSON.stringify(surname)}));` : ""}
      ${
        location
          ? `
      var loc = document.getElementById("Location_Dropdown");
      if (!loc) {
        post("location_not_found");
      } else if (loc.value === ${JSON.stringify(location)}) {
        post("location_already_filled");
      } else {
        loc.value = ${JSON.stringify(location)};
        loc.dispatchEvent(new Event("change", { bubbles: true }));
        post("location_filled");
      }`
          : ""
      }
    }

    var typeSelect = document.getElementById("Visa_Application_Type");
    if (!typeSelect) { post("type_select_not_found"); return; }

    if (typeSelect.value === ${JSON.stringify(wantType)}) {
      fillAll();
    } else {
      // This select's onchange calls __doPostBack — a full page reload is
      // coming. onLoadEnd will re-run this whole script on the new page,
      // where typeSelect.value already matches and fillAll() runs then.
      typeSelect.value = ${JSON.stringify(wantType)};
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      post("type_changed");
    }
  } catch (e) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "autofill_status", step: "error", message: String(e) })); } catch (e2) {}
  }
})();
true;
`;
}

/**
 * Injected into the CEAC page after every load PAST the first one (the
 * initial form page is skipped since it may itself list these status
 * words as a legend/key, which would misfire before the user has even
 * submitted anything). Best-effort automatic status extraction: scans the
 * page's visible text for one of the known status words and posts it back
 * if found. Wrapped so a missing/changed DOM never throws inside the
 * WebView.
 *
 * NOT verified against a live result page as of writing — treat this
 * purely as a convenience that may silently find nothing, or even fire on
 * the wrong page, never as the thing this screen depends on. The manual
 * buttons are what actually works regardless (safety-net rule: never save
 * a guessed status without the user confirming it, see HANDOFF.md §5).
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

/**
 * CEAC uses ONE stable element for every error it shows on this page
 * (confirmed 2026-09-16 from real submissions) —
 * #ctl00_ContentPlaceHolder1_lblError — distinguished only by its text:
 * "The code entered does not match the code displayed on the page." for a
 * wrong CAPTCHA, "Your search did not return any data." for a right
 * CAPTCHA but no matching case. Relaying whatever text is actually in it
 * (rather than hardcoding either message) means a THIRD wording neither
 * of us has seen yet still gets shown to the user instead of silently
 * doing nothing.
 */
const ERROR_CHECK_SCRIPT = `
(function () {
  try {
    var errorEl = document.getElementById("ctl00_ContentPlaceHolder1_lblError");
    var errorText = errorEl ? errorEl.textContent.trim() : "";
    if (errorText) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ceac_error", message: errorText }));
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
  const [autofilled, setAutofilled] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const loadCountRef = useRef(0);

  // docs/HANDOFF.md §5/§6: passport/surname/location, stored only on this
  // device (lib/ceac-details.ts). Collected on the Add-a-case screen
  // (cases/add.tsx) when the case is first created, not here — this
  // screen only reads what was saved there. null means "not saved" (the
  // user left it blank when adding the case), in which case autofill just
  // skips those fields and the plain CEAC form works exactly as before.
  const [ceacDetails, setCeacDetails] = useState<CeacDetails | null>(null);

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

      if (id) {
        const saved = await getCeacDetails(id);
        if (!cancelled) setCeacDetails(saved);
      }
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
    // record_manual_status: renamed + widened from record_ceac_status
    // (migration 0015) to also accept eoir cases — see
    // cases/eoir-refresh/[id].tsx, which calls the same RPC.
    const { error } = await supabase.rpc("record_manual_status", {
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
            {autofilled
              ? "We've filled this into the form below for you. Read the code shown and type it in, then tap Submit on the page yourself — that last tap has to be a real one."
              : "We're loading the State Department's page below — this may take a moment."}
          </Text>
          {message && (
            <Text style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, marginTop: spacing.xs }}>
              {message.text}
            </Text>
          )}
        </Card>

        <View style={{ height: 420, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <WebView
            ref={webViewRef}
            source={{ uri: CEAC_URL }}
            // Cloudflare's bot check ("Performing security verification")
            // renders in an iframe whose URL is about:srcdoc. The library's
            // default originWhitelist is ['http://*','https://*'] plus an
            // implicit 'about:blank' (see WebViewShared's compileWhitelist),
            // so about:srcdoc fails the whitelist: the load is cancelled and
            // handed to Linking instead, which logs "Can't open url:
            // about:srcdoc" and leaves the challenge stuck on "Verifying…"
            // forever. Allowing about:* lets the challenge actually run.
            originWhitelist={["http://*", "https://*", "about:*"]}
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "status_found" && typeof data.status === "string") {
                  setDetectedStatus(data.status);
                } else if (data.type === "autofill_status") {
                  // Any "*_filled" step (number_filled, passport_filled,
                  // surname_filled, location_filled) is worth telling the
                  // user about — every other outcome (already_filled,
                  // *_not_found, type_changed, errors) means either
                  // nothing needed doing or nothing could be done, and the
                  // page below still works regardless. Logged either way
                  // for debugging against the real page.
                  if (typeof data.step === "string" && data.step.endsWith("_filled")) setAutofilled(true);
                  console.log("[ceac autofill]", data.step, data.message ?? "");
                } else if (data.type === "ceac_error" && typeof data.message === "string") {
                  // CEAC's own error text, relayed verbatim — see
                  // ERROR_CHECK_SCRIPT for why this reads a specific
                  // element rather than guessing wording. Covers both
                  // known messages ("wrong CAPTCHA" and "no matching
                  // case") and any future one CEAC shows through this
                  // same element.
                  setMessage({ text: data.message, isError: true });
                  console.log("[ceac error]", data.message);
                }
              } catch {
                // Not our message shape — ignore.
              }
            }}
            onLoadEnd={() => {
              // Reset per-load results BEFORE injecting anything: a
              // reload can be triggered mid-flow (e.g. changing
              // Visa_Application_Type, or the user tapping the real
              // Submit button), and leaving the previous load's status or
              // error message on screen while a new page loads underneath
              // would be stale and confusing.
              setMessage(null);
              setDetectedStatus(null);

              // CEAC's form posts back to the same URL rather than
              // navigating to a new one, so onNavigationStateChange
              // (which watches for URL changes) would miss the result
              // entirely — onLoadEnd fires on every full page load,
              // postback included.
              webViewRef.current?.injectJavaScript(
                buildAutofillScript({
                  caseType: info.caseType,
                  caseValue: info.caseValue,
                  passportNumber: ceacDetails?.passportNumber,
                  surname: ceacDetails?.surname,
                  location: ceacDetails?.location,
                }),
              );
              webViewRef.current?.injectJavaScript(ERROR_CHECK_SCRIPT);
              // loadCount starts at 0 for the initial form page; only
              // re-inject from the second load onward (see
              // EXTRACTION_SCRIPT comment for why the first load is
              // skipped).
              if (loadCountRef.current > 0) {
                webViewRef.current?.injectJavaScript(EXTRACTION_SCRIPT);
              }
              loadCountRef.current += 1;
            }}
          />
        </View>

        <Pressable onPress={() => WebBrowser.openBrowserAsync(CEAC_URL)} accessibilityRole="button" hitSlop={8}>
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
        </Card>
      </ScrollView>
    </View>
  );
}
