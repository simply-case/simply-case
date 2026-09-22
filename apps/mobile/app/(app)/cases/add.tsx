import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { normalizeCaseKey, normalizeCeacCaseKey } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { saveCeacDetails } from "@/lib/ceac-details";
import { CEAC_LOCATIONS } from "@/lib/ceac-locations";
import { LocationPicker } from "@/components/LocationPicker";
import { saveEoirDetails } from "@/lib/eoir-details";
import { eoirNationalityLabel, findEoirNationality } from "@/lib/eoir-nationalities";
import { NationalityPicker } from "@/components/NationalityPicker";
import { Button, Input } from "@/components/ui";

/** The ways a case can be added. The three CEAC/USCIS tiles are back to
 * being separate per the user's request (2026-09-17) — a brief merged
 * "Visa case" tile with an in-form Immigrant/Nonimmigrant toggle was tried
 * and reverted; picking the tile is the type question now, same as
 * originally. Passport/surname/location collection (added for CEAC
 * autofill) is unaffected — only the picker step changed. EOIR was added
 * as a fourth tile the same day, back in scope per docs/HANDOFF.md §5. */
type AddCaseType = "uscis" | "ceac_immigrant" | "ceac_nonimmigrant" | "eoir";
type VisaType = "immigrant" | "nonimmigrant";

const CASE_TYPES: Array<{
  id: AddCaseType;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: "uscis",
    label: "USCIS",
    sublabel: "A receipt number from a Form I-797 notice",
    icon: "document-text-outline",
  },
  {
    id: "ceac_immigrant",
    label: "NVC case",
    sublabel: "An immigrant visa case number from the National Visa Center",
    icon: "earth-outline",
  },
  {
    id: "ceac_nonimmigrant",
    label: "Visa application",
    sublabel: "A DS-160 nonimmigrant visa application",
    icon: "card-outline",
  },
  {
    id: "eoir",
    label: "Immigration court",
    sublabel: "An A-Number for a case before the immigration court (EOIR)",
    icon: "hammer-outline",
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

  if (selected === "uscis") return <UscisForm onBack={() => setSelected(null)} />;
  if (selected === "ceac_immigrant") return <CeacForm visaType="immigrant" onBack={() => setSelected(null)} />;
  if (selected === "ceac_nonimmigrant") return <CeacForm visaType="nonimmigrant" onBack={() => setSelected(null)} />;
  if (selected === "eoir") return <EoirForm onBack={() => setSelected(null)} />;
  return <TypePicker onSelect={setSelected} />;
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

function UscisForm({ onBack }: { onBack: () => void }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const [caseNumber, setCaseNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    let normalized: string;
    try {
      normalized = normalizeCaseKey("uscis", caseNumber);
    } catch {
      setError("Expected 3 letters followed by 10 digits, e.g. IOE0912345678.");
      return;
    }

    setError(null);
    setSubmitting(true);
    // tracked_cases has no insert policy for authenticated users by
    // design, so a direct insert isn't an option; this is the only path in.
    const { error: rpcError } = await supabase.rpc("add_case", {
      p_provider: "uscis",
      p_case_key: normalized,
      p_nickname: nickname.trim() || undefined,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text, marginBottom: spacing.xl }}>
          USCIS
        </Text>

        <View style={{ gap: spacing.md, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>Receipt number</Text>
            <Pressable
              onPress={() =>
                Alert.alert("Receipt number", "Found on your Form I-797 receipt notice — 3 letters followed by 10 digits.")
              }
              accessibilityRole="button"
              accessibilityLabel="Where to find your receipt number"
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
            placeholder="IOE0912345678"
            autoCapitalize="characters"
            autoCorrect={false}
            error={error ?? undefined}
          />

          {/* autoCapitalize="none": a nickname shouldn't be forced into Title
              Case as you type (RN's TextInput defaults to "sentences"). The
              user can still capitalize manually — this only removes the
              automatic behavior, not the ability. */}
          <Input label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder="e.g. My I-485" autoCapitalize="none" />
        </View>

        <Button label="Add case" onPress={handleSubmit} loading={submitting} disabled={caseNumber.length === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Fields mirror CEAC's own form (ceac.state.gov/CEACStatTracker/Status.aspx,
 * inspected 2026-09-16) for the given visa type, so what's collected here
 * lines up with what CEAC's page itself asks for and can autofill it
 * exactly (see cases/ceac-refresh/[id].tsx). Which type is fixed by which
 * tile the user picked on the previous screen — not a toggle in this form
 * (reverted 2026-09-17, see CASE_TYPES comment above).
 */
function CeacForm({ visaType, onBack }: { visaType: VisaType; onBack: () => void }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const [caseNumber, setCaseNumber] = useState("");
  const [locationCode, setLocationCode] = useState<string | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [passportNumber, setPassportNumber] = useState("");
  const [surname, setSurname] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLocation = CEAC_LOCATIONS.find((l) => l.code === locationCode) ?? null;
  const canSubmit = caseNumber.length > 0 && (visaType === "immigrant" || locationCode !== null);

  async function handleSubmit() {
    let normalized: string;
    try {
      normalized = normalizeCeacCaseKey(visaType, caseNumber);
    } catch {
      setError(
        visaType === "immigrant"
          ? "Expected 3 letters followed by 8-10 digits, e.g. MTL2024678901."
          : "Expected 2 letters followed by 8-12 digits, e.g. AA00123456789.",
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    const { data: userCase, error: rpcError } = await supabase.rpc("add_case", {
      p_provider: "ceac",
      p_case_key: normalized,
      p_nickname: nickname.trim() || undefined,
    });

    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }

    // Best-effort: the case itself is already saved server-side at this
    // point, so a secure-storage hiccup here shouldn't block finishing
    // the flow or surface as if adding the case had failed. Passport and
    // surname are stored ONLY on this device (lib/ceac-details.ts) —
    // never sent to Supabase — see docs/HANDOFF.md §5.
    if (userCase && (passportNumber.trim() || surname.trim() || locationCode)) {
      try {
        await saveCeacDetails(userCase.tracked_case_id, {
          passportNumber: passportNumber.trim(),
          surname: surname.trim(),
          location: visaType === "nonimmigrant" ? locationCode : null,
        });
      } catch {
        // Swallow — the case was added successfully regardless.
      }
    }

    setSubmitting(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text, marginBottom: spacing.xs }}>
          {visaType === "immigrant" ? "NVC case" : "Visa application"}
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xl }}>
          These match the exact questions on the State Department's own status page.
        </Text>

        <View style={{ gap: spacing.md, flex: 1 }}>
          {visaType === "nonimmigrant" && (
            <>
              <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted, marginTop: spacing.sm }}>
                Select a location
              </Text>
              <Pressable
                onPress={() => setLocationPickerOpen(true)}
                accessibilityRole="button"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: fontSize.base, color: selectedLocation ? colors.text : colors.textFaint }}>
                  {selectedLocation ? selectedLocation.label : "- SELECT ONE -"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
              </Pressable>
            </>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>
              {visaType === "immigrant" ? "NVC case number" : "Application ID or Case Number"}
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  visaType === "immigrant" ? "NVC case number" : "Application ID or Case Number",
                  visaType === "immigrant"
                    ? "Found in your NVC welcome letter or invoice — 3 letters followed by 8-10 digits, e.g. MTL2024678901."
                    : "The Application ID from your DS-160 confirmation page — 2 letters followed by 8-12 digits, e.g. AA00123456789.",
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Where to find this"
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
            placeholder={visaType === "immigrant" ? "MTL2024678901" : "AA00123456789"}
            autoCapitalize="characters"
            autoCorrect={false}
            error={error ?? undefined}
          />

          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm }}>
            CEAC's site also asks for these on every check. Save them here (optional) and we'll fill them in
            for you every time — kept only on this phone, never sent to us.
          </Text>
          <Input label="Passport number (optional)" value={passportNumber} onChangeText={setPassportNumber} autoCapitalize="characters" autoCorrect={false} />
          <Input
            label="First 5 letters of surname (optional)"
            value={surname}
            onChangeText={setSurname}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={5}
          />

          {/* autoCapitalize="none": a nickname shouldn't be forced into Title
              Case as you type (RN's TextInput defaults to "sentences"). The
              user can still capitalize manually — this only removes the
              automatic behavior, not the ability. */}
          <Input label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder="e.g. My visa case" autoCapitalize="none" />
        </View>

        <Button label="Add case" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} />
      </ScrollView>

      <LocationPicker
        visible={locationPickerOpen}
        selectedCode={locationCode}
        onSelect={(loc) => {
          setLocationCode(loc.code);
          setLocationPickerOpen(false);
        }}
        onClose={() => setLocationPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Fields mirror ACIS's own form (acis.eoir.justice.gov/en/, inspected
 * 2026-09-17): an A-Number and a nationality, so what's collected here
 * lines up with what the page itself asks for and can autofill it (see
 * cases/eoir-refresh/[id].tsx). Nationality is device-only, same reasoning
 * as CEAC's passport/surname/location (lib/eoir-details.ts) — the A-Number
 * itself is NOT device-only, since it's the case_key that identifies the
 * case server-side, same as a USCIS receipt number.
 */
function EoirForm({ onBack }: { onBack: () => void }) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const [aNumber, setANumber] = useState("");
  const [nationalityCode, setNationalityCode] = useState<string | null>(null);
  const [nationalityPickerOpen, setNationalityPickerOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNationality = nationalityCode ? findEoirNationality(nationalityCode) : null;

  async function handleSubmit() {
    let normalized: string;
    try {
      normalized = normalizeCaseKey("eoir", aNumber);
    } catch {
      setError("An A-Number is 8 or 9 digits, e.g. 012345678.");
      return;
    }

    setError(null);
    setSubmitting(true);
    const { data: userCase, error: rpcError } = await supabase.rpc("add_case", {
      p_provider: "eoir",
      p_case_key: normalized,
      p_nickname: nickname.trim() || undefined,
    });

    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }

    // Best-effort, same pattern as CeacForm above: the case itself is
    // already saved server-side, so a secure-storage hiccup here
    // shouldn't block finishing the flow.
    if (userCase && nationalityCode) {
      try {
        await saveEoirDetails(userCase.tracked_case_id, { nationalityCode });
      } catch {
        // Swallow — the case was added successfully regardless.
      }
    }

    setSubmitting(false);
    // Back to the case list rather than into the refresh screen directly
    // (tried first, reverted the same day) — the refresh screen now runs
    // its whole lookup automatically the moment it's opened, so tapping
    // the case from the list is a better entry point than landing there
    // mid-flow straight off the add form.
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={{ fontSize: fontSize.xxl, fontFamily: fontFamily.serif, fontWeight: "700", color: colors.text, marginBottom: spacing.xs }}>
          Immigration court
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xl }}>
          These match the exact questions on the immigration court's own case lookup.
        </Text>

        <View style={{ gap: spacing.md, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>A-Number</Text>
            <Pressable
              onPress={() =>
                Alert.alert("A-Number", "Your Alien Registration Number — 8 or 9 digits, found on court and immigration paperwork.")
              }
              accessibilityRole="button"
              accessibilityLabel="Where to find your A-Number"
              hitSlop={10}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textFaint} />
            </Pressable>
          </View>
          <Input
            value={aNumber}
            onChangeText={(t) => {
              setANumber(t);
              if (error) setError(null);
            }}
            placeholder="012345678"
            keyboardType="number-pad"
            error={error ?? undefined}
          />

          <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted, marginTop: spacing.sm }}>
            Nationality (optional)
          </Text>
          <Pressable
            onPress={() => setNationalityPickerOpen(true)}
            accessibilityRole="button"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: spacing.md,
              backgroundColor: colors.surface,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: fontSize.base, color: selectedNationality ? colors.text : colors.textFaint }}>
              {selectedNationality ? eoirNationalityLabel(selectedNationality) : "-- Select Nationality --"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
          </Pressable>
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
            The court's site also asks for this on every check. Save it here (optional) and we'll fill it in for
            you every time — kept only on this phone, never sent to us.
          </Text>

          {/* autoCapitalize="none": a nickname shouldn't be forced into Title
              Case as you type (RN's TextInput defaults to "sentences"). The
              user can still capitalize manually — this only removes the
              automatic behavior, not the ability. */}
          <Input label="Nickname (optional)" value={nickname} onChangeText={setNickname} placeholder="e.g. My court case" autoCapitalize="none" />
        </View>

        <Button label="Add case" onPress={handleSubmit} loading={submitting} disabled={aNumber.length === 0} />
      </ScrollView>

      <NationalityPicker
        visible={nationalityPickerOpen}
        selectedCode={nationalityCode}
        onSelect={(n) => {
          setNationalityCode(n.code);
          setNationalityPickerOpen(false);
        }}
        onClose={() => setNationalityPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}
