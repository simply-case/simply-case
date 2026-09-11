"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeCaseKey, providerSchema } from "@mycasepro/shared";
import { createClient } from "@/lib/supabase/server";

export interface AddCaseState {
  status: "idle" | "error" | "success";
  message?: string;
}

const addCaseInput = z.object({
  provider: providerSchema,
  caseKey: z.string().min(1, "Enter a case number."),
  nickname: z.string().trim().max(80).optional(),
});

/**
 * Validates and normalizes the receipt number client-side of the database —
 * normalizeCaseKey() throws a descriptive ZodError before we ever spend a
 * round trip on something the provider would reject anyway. The actual
 * insert goes through add_case(), a security-definer RPC (see
 * supabase/migrations/0007_add_case_rpc.sql) rather than a direct insert,
 * because tracked_cases has no insert policy for authenticated users — by
 * design, so it can't be probed for which receipt numbers already exist.
 */
export async function addCase(
  _prev: AddCaseState,
  formData: FormData,
): Promise<AddCaseState> {
  const parsed = addCaseInput.safeParse({
    provider: formData.get("provider"),
    caseKey: formData.get("caseKey"),
    nickname: formData.get("nickname") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let normalizedKey: string;
  try {
    normalizedKey = normalizeCaseKey(parsed.data.provider, parsed.data.caseKey);
  } catch {
    return {
      status: "error",
      message: "That doesn't look like a valid case number for the selected provider.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_case", {
    p_provider: parsed.data.provider,
    p_case_key: normalizedKey,
    p_nickname: parsed.data.nickname,
  });

  if (error) {
    return { status: "error", message: "Couldn't add that case. Try again shortly." };
  }

  revalidatePath("/");
  return { status: "success", message: "Case added — first check happens within 15 minutes." };
}

const idSchema = z.string().uuid();

/** Soft-delete: stops polling for this user's subscription, keeps history. */
export async function archiveCase(userCaseId: string): Promise<void> {
  const id = idSchema.parse(userCaseId);
  const supabase = await createClient();
  await supabase.from("user_cases").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/");
}

export async function unarchiveCase(userCaseId: string): Promise<void> {
  const id = idSchema.parse(userCaseId);
  const supabase = await createClient();
  await supabase.from("user_cases").update({ archived_at: null }).eq("id", id);
  revalidatePath("/");
}

/** Hard delete of the subscription only — the shared tracked_case and its
 * history are untouched, since other users may still be tracking it. */
export async function removeCase(userCaseId: string): Promise<void> {
  const id = idSchema.parse(userCaseId);
  const supabase = await createClient();
  await supabase.from("user_cases").delete().eq("id", id);
  revalidatePath("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
}
