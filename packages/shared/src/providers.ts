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

/** CEAC visa case number, e.g. MTL2024678901 or AIT2024123456. */
export const ceacCaseSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}\d{8,10}$/, "Case numbers are 3 letters followed by 8-10 digits");

/** Normalizes user input into the canonical `case_key` we store per provider. */
export function normalizeCaseKey(provider: Provider, input: string): string {
  switch (provider) {
    case "uscis":
      return uscisReceiptSchema.parse(input);
    case "eoir":
      return aNumberSchema.parse(input);
    case "ceac":
      return ceacCaseSchema.parse(input);
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
