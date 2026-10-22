import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { LEGAL_CHANGELOG } from "@mycasepro/shared";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui";

/**
 * Blocks the app behind an active-consent gate when `needsLegalReconsent`
 * is true (lib/auth-context.tsx) — USCIS's app-review requirement that a
 * policy change needs a real "I agree," not "kept using the app counts."
 *
 * Shown via a dedicated Stack.Protected branch in app/_layout.tsx, not as a
 * modal over the main app — there's no way to see this screen AND the real
 * app underneath, which is the point: it's a gate, not a dismissible
 * banner.
 *
 * Shows the latest LEGAL_CHANGELOG entry (a hand-written one-liner, not an
 * auto-generated diff — see packages/shared/src/legal.ts for why) rather
 * than the full document again; the full text is one tap away via the
 * existing legal/[doc] screen for anyone who wants it.
 */
export default function LegalUpdateScreen() {
  const { colors, spacing, fontSize, fontFamily, radii } = useTheme();
  const { acceptLegalUpdate, signOut } = useAuth();
  const [working, setWorking] = useState<"accept" | "decline" | null>(null);

  const latest = LEGAL_CHANGELOG[0];

  async function handleAccept() {
    setWorking("accept");
    try {
      await acceptLegalUpdate();
      // No navigation call needed: app/_layout.tsx's Stack.Protected guard
      // re-evaluates on every render, and clearing needsLegalReconsent
      // (inside acceptLegalUpdate) is what flips it back to the real app.
    } finally {
      setWorking(null);
    }
  }

  async function handleDecline() {
    // Declining signs the user out rather than deleting anything — "active
    // consent is required to use the app" doesn't have to mean "refusing
    // once costs you your account." They can come back and agree whenever
    // they're ready, or request deletion themselves if they'd rather not.
    setWorking("decline");
    await signOut();
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
    >
      <View style={{ gap: spacing.md }}>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontFamily: fontFamily.serif,
            fontWeight: "700",
            color: colors.text,
            textAlign: "center",
          }}
        >
          We've updated our policies
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            padding: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            {latest.date}
          </Text>
          <Text style={{ fontSize: fontSize.base, color: colors.text, lineHeight: fontSize.base * 1.5 }}>
            {latest.summary}
          </Text>
        </View>

        <Text
          onPress={() => router.push("/legal/terms")}
          style={{ fontSize: fontSize.sm, color: colors.link, textAlign: "center", fontWeight: "600" }}
        >
          Read the full Terms of Service
        </Text>
        <Text
          onPress={() => router.push("/legal/privacy")}
          style={{ fontSize: fontSize.sm, color: colors.link, textAlign: "center", fontWeight: "600", marginTop: -spacing.sm }}
        >
          Read the full Privacy Policy
        </Text>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button label="I agree" onPress={handleAccept} loading={working === "accept"} disabled={working !== null} />
          <Button
            label="Not now — sign me out"
            variant="ghost"
            onPress={handleDecline}
            loading={working === "decline"}
            disabled={working !== null}
          />
        </View>
      </View>
    </ScrollView>
  );
}
