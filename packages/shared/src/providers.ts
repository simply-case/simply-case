import { z } from "zod";

/** The three case-status sources we track. */
export const PROVIDERS = ["uscis", "eoir", "ceac"] as const;
export const providerSchema = z.enum(PROVIDERS);
export type Provider = z.infer<typeof providerSchema>;

/**
 * USCIS receipt number. Their OpenAPI spec documents two valid formats:
 *   [a-zA-Z]{3}[0-9]{10}   e.g. IOE0912345678, MSC2190123456
 *   [a-zA-Z]{3}\*[0-9]{9}  e.g. EAC*999910340
 * The asterisk form is easy to overlook; rejecting it here would refuse input
 * the API itself accepts. Kept in sync with isValidReceiptNumber() in
 * supabase/functions/_shared/uscis.ts.
 */
export const uscisReceiptSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{3}(\d{10}|\*\d{9})$/,
    "Receipt numbers are 3 letters followed by 10 digits (e.g. IOE0912345678)",
  );

/** EOIR A-Number: 8 or 9 digits, commonly written A123-456-789. */
export const aNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .pipe(z.string().regex(/^\d{8,9}$/, "An A-Number is 8 or 9 digits"));

/** CEAC immigrant (NVC) visa case number, e.g. MTL2024678901 or AIT2024123456. */
export const ceacCaseSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}\d{8,10}$/, "Case numbers are 3 letters followed by 8-10 digits");

/**
 * CEAC nonimmigrant DS-160 Application ID, e.g. AA00123456789 — publicly
 * documented as 2 letters followed by roughly 10 digits, but this has NOT
 * been verified against a live CEAC form (docs/PHASE_F_PLAN.md F5). Kept
 * intentionally a little permissive (8-12 digits) rather than exact, so a
 * real ID isn't rejected over an off-by-one guess; tighten once verified
 * against the real form.
 */
export const ceacApplicationIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}\d{8,12}$/, "Application IDs are 2 letters followed by 8-12 digits");

/** CEAC tracks two genuinely different case shapes under one provider —
 * see docs/PLAN.md CEAC section. Encoded as a prefix on the stored
 * `case_key` (`IV:`/`NIV:`) so claim_due_cases and the UI can tell them
 * apart without a separate schema column. */
export const CEAC_CASE_TYPES = ["immigrant", "nonimmigrant"] as const;
export type CeacCaseType = (typeof CEAC_CASE_TYPES)[number];

const CEAC_IV_PREFIX = "IV:";
const CEAC_NIV_PREFIX = "NIV:";

/** Builds the canonical CEAC `case_key` for either case type. */
export function normalizeCeacCaseKey(type: CeacCaseType, input: string): string {
  return type === "immigrant"
    ? `${CEAC_IV_PREFIX}${ceacCaseSchema.parse(input)}`
    : `${CEAC_NIV_PREFIX}${ceacApplicationIdSchema.parse(input)}`;
}

/** Splits a stored CEAC `case_key` back into its type and the raw value the
 * user entered. Returns null for a key that isn't in the expected shape
 * (defensive — should never happen for a row this app created). */
export function parseCeacCaseKey(caseKey: string): { type: CeacCaseType; value: string } | null {
  if (caseKey.startsWith(CEAC_IV_PREFIX)) {
    return { type: "immigrant", value: caseKey.slice(CEAC_IV_PREFIX.length) };
  }
  if (caseKey.startsWith(CEAC_NIV_PREFIX)) {
    return { type: "nonimmigrant", value: caseKey.slice(CEAC_NIV_PREFIX.length) };
  }
  return null;
}

/** Strips the internal `IV:`/`NIV:` prefix for display — a CEAC case
 * should read as "MTL2024678901" to the user, not "IV:MTL2024678901". A
 * no-op for uscis/eoir case_keys, which never have this prefix. */
export function displayCaseKey(caseKey: string): string {
  return parseCeacCaseKey(caseKey)?.value ?? caseKey;
}

/**
 * Normalizes user input into the canonical `case_key` we store per
 * provider. NOT for CEAC, which needs to know which of its two case types
 * the input is before it can be normalized — callers use
 * normalizeCeacCaseKey directly instead (see apps/mobile's add-case flow).
 * `provider` still accepts the full Provider union rather than excluding
 * "ceac" at the type level, since existing callers (e.g. the web app's
 * addCase action) pass through a form value typed as the whole enum —
 * excluding "ceac" here would force every such caller to narrow first for
 * no real benefit, since the disabled "ceac" option in that form can't
 * actually be submitted today anyway.
 */
export function normalizeCaseKey(provider: Provider, input: string): string {
  switch (provider) {
    case "uscis":
      return uscisReceiptSchema.parse(input);
    case "eoir":
      return aNumberSchema.parse(input);
    case "ceac":
      throw new Error("normalizeCaseKey doesn't support ceac — use normalizeCeacCaseKey instead.");
  }
}

/** Shape every provider adapter returns. `bodyHash` drives change detection. */
export const providerResultSchema = z.object({
  status: z.string().min(1),
  detail: z.string().nullable(),
  bodyHash: z.string(),
  fetchedAt: z.string().datetime(),
});
export type ProviderResult = z.infer<typeof providerResultSchema>;

export interface CaseProvider {
  readonly id: Provider;
  fetchStatus(caseKey: string): Promise<ProviderResult>;
}
