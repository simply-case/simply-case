import { useEffect, useRef, useState } from "react";
import { Pressable, ActivityIndicator, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { type EoirDetails, getEoirDetails } from "@/lib/eoir-details";
import { eoirNationalityLabel, findEoirNationality } from "@/lib/eoir-nationalities";
import { Button, Card, Input } from "@/components/ui";

const EOIR_URL = "https://acis.eoir.justice.gov/en/";

/**
 * Same pattern as cases/ceac-refresh/[id].tsx, deliberately: the real ACIS
 * page stays visible and the USER taps its real Submit button — we never
 * attempt to trigger that ourselves (see the long comment over there for
 * why a script-triggered click on a captcha-gated government form doesn't
 * work). Everything else — filling in the A-Number and nationality, and
 * making it easy to record what the page says afterward — is automated.
 *
 * Two things this screen does NOT try to do yet, both deliberate for now
 * (2026-09-17), not oversights:
 *   - Solve ACIS's hCaptcha automatically. The user solves it themselves,
 *     same as they type a CEAC captcha themselves right now.
 *   - Read the result/error off the page automatically. CEAC's
 *     ERROR_CHECK_SCRIPT only exists because the user pasted the real
 *     #ctl00_ContentPlaceHolder1_lblError element from a live submission;
 *     nothing equivalent has been inspected for ACIS yet. So this screen
 *     asks the user to read the result themselves and type it in below —
 *     same safety-net principle as CEAC's manual status buttons (never
 *     auto-save a guessed result), just without the automatic detection
 *     on top since there's nothing confirmed to detect yet.
 */

/** What the autofill script fills in. The A-Number is always known (it's
 * the case_key); nationality is the optional per-device detail from
 * lib/eoir-details.ts, which may not be saved yet. */
interface AutofillFields {
  aNumber: string;
  /** ACIS's own option label, "NAME (CODE)" — see eoirNationalityLabel. */
  nationalityLabel?: string;
}

/**
 * Autofill, targeting ACIS's REAL structure (inspected 2026-09-17 from the
 * live page):
 *   - An "I Accept" disclaimer button gates the page on every visit. It's
 *     clicked automatically (user's explicit decision, 2026-09-17: people
 *     use this app precisely so they don't do these steps by hand). The
 *     substance of that disclaimer — EOIR's data is "for convenience
 *     only", court documents are the official record — is shown in OUR
 *     UI on this screen instead, so it isn't lost along with the tap.
 *   - The A-Number field is a "react-code-input" — NINE separate
 *     <input type="number"> boxes inside a `.react-code-input` container,
 *     one digit each, in DOM order. Not a single field, so the 9-digit
 *     (zero-padded) A-Number is split and each box filled individually
 *     using the same native-setter trick as CEAC's fields.
 *   - Nationality is a react-select control, NOT a plain <select>. Autofill
 *     opens it, types into its built-in search box, and clicks the option
 *     whose label matches EXACTLY. Exactness is the whole point: an earlier
 *     version took the first option merely CONTAINING the country name and
 *     picked BRITISH INDIAN OCEAN TERRITORY for INDIA. If no exact match
 *     is found it now picks NOTHING and says so — a silently wrong
 *     nationality returns "no information found", which is
 *     indistinguishable from "this case doesn't exist" and would send the
 *     user chasing a problem that isn't there.
 *
 * Unlike CEAC (server-rendered ASP.NET, complete at onLoadEnd), ACIS is a
 * React app, so elements may not exist yet when the page "finishes"
 * loading. Everything below therefore POLLS for what it needs instead of
 * looking exactly once — the single-shot approach copied from CEAC is
 * inherently racy here.
 *
 * Safety per HANDOFF.md §5: only ever WRITES into fields (never submits,
 * never touches the captcha), and only fills a box that's currently empty.
 */
function buildAutofillScript(fields: AutofillFields): string {
  const { aNumber, nationalityLabel } = fields;
  const paddedANumber = aNumber.padStart(9, "0");

  return `
(function () {
  function post(step, extra) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: "autofill_status", step: step }, extra || {})));
    } catch (e) {}
  }

  // Errors inside setTimeout callbacks escape any try/catch out here, so
  // every step wraps its own body — otherwise a failure mid-chain is
  // completely silent and looks identical to "nothing happened".
  function guard(name, fn) {
    return function () {
      try { return fn.apply(null, arguments); }
      catch (e) { post(name + "_error", { message: String(e) }); }
    };
  }

  /** Polls for what() to return truthy, up to ~10s, then calls done(). */
  function waitFor(what, done, missed) {
    var tries = 0;
    (function attempt() {
      var found;
      try { found = what(); } catch (e) { found = null; }
      if (found) return done(found);
      if (++tries > 40) return missed();
      setTimeout(attempt, 250);
    })();
  }

  var findAccept = guard("accept", function () {
    // Matched on exact button text: class="btn" is shared with other
    // buttons on this page (Submit included), so it is NOT safe to
    // target by class.
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if ((buttons[i].textContent || "").trim().toLowerCase() === "i accept") return buttons[i];
    }
    return null;
  });

  var fillANumber = guard("anumber", function () {
    var container = document.querySelector(".react-code-input");
    if (!container) return false;
    var inputs = container.querySelectorAll("input");
    if (!inputs.length) return false;
    var digits = ${JSON.stringify(paddedANumber)}.split("");
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    var any = false;
    for (var i = 0; i < inputs.length && i < digits.length; i++) {
      var el = inputs[i];
      if (el.value) continue;
      el.focus();
      setter.call(el, digits[i]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      any = true;
    }
    post(any ? "anumber_filled" : "anumber_already_filled");
    return true;
  });

  var openNationality = guard("nationality", function (placeholder) {
    ${
      nationalityLabel
        ? `
    var target = ${JSON.stringify(nationalityLabel)};

    // Already set from a previous run? Leave it alone.
    var current = document.querySelector('[class*="-singleValue"]');
    if (current && (current.textContent || "").trim() === target) return post("nationality_already_filled");

    var control = placeholder.closest('[class*="-control"]') || placeholder.parentElement;
    if (!control) return post("nationality_control_not_found");
    control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    control.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    control.click();

    waitFor(
      function () { return document.querySelector('input[id^="react-select"][id$="-input"]'); },
      guard("nationality_type", function (input) {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, target);
        input.dispatchEvent(new Event("input", { bubbles: true }));

        waitFor(
          function () {
            var options = document.querySelectorAll('[id^="react-select"][id*="-option-"]');
            return options.length ? options : null;
          },
          guard("nationality_pick", function (options) {
            var match = null;
            for (var i = 0; i < options.length; i++) {
              if ((options[i].textContent || "").trim() === target) { match = options[i]; break; }
            }
            if (!match) {
              // Deliberately does NOT fall back to a near match — see the
              // BRITISH INDIAN OCEAN TERRITORY note above.
              return post("nationality_no_exact_match", { count: options.length });
            }
            match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            match.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
            match.click();
            post("nationality_filled");
          }),
          function () { post("nationality_options_never_appeared"); }
        );
      }),
      function () { post("nationality_input_not_found"); }
    );
    `
        : `// No nationality saved for this case — never called, see below.`
    }
  });

  // All three run concurrently rather than in sequence. The disclaimer
  // may or may not appear (it's per-session), and the form fields may not
  // exist until it's dismissed — so each waits for its own element and
  // fires when that shows up. Chaining them instead would stall autofill
  // for the full timeout on every visit where the disclaimer was already
  // accepted.
  waitFor(
    findAccept,
    function (button) {
      button.click();
      post("accept_clicked");
    },
    function () { post("accept_not_found"); }
  );

  waitFor(fillANumber, function () {}, function () { post("anumber_not_found"); });

  ${
    nationalityLabel
      ? `waitFor(
    function () { return document.querySelector('[id^="react-select"][id$="-placeholder"]'); },
    openNationality,
    function () { post("nationality_control_not_found"); }
  );`
      : `post("nationality_not_saved");`
  }
})();
true;
`;
}

/**
 * ACIS's own page calls a real JSON API when the user taps Submit
 * (eoir-ws.eoir.justice.gov/api/Case/GetCaseInfo — found in their own JS
 * bundle, 2026-09-21). This is a genuinely better position than CEAC: no
 * button-click trust problem (see buildAutofillScript's header comment for
 * why that blocks CEAC), and the response is structured JSON instead of a
 * rendered page to scrape. Confirmed directly (curl, no token):
 * `{"message":"Invalid Captcha Provided."}` when the hCaptcha token is
 * missing/wrong — so the captcha is enforced server-side, not just in the
 * UI, and there is no way to call this endpoint successfully without a
 * real captcha solve. This script does NOT try to call the API itself; it
 * wraps `window.fetch` so that when ACIS's OWN page makes that exact call
 * (after the user solves the real captcha and taps their real Submit,
 * unchanged from today), we read the response THEY already received
 * instead of scraping whatever they render from it. The original fetch
 * always still runs and its result is returned untouched — nothing about
 * how the page behaves changes.
 *
 * The exact shape of a SUCCESSFUL response (hearing date fields, judge,
 * court, etc.) is not yet known — there is no way to get one without a
 * real captcha solve on a real device, which only the user can do. So
 * this posts back whatever comes through, success or error, verbatim and
 * unparsed beyond JSON.parse; the screen shows it as-is rather than
 * pretending to understand fields it hasn't seen yet.
 */
const FETCH_INTERCEPT_SCRIPT = `
(function () {
  try {
    if (window.__eoirFetchWrapped) return;
    window.__eoirFetchWrapped = true;
    var originalFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      var url = args[0] instanceof Request ? args[0].url : args[0];
      var isCaseInfo = typeof url === "string" && url.indexOf("/api/Case/GetCaseInfo") !== -1;
      return originalFetch.apply(this, args).then(function (response) {
        if (isCaseInfo) {
          response
            .clone()
            .json()
            .then(function (body) {
              try {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: "eoir_api_response", status: response.status, ok: response.ok, body: body }),
                );
              } catch (e) {}
            })
            .catch(function (e) {
              try {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: "eoir_api_response", status: response.status, ok: response.ok, parseError: String(e) }),
                );
              } catch (e2) {}
            });
        }
        return response;
      });
    };
  } catch (e) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "autofill_status", step: "fetch_wrap_error", message: String(e) })); } catch (e2) {}
  }
})();
true;
`;

interface CaseInfo {
  userCaseId: string;
  nickname: string | null;
  aNumber: string;
}

export default function EoirRefreshScreen() {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [info, setInfo] = useState<CaseInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [autofilled, setAutofilled] = useState(false);
  const [resultText, setResultText] = useState("");
  const [apiCaptured, setApiCaptured] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const [eoirDetails, setEoirDetails] = useState<EoirDetails | null>(null);
  const nationality = eoirDetails ? findEoirNationality(eoirDetails.nationalityCode) : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("my_case_details")
        .select("user_case_id, nickname, case_key, provider")
        .eq("tracked_case_id", id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.provider === "eoir" && data.user_case_id && data.case_key) {
        setInfo({ userCaseId: data.user_case_id, nickname: data.nickname, aNumber: data.case_key });
      }
      setLoadingInfo(false);

      if (id) {
        const saved = await getEoirDetails(id);
        if (!cancelled) setEoirDetails(saved);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function recordStatus() {
    if (!info || !resultText.trim()) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc("record_manual_status", {
      p_user_case_id: info.userCaseId,
      p_status_text: resultText.trim(),
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
          This isn&apos;t an immigration court case, or it couldn&apos;t be found.
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
          <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>A-Number</Text>
          <Text selectable style={{ fontSize: fontSize.lg, fontFamily: "System", color: colors.accent, letterSpacing: 1 }}>
            {info.aNumber}
          </Text>
          {nationality && (
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>{eoirNationalityLabel(nationality)}</Text>
          )}
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            {autofilled
              ? "We've filled this into the form below for you. Solve the security check and tap Submit on the page yourself — that last tap has to be a real one."
              : "We're loading the immigration court's page below — this may take a moment."}
          </Text>
          {message && (
            <Text style={{ fontSize: fontSize.sm, color: message.isError ? colors.danger : colors.accent, marginTop: spacing.xs }}>
              {message.text}
            </Text>
          )}
        </Card>

        {/* The app taps EOIR's "I Accept" disclaimer for the user
            (deliberate, see buildAutofillScript), so the thing that
            disclaimer actually SAYS is surfaced here instead — this is the
            one piece of it that matters, and HANDOFF.md §5 requires it be
            prominent: acting on a wrong hearing date can make someone miss
            court. */}
        <Card style={{ gap: spacing.xs, borderColor: colors.border }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            The immigration court provides this information for convenience only. The documents the court or the
            Board of Immigration Appeals sends you or your representative are the only official record of your
            case — always confirm a hearing date against those before relying on it.
          </Text>
        </Card>

        <View style={{ height: 420, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <WebView
            ref={webViewRef}
            source={{ uri: EOIR_URL }}
            // Same reasoning as ceac-refresh: ACIS may render its own
            // security-check UI via about:srcdoc, so about:* has to be
            // allowed or the WebView cancels that load outright.
            originWhitelist={["http://*", "https://*", "about:*"]}
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "autofill_status") {
                  if (typeof data.step === "string" && data.step.endsWith("_filled")) setAutofilled(true);
                  console.log("[eoir autofill]", data.step, data.message ?? "");
                } else if (data.type === "eoir_api_response") {
                  // The real GetCaseInfo response ACIS's own page received
                  // after the user's real captcha solve + Submit tap — see
                  // FETCH_INTERCEPT_SCRIPT. Field names for a SUCCESSFUL
                  // response aren't known yet (never seen a real one), so
                  // this is shown as pretty-printed JSON rather than
                  // pretending to parse fields we haven't confirmed. It's
                  // only ever a starting point in the editable box below —
                  // never saved automatically.
                  console.log("[eoir api]", data.status, JSON.stringify(data.body ?? data.parseError));
                  if (data.ok && data.body) {
                    setApiCaptured(true);
                    setResultText(JSON.stringify(data.body, null, 2));
                  } else if (data.body && typeof data.body.message === "string") {
                    // e.g. {"message":"Invalid Captcha Provided."} — same
                    // relay principle as CEAC's ERROR_CHECK_SCRIPT: show
                    // whatever the government site actually said, verbatim.
                    setMessage({ text: data.body.message, isError: true });
                  }
                }
              } catch {
                // Not our message shape — ignore.
              }
            }}
            onLoadEnd={() => {
              setMessage(null);
              webViewRef.current?.injectJavaScript(FETCH_INTERCEPT_SCRIPT);
              webViewRef.current?.injectJavaScript(
                buildAutofillScript({
                  aNumber: info.aNumber,
                  nationalityLabel: nationality ? eoirNationalityLabel(nationality) : undefined,
                }),
              );
            }}
          />
        </View>

        <Pressable onPress={() => WebBrowser.openBrowserAsync(EOIR_URL)} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", textDecorationLine: "underline" }}>
            Page stuck on a security check? Open it in your regular browser instead
          </Text>
        </Pressable>

        <Card style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
            What does the page say?
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            {apiCaptured
              ? "We caught the court's own answer below — check it over (it's raw data, not proofread) and edit it into something readable before saving."
              : "Type what you see — a hearing date and location, a decision, or that no information was found — and we'll save it to this case."}
          </Text>
          <Input
            value={resultText}
            onChangeText={setResultText}
            placeholder="e.g. Next hearing March 5, 2027 at Immigration Court"
            multiline
          />
          <Button label="Save this" onPress={recordStatus} loading={saving} disabled={!resultText.trim()} />
        </Card>
      </ScrollView>
    </View>
  );
}
