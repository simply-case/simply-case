import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { getLegalDocument, type LegalDocId } from "@mycasepro/shared";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { useTheme } from "@/lib/theme";

/**
 * Terms of Service / Privacy Policy, rendered natively from the shared
 * content in packages/shared/src/legal.ts — the same text the web pages
 * render, so the two can't drift apart.
 *
 * Previously these opened the Vercel site in a browser sheet. Native means
 * it works offline and doesn't depend on the website being up, which
 * matters for the Privacy Policy specifically: it's linked from the signup
 * screen, and someone should never be unable to read what they're agreeing
 * to because a deploy is down.
 *
 * Reachable signed OUT (linked from the consent checkbox on sign-in) and
 * signed IN (Profile), so it sits outside both Stack.Protected guards in
 * app/_layout.tsx.
 */
export default function LegalScreen() {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  // Anything that isn't one of the two known documents falls back to the
  // Terms rather than rendering a blank screen — the route is only ever
  // linked internally, so a bad value means a coding mistake, not input.
  const docId: LegalDocId = doc === "privacy" ? "privacy" : "terms";
  const document = getLegalDocument(docId);

  return (
    <>
      <Stack.Screen options={{ title: document.title }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
      >
        <Text
          style={{
            fontSize: fontSize.xl,
            fontFamily: fontFamily.serif,
            fontWeight: "700",
            color: colors.text,
          }}
        >
          {document.title}
        </Text>
        <View style={{ marginTop: spacing.xl }}>
          <LegalDocumentView
            document={document}
            // replace, not push: following Terms -> Privacy -> Terms
            // shouldn't build a back stack to tap through to escape.
            onNavigate={(next) => router.replace(`/legal/${next}`)}
          />
          {/* Footer, not header — matches the sheet presentation. */}
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              marginTop: spacing.xl,
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            Last updated: {document.lastUpdated}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
