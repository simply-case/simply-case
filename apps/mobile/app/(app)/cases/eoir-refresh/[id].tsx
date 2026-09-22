import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ActivityIndicator, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { type EoirDetails, getEoirDetails } from "@/lib/eoir-details";
import { eoirNationalityLabel, findEoirNationality } from "@/lib/eoir-nationalities";
import { Button, Card } from "@/components/ui";

const EOIR_URL = "https://acis.eoir.justice.gov/en/";

/**
 * UNLIKE cases/ceac-refresh/[id].tsx, this screen does NOT show the real
 * government page by default. Confirmed 2026-09-21, on device, with a real
 * A-Number: hCaptcha sometimes clears itself with no visible challenge for
 * ordinary mobile traffic (a real, known hCaptcha behavior for low-risk
 * sessions — not something this app does), which means the ENTIRE flow —
 * autofill, captcha, Submit, reading the result — can run with the ACIS
 * page never actually shown to the user. So by default the WebView is
 * mounted but positioned off-screen (see the `webViewBoxStyle` logic
 * below), and the screen just shows "Refreshing information…" while it
 * works.
 *
 * This is NOT guaranteed to always work — hCaptcha can still decide a
 * session needs a real interactive challenge, and CEAC already taught us
 * that Cloudflare (which ACIS also sits behind) can silently discard a
 * script-triggered Submit click even when everything else about the click
 * looks identical to a real one. So there is a fallback: if no result
 * arrives within HELP_TIMEOUT_MS, the WebView is brought back on-screen
 * and the user is asked to finish it themselves — same as CEAC always
 * does. Once a result comes through (auto or after the user's own tap),
 * it goes back off-screen for next time.
 */
const HELP_TIMEOUT_MS = 25000;

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

  /** Polls for what() to return truthy, then calls done(). maxTries × 250ms
   * is the timeout — defaults to ~10s, but the submit-button wait below
   * passes a much longer one: it's waiting on the USER to solve the real
   * captcha, which can take well over 10 seconds. */
  function waitFor(what, done, missed, maxTries) {
    var tries = 0;
    var limit = maxTries || 40;
    (function attempt() {
      var found;
      try { found = what(); } catch (e) { found = null; }
      if (found) return done(found);
      if (++tries > limit) return missed();
      setTimeout(attempt, 250);
    })();
  }

  // Hides fields once they're filled in, so the visible page is just the
  // captcha and Submit — the user already gave us the A-Number and
  // nationality on the add-case screen, no reason to show them again.
  // Uses display:none on the actual containers (not a blanket selector),
  // so this can never accidentally hide the captcha or Submit button.
  var hideFilledFields = guard("hide_fields", function () {
    var codeContainer = document.querySelector(".react-code-input");
    if (codeContainer) codeContainer.style.setProperty("display", "none", "important");
    var singleValue = document.querySelector('[class*="-singleValue"]');
    var placeholder = document.querySelector('[id^="react-select"][id$="-placeholder"]');
    var control = (singleValue && singleValue.closest('[class*="-control"]')) || (placeholder && placeholder.closest('[class*="-control"]'));
    if (control) control.style.setProperty("display", "none", "important");
  });

  // Waits (up to ~5 minutes — however long the user takes on the real
  // captcha) for ACIS's own Submit button to stop being disabled, which
  // only happens once the A-Number, nationality, AND a real captcha solve
  // are all valid — then clicks it. UNVERIFIED whether this actually
  // works: ACIS also sits behind Cloudflare (seen in the GetCaseInfo
  // response headers), and Cloudflare's bot-management silently discarded
  // every script-triggered click CEAC ever tried (see buildAutofillScript
  // for ceac-refresh). This is a different button — a plain React state
  // toggle firing a fetch(), not an ASP.NET WebForms postback — so it
  // might not be protected the same way, but that's a guess, not a known
  // fact. If "submit_auto_clicked" logs but no eoir_api_response message
  // ever follows, that's the same silent-discard pattern as CEAC, and the
  // real Submit button (still visible) is the fallback either way.
  var watchForSubmit = guard("submit", function () {
    waitFor(
      function () {
        var btn = document.getElementById("btn_submit");
        return btn && !btn.disabled ? btn : null;
      },
      function (btn) {
        btn.click();
        post("submit_auto_clicked");
      },
      function () { post("submit_never_enabled"); },
      1200,
    );
  });

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

  /**
   * The WebView is off-screen, but a focused text field still summons the
   * real OS keyboard over the app — confirmed on device twice
   * (2026-09-22). A plain blur() after filling was NOT enough: the
   * react-code-input control advances focus to the NEXT box ITSELF each
   * time a digit lands, asynchronously, after our blur — so the keyboard
   * kept coming back. inputmode="none" is the actual fix (it tells the
   * browser not to raise a virtual keyboard for the field at all, while
   * still allowing focus and programmatic value setting); the blur and
   * the sweep below are backup for the moments between React re-renders
   * resetting the attribute.
   *
   * Scoped deliberately to .react-code-input — blurring react-select's
   * search box instead would close its dropdown mid-selection and break
   * the nationality fill, so that control gets inputmode="none" only
   * (see openNationality).
   */
  var keyboardSweepStarted = false;
  function startKeyboardSweep() {
    if (keyboardSweepStarted) return;
    keyboardSweepStarted = true;
    var ticks = 0;
    var timer = setInterval(function () {
      try {
        var active = document.activeElement;
        if (active && active.closest && active.closest(".react-code-input")) {
          active.setAttribute("inputmode", "none");
          active.blur();
        }
      } catch (e) {}
      if (++ticks > 40) clearInterval(timer);
    }, 150);
  }

  var fillANumber = guard("anumber", function () {
    var container = document.querySelector(".react-code-input");
    if (!container) return false;
    var inputs = container.querySelectorAll("input");
    if (!inputs.length) return false;
    var digits = ${JSON.stringify(paddedANumber)}.split("");
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    var any = false;
    startKeyboardSweep();
    for (var i = 0; i < inputs.length && i < digits.length; i++) {
      var el = inputs[i];
      // Set BEFORE focus — after would be too late, the keyboard is
      // already on its way up.
      el.setAttribute("inputmode", "none");
      if (el.value) continue;
      el.focus();
      setter.call(el, digits[i]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
      any = true;
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    post(any ? "anumber_filled" : "anumber_already_filled");
    hideFilledFields();
    return true;
  });

  var openNationality = guard("nationality", function (placeholder) {
    ${
      nationalityLabel
        ? `
    var target = ${JSON.stringify(nationalityLabel)};

    // Already set from a previous run? Leave it alone.
    var current = document.querySelector('[class*="-singleValue"]');
    if (current && (current.textContent || "").trim() === target) {
      post("nationality_already_filled");
      hideFilledFields();
      return;
    }

    var control = placeholder.closest('[class*="-control"]') || placeholder.parentElement;
    if (!control) return post("nationality_control_not_found");
    control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    control.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    control.click();

    waitFor(
      function () { return document.querySelector('input[id^="react-select"][id$="-input"]'); },
      guard("nationality_type", function (input) {
        // Keyboard suppression only — NOT a blur (see startKeyboardSweep):
        // react-select closes its menu on blur, which would kill the
        // selection we're in the middle of making.
        input.setAttribute("inputmode", "none");
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
            // Same keyboard-flicker fix as fillANumber — the search input
            // react-select opened stays focused after picking an option.
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            post("nationality_filled");
            setTimeout(hideFilledFields, 100);
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

  watchForSubmit();
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

/**
 * ACIS's GetCaseInfo response shape, reverse-engineered from ONE real
 * successful response (2026-09-21, the user's own case) — every field is
 * optional/nullable because a single sample can't confirm what's always
 * present. Field meanings not confirmed by EOIR documentation are shown
 * as their raw codes rather than translated (e.g. CaseType "RMV",
 * ClockStatus "R") — guessing at a code's meaning risks stating something
 * false as fact, the same principle as CEAC's status relay.
 */
interface EoirCaseInfoResponse {
  Data?: {
    ValidAlienNumber?: boolean;
    AlienName?: string | null;
    CaseID?: number | null;
    OSC_Date?: string | null;
    ElapsedDays?: string | null;
    LatestHearingDate?: string | null;
    LatestHearingTime?: string | null;
    DocketDate?: string | null;
    CaseDecisionString?: string | null;
    MTRDecisionString?: string | null;
    ReopenDecisionString?: string | null;
    AppealDecisionString?: string | null;
    AppealFiled?: boolean;
    ReopenExists?: boolean;
    PendingAtBIA?: boolean;
  } | null;
  Proceeding?: {
    CaseType?: string | null;
    HearingLocationAddress?: string | null;
  } | null;
  Schedule?: {
    AdjDate?: string | null;
    AdjTime?: string | null;
    IJ_Name?: string | null;
    IJ_WebExURLLink?: string | null;
    HearingLocationAddress?: string | null;
    /** "M" seen in the one real sample — "Master Calendar" is standard,
     * well-documented EOIR terminology (vs. "I" for Individual/Merits),
     * so CAL_TYPE_LABELS translates it. An unrecognized code falls back
     * to showing the raw value rather than a made-up label. */
    CalType?: string | null;
    /** "P" seen in the one real sample. Unlike CalType, EOIR doesn't
     * publicly document these letters as clearly — HEARING_MEDIUM_LABELS
     * is a reasonable guess (P/V/W/T for person/video/webex/telephonic,
     * the mediums EOIR is known to use), not a confirmed mapping. An
     * unrecognized code shows the raw value. */
    HearingMedium?: string | null;
  } | null;
}

/** "Master Calendar" vs "Individual (Merits) Calendar" is standard,
 * well-established immigration court terminology — confident enough to
 * translate outright. */
const CAL_TYPE_LABELS: Record<string, string> = {
  M: "Master Calendar",
  I: "Individual (Merits) Calendar",
};

/** Best-effort guess, NOT confirmed by EOIR documentation — see the
 * HearingMedium comment on EoirCaseInfoResponse above. */
const HEARING_MEDIUM_LABELS: Record<string, string> = {
  P: "in person",
  V: "by video",
  W: "by WebEx",
  T: "by telephone",
};

/**
 * "Your next Master Calendar hearing is in person on January 12, 2027 at
 * 8:30 AM." — the single most important sentence on this screen. Returns
 * null (never a half-built sentence) if there's no hearing date to anchor
 * it to.
 */
function formatEoirHeadline(res: EoirCaseInfoResponse): string | null {
  const when = formatEoirDate(
    res.Schedule?.AdjDate ?? res.Data?.LatestHearingDate,
    res.Schedule?.AdjTime ?? res.Data?.LatestHearingTime,
  );
  if (!when) return null;
  const calCode = res.Schedule?.CalType;
  const kind = calCode ? `${CAL_TYPE_LABELS[calCode] ?? calCode} hearing` : "hearing";
  // An unrecognized medium code is left OUT of the sentence rather than
  // spliced in raw — "your next hearing is (Z) on January 12" reads like a
  // bug. The code isn't lost: formatEoirResult surfaces it as its own row
  // so the information is still there, just not pretending to be English.
  const mediumLabel = res.Schedule?.HearingMedium ? HEARING_MEDIUM_LABELS[res.Schedule.HearingMedium] : undefined;
  const mediumPart = mediumLabel ? ` ${mediumLabel}` : "";
  return `Your next ${kind} is${mediumPart} on ${when}.`;
}

interface EoirResultRow {
  label: string;
  value: string;
}

function formatEoirDate(dateIso?: string | null, time?: string | null): string | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return time ? `${dateIso} ${time}` : dateIso;
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return time ? `${dateStr} at ${time}` : dateStr;
}

/**
 * ACIS's HearingLocationAddress is pipe-delimited, and courts with 3
 * segments repeat the city — e.g. "SEATTLE, WASHINGTON|915 2ND AVENUE,
 * SUITE 613|SEATTLE, WA 98174": segment 1 is a spelled-out city/state
 * name, segment 3 is the actual mailing line (street city/state/zip
 * already covers it). Confirmed on device, 2026-09-22 — showed as
 * "SEATTLE, WASHINGTON, 915 2ND AVENUE, SUITE 613, SEATTLE, WA 98174"
 * before this fix. Drops segment 1 only when its city matches segment 3's
 * — courts with a genuinely different first line (not just a repeated
 * city name) keep all their segments.
 */
function formatEoirAddress(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const firstCity = parts[0].split(",")[0]?.trim().toLowerCase();
    const lastCity = parts[parts.length - 1].split(",")[0]?.trim().toLowerCase();
    if (firstCity && firstCity === lastCity) parts.shift();
  }
  return parts.join(", ");
}

/**
 * Turns the raw API response into what gets SAVED (statusText, a short
 * canonical phrase — see EOIR_STATUS_CLASS in packages/shared/src/status.ts
 * for what each one classifies to; statusDetail, the long human sentence)
 * plus a list of "everything else" rows: decisions, appeal/reopen flags,
 * the hearing link. Name, A-Number, docket date, the headline hearing
 * sentence, judge and court address are NOT in `rows` — the screen renders
 * those directly as dedicated fields in a fixed order per the user's
 * request, not as a generic label/value list.
 *
 * statusText is deliberately SHORT and from a small controlled vocabulary
 * — an earlier version tried to save the whole multi-line summary as the
 * status and pattern-match it for classification, which is exactly the
 * fragile "guess at a paragraph" approach the rest of this app avoids
 * (see status.ts's own header comment on why CEAC uses exact short
 * strings). Two fields, like USCIS's status_text_en/status_detail_en
 * split, not one long one.
 *
 * Deliberately does NOT include the applicant's name in what's SAVED —
 * it's the user's own case, they know their own name, and there's no
 * reason to put a piece of PII into stored status text with no benefit
 * (it's still shown live on this screen, just not persisted this way).
 */
function formatEoirResult(
  res: EoirCaseInfoResponse,
): { statusText: string; statusDetail: string; rows: EoirResultRow[] } {
  const rows: EoirResultRow[] = [];
  const lines: string[] = [];

  if (res.Data?.ValidAlienNumber === false) {
    return {
      statusText: "No information found",
      statusDetail: "The court's system didn't recognize this A-Number and nationality combination.",
      rows: [],
    };
  }

  const headline = formatEoirHeadline(res);
  if (headline) lines.push(headline);

  const location = formatEoirAddress(res.Schedule?.HearingLocationAddress ?? res.Proceeding?.HearingLocationAddress);
  if (location) lines.push(`Location: ${location}`);
  if (res.Schedule?.IJ_Name) lines.push(`Judge: ${res.Schedule.IJ_Name}`);

  // "P" is confidently "in person" (see HEARING_MEDIUM_LABELS) — no point
  // showing a WebEx link for a hearing that isn't virtual. Still shown
  // when the medium is unrecognized/missing, since hiding it would risk
  // losing a genuinely virtual hearing's link on an uncertain guess.
  if (res.Schedule?.IJ_WebExURLLink && res.Schedule?.HearingMedium !== "P") {
    rows.push({ label: "Hearing link", value: res.Schedule.IJ_WebExURLLink });
  }

  // Only when we couldn't translate it (see formatEoirHeadline) — a
  // recognized medium is already stated in the headline sentence, so
  // repeating it here would be noise.
  const mediumCode = res.Schedule?.HearingMedium;
  if (mediumCode && !HEARING_MEDIUM_LABELS[mediumCode]) {
    rows.push({ label: "Hearing medium", value: mediumCode });
  }

  const decisions: Array<[string, string | null | undefined]> = [
    ["Case decision", res.Data?.CaseDecisionString],
    ["Motion decision", res.Data?.MTRDecisionString],
    ["Reopened case decision", res.Data?.ReopenDecisionString],
    ["Appeal decision", res.Data?.AppealDecisionString],
  ];
  let hasDecision = false;
  for (const [label, value] of decisions) {
    if (value) {
      rows.push({ label, value });
      lines.push(`${label}: ${value}`);
      hasDecision = true;
    }
  }

  if (res.Data?.AppealFiled) lines.push("An appeal has been filed.");
  if (res.Data?.PendingAtBIA) lines.push("Pending at the Board of Immigration Appeals.");
  if (res.Data?.ReopenExists) lines.push("A motion to reopen exists on this case.");

  const hasAppealOrMotion = Boolean(res.Data?.AppealFiled || res.Data?.PendingAtBIA || res.Data?.ReopenExists);

  // Priority order, most specific/certain first — mirrors classifyStatus's
  // own "most specific pattern wins" philosophy (status.ts).
  let statusText: string;
  if (hasDecision) {
    statusText = "Decision issued";
  } else if (hasAppealOrMotion) {
    statusText = "Appeal or motion pending";
  } else if (headline) {
    statusText = "Hearing scheduled";
  } else {
    statusText = "No information found";
    lines.push("The court returned a response, but we couldn't find a hearing date or decision in it — check the details below.");
  }

  return { statusText, statusDetail: lines.join("\n"), rows };
}

interface CaseInfo {
  userCaseId: string;
  nickname: string | null;
  aNumber: string;
}

type ScreenStatus = "loading" | "ready" | "help" | "error";

export default function EoirRefreshScreen() {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [info, setInfo] = useState<CaseInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [eoirDetails, setEoirDetails] = useState<EoirDetails | null>(null);
  const nationality = eoirDetails ? findEoirNationality(eoirDetails.nationalityCode) : null;

  const [status, setStatus] = useState<ScreenStatus>("loading");
  const [loadingLabel, setLoadingLabel] = useState("Refreshing information…");
  const [liveResult, setLiveResult] = useState<EoirCaseInfoResponse | null>(null);
  const [resultRows, setResultRows] = useState<EoirResultRow[]>([]);
  /** formatEoirResult's human summary. Only SHOWN when there's no
   * structured hearing to show (a not-found A-Number, or a response we
   * couldn't pull a hearing/decision out of) — otherwise the dedicated
   * fields below say the same thing better. Without this, a "no
   * information found" result rendered as a Case-information card
   * containing nothing but the A-Number, with no hint the lookup had
   * come back empty. */
  const [resultDetail, setResultDetail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const webViewRef = useRef<WebView>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Starts (or restarts) the fallback clock: if nothing comes back within
  // HELP_TIMEOUT_MS, bring the real page on-screen so the user can finish
  // whatever step is stuck (usually an interactive captcha challenge) —
  // see the header comment for why this is a fallback and not the norm.
  function armHelpTimer() {
    if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
    helpTimerRef.current = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "help" : s));
    }, HELP_TIMEOUT_MS);
  }

  function clearHelpTimer() {
    if (helpTimerRef.current) {
      clearTimeout(helpTimerRef.current);
      helpTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!info) return;
    armHelpTimer();
    return clearHelpTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, webViewKey]);

  async function saveResult(statusText: string, statusDetail: string) {
    if (!info) return;
    const { error } = await supabase.rpc("record_manual_status", {
      p_user_case_id: info.userCaseId,
      p_status_text: statusText,
      p_status_detail: statusDetail,
    });
    // Best-effort, silent: this is a background sync, not something the
    // user is waiting on — the live result is already on screen either
    // way, and a failure here quietly retries on the next refresh. Logged
    // for debugging, not surfaced in the UI (user's call, 2026-09-22).
    if (error) console.log("[eoir save]", error.message);
  }

  function startRefresh(label: string) {
    setLoadingLabel(label);
    setStatus("loading");
    setLiveResult(null);
    setResultRows([]);
    setResultDetail("");
    setErrorMessage(null);
    // Remounts the WebView with a fresh window (see FETCH_INTERCEPT_SCRIPT's
    // window.__eoirFetchWrapped guard) rather than calling .reload(), which
    // isn't guaranteed to reset that guard the same way across platforms.
    setWebViewKey((k) => k + 1);
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

  // The WebView is ALWAYS mounted (needed so it can run in the background
  // from the very first load) — only its position changes. Off-screen: a
  // fixed, non-zero size so it keeps rendering/executing JS normally, just
  // moved out of the visible area. On-screen (status === "help"): normal
  // inline layout, bordered, so the user can see and tap it.
  const webViewBoxStyle =
    status === "help"
      ? { height: 420, borderRadius: 12, overflow: "hidden" as const, borderWidth: 1, borderColor: colors.border }
      : { position: "absolute" as const, left: -3000, top: 0, width: 380, height: 420 };

  const headline = liveResult ? formatEoirHeadline(liveResult) : null;
  const location = liveResult
    ? formatEoirAddress(liveResult.Schedule?.HearingLocationAddress ?? liveResult.Proceeding?.HearingLocationAddress)
    : null;
  const docketDate = liveResult ? formatEoirDate(liveResult.Data?.DocketDate ?? liveResult.Data?.OSC_Date) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => router.push(`/cases/${id}`)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>
              ← View status & history
            </Text>
          </Pressable>
          {status === "ready" || status === "error" ? (
            <Pressable
              onPress={() => startRefresh("Getting your information…")}
              accessibilityRole="button"
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>↻ Refresh</Text>
            </Pressable>
          ) : null}
        </View>

        {info.nickname && (
          <Text style={{ fontSize: fontSize.lg, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>{info.nickname}</Text>
        )}

        {(status === "loading" || status === "help") && (
          <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ fontSize: fontSize.base, color: colors.text, textAlign: "center" }}>
              {status === "help" ? "We need a bit of help finishing this check below." : loadingLabel}
            </Text>
            {status === "help" && (
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg }}>
                Everything's filled in already — just complete the security check and tap Submit on the page below.
              </Text>
            )}
          </View>
        )}

        {status === "error" && errorMessage && (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.danger }}>{errorMessage}</Text>
            <Button label="Try again" variant="secondary" onPress={() => startRefresh("Getting your information…")} />
          </Card>
        )}

        {status === "ready" && liveResult && (
          <>
            <Card style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: fontSize.lg, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>
                Case information
              </Text>
              {liveResult.Data?.AlienName && (
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Name</Text>
                  <Text style={{ fontSize: fontSize.base, color: colors.text }}>{liveResult.Data.AlienName}</Text>
                </View>
              )}
              <View>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>A-Number</Text>
                <Text selectable style={{ fontSize: fontSize.base, fontFamily: "System", color: colors.text, letterSpacing: 1 }}>
                  {info.aNumber}
                </Text>
              </View>
              {docketDate && (
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Docket date</Text>
                  <Text style={{ fontSize: fontSize.base, color: colors.text }}>{docketDate}</Text>
                </View>
              )}

              {/* Nothing structured came back (not-found A-Number, or a
                  response with no hearing/decision in it) — say so plainly
                  instead of rendering a card that looks empty. */}
              {!headline && resultDetail !== "" && (
                <Text style={{ fontSize: fontSize.base, color: colors.text, marginTop: spacing.sm }}>{resultDetail}</Text>
              )}

              {headline && (
                <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.accent, marginTop: spacing.sm }}>
                  {headline}
                </Text>
              )}
              {liveResult.Schedule?.IJ_Name && (
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Judge</Text>
                  <Text style={{ fontSize: fontSize.base, color: colors.text }}>{liveResult.Schedule.IJ_Name}</Text>
                </View>
              )}
              {location && (
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Court address</Text>
                  <Text style={{ fontSize: fontSize.base, color: colors.text }}>{location}</Text>
                </View>
              )}
            </Card>

            {resultRows.length > 0 && (
              <Card style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>Additional details</Text>
                {resultRows.map((row) => (
                  <View key={row.label} style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, width: 110 }}>{row.label}</Text>
                    {row.label === "Hearing link" ? (
                      <Pressable onPress={() => Linking.openURL(row.value)} style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.sm, color: colors.link, textDecorationLine: "underline" }}>
                          Join hearing link
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={{ fontSize: fontSize.sm, color: colors.text, flex: 1 }}>{row.value}</Text>
                    )}
                  </View>
                ))}
              </Card>
            )}

            {/* The app taps EOIR's "I Accept" disclaimer automatically (see
                buildAutofillScript), so the substance of it is shown here
                instead — HANDOFF.md §5 requires it be prominent: acting on
                a wrong hearing date can make someone miss court. */}
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              This information is for convenience only. Documents the court or the Board of Immigration Appeals
              sends you or your representative are the only official record — always confirm a hearing date against
              those before relying on it.
            </Text>
          </>
        )}

        {status === "help" && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(EOIR_URL)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", textDecorationLine: "underline" }}>
              Page stuck on a security check? Open it in your regular browser instead
            </Text>
          </Pressable>
        )}

        <View style={webViewBoxStyle}>
          <WebView
            key={webViewKey}
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
                  console.log("[eoir autofill]", data.step, data.message ?? "");
                } else if (data.type === "eoir_api_response") {
                  // The real GetCaseInfo response ACIS's own page received —
                  // see FETCH_INTERCEPT_SCRIPT. formatEoirResult() only
                  // knows fields confirmed from real samples; every field
                  // is optional so an unfamiliar shape just shows fewer
                  // rows rather than crashing this screen.
                  console.log("[eoir api]", data.status, JSON.stringify(data.body ?? data.parseError));
                  clearHelpTimer();
                  if (data.ok && data.body) {
                    const { statusText, statusDetail, rows } = formatEoirResult(data.body);
                    setLiveResult(data.body);
                    setResultRows(rows);
                    setResultDetail(statusDetail);
                    setStatus("ready");
                    saveResult(statusText, statusDetail);
                  } else if (data.body && typeof data.body.message === "string") {
                    // e.g. {"message":"Invalid Captcha Provided."} — same
                    // relay principle as CEAC's ERROR_CHECK_SCRIPT: show
                    // whatever the government site actually said, verbatim.
                    setErrorMessage(data.body.message);
                    setStatus("error");
                  } else {
                    setErrorMessage("Something went wrong reading the court's response. Please try again.");
                    setStatus("error");
                  }
                }
              } catch {
                // Not our message shape — ignore.
              }
            }}
            onLoadEnd={() => {
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
      </ScrollView>
    </View>
  );
}
