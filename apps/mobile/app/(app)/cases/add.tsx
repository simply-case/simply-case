import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { normalizeCaseKey, normalizeCeacCaseKey } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Input } from "@/components/ui";

/** The three ways a case can be added, each with its own input shape and
 * validation. EOIR is deliberately not offered — out of scope, see
 * docs/HANDOFF.md §5 ("don't re-litigate"). */
type AddCaseType = "uscis" | "ceac_immigrant" | "ceac_nonimmigrant";

const CASE_TYPES: Array<{
  id: AddCaseType;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  fieldLabel: string;
  placeholder: string;
  formatError: string;
  helpText: string;
}> = [
  {
    id: "uscis",
    label: "USCIS",
    sublabel: "A receipt number from a Form I-797 notice",
    icon: "document-text-outline",
    fieldLabel: "Receipt number",
    placeholder: "IOE0912345678",
    formatError: "Expected 3 letters followed by 10 digits, e.g. IOE0912345678.",
    helpText: "Found on your Form I-797 receipt notice — 3 letters followed by 10 digits.",
  },
  {
    id: "ceac_immigrant",
    label: "NVC case",
    sublabel: "An immigrant visa case number from the National Visa Center",
    icon: "earth-outline",
    fieldLabel: "NVC case number",
    placeholder: "MTL2024678901",
    formatError: "Expected 3 letters followed by 8-10 digits, e.g. MTL2024678901.",
    helpText: "Found in your NVC welcome letter or invoice — 3 letters followed by 8-10 digits.",
  },
  {
    id: "ceac_nonimmigrant",
    label: "Visa application",
    sublabel: "A DS-160 nonimmigrant visa application",
    icon: "card-outline",
    fieldLabel: "DS-160 Application ID",
    placeholder: "AA00123456789",
    formatError: "Expected 2 letters followed by 8-12 digits, e.g. AA00123456789.",
    helpText: "The Application ID from your DS-160 confirmation page — 2 letters followed by 8-12 digits.",
  },
];

/**
 * Two-step "add a case" flow, presented as a modal (see cases/_layout.tsx).
 * Kept as one screen with internal step state rather than two routes —
 * there's no deep-linkable state worth a URL here, and it keeps "back to
 * type picker" vs "close the whole flow" trivial to tell apart (back
 * button vs the X).
 */
export default function AddCaseScreen() {
  const [selected, setSelected] = useState<AddCaseType | null>(null);

  return selected ? (
    <CaseNumberForm typeId={selected} onBack={() => setSelected(null)} />
  ) : (
    <TypePicker onSelect={setSelected} />
  );
}

function TypePicker({ onSelect }: { onSelect: (t: AddCaseType) => void }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>

        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text }}>
          Add a case
        </Text>
        <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }}>
          Choose which kind of case number you have.
        </Text>

        <View style={{ gap: spacing.md }}>
          {CASE_TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={t.icon} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.text }}>{t.label}</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>{t.sublabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function CaseNumberForm({ typeId, onBack }: { typeId: AddCaseType; onBack: () => void }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const type = CASE_TYPES.find((t) => t.id === typeId)!;
  const [caseNumber, setCaseNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    let normalized: string;
    let provider: "uscis" | "ceac";
    try {
      if (typeId === "uscis") {
        provider = "uscis";
        normalized = normalizeCaseKey("uscis", caseNumber);
      } else {
        provider = "ceac";
        normalized = normalizeCeacCaseKey(typeId === "ceac_immigrant" ? "immigrant" : "nonimmigrant", caseNumber);
      }
    } catch {
      setError(type.formatError);
      return;
    }

    setError(null);
    setSubmitting(true);
    // Same add_case() RPC the web app and the old inline form called —
    // tracked_cases has no insert policy for authenticated users by
    // design, so a direct insert isn't an option; this is the only path in.
    const { error: rpcError } = await supabase.rpc("add_case", {
      p_provider: provider,
      p_case_key: normalized,
      p_nickname: nickname.trim() || undefined,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    // The list screen reloads its cases on focus (see useFocusEffect in
    // cases/index.tsx), so a plain back() is enough — no need to thread a
    // refresh callback through the modal boundary.
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text, marginBottom: spacing.xl }}>
          {type.label}
        </Text>

        <View style={{ gap: spacing.md, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>{type.fieldLabel}</Text>
            <Pressable
              onPress={() => Alert.alert(type.fieldLabel, type.helpText)}
              accessibilityRole="button"
              accessibilityLabel={`Where to find your ${type.fieldLabel}`}
              hitSlop={10}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textFaint} />
            </Pressable>
          </View>
          <Input
            value={caseNumber}
            onChangeText={(t) => {
              setCaseNumber(t);
              if (error) setError(null);
            }}
            placeholder={type.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            error={error ?? undefined}
          />

          {/* autoCapitalize="none": a nickname shouldn't be forced into Title
              Case as you type (RN's TextInput defaults to "sentences"). The
              user can still capitalize manually — this only removes the
              automatic behavior, not the ability. */}
          <Input
            label="Nickname (optional)"
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. My I-485"
            autoCapitalize="none"
          />
        </View>

        <Button label="Add case" onPress={handleSubmit} loading={submitting} disabled={caseNumber.length === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
