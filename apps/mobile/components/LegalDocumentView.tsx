import { Text, View } from "react-native";
import type { LegalBlock, LegalDocId, LegalInline, LegalDocument } from "@mycasepro/shared";
import { useTheme } from "@/lib/theme";

/**
 * Renders a legal document's body from the shared content in
 * packages/shared/src/legal.ts.
 *
 * Presentation-free on purpose — no scroll container, no header — so the
 * same rendering serves both places this text appears: the full screen
 * (app/legal/[doc].tsx, reached from Profile) and the sheet that slides
 * over the signup form. Those two need different framing but must never
 * show different text.
 *
 * `onNavigate` is how the one cross-document link (Terms -> Privacy
 * Policy) is handled, and it differs by context: the full screen replaces
 * the route, while the sheet swaps its own content in place rather than
 * navigating out from under the signup form the user is in the middle of.
 */
export function LegalDocumentView({
  document,
  onNavigate,
}: {
  document: LegalDocument;
  onNavigate: (doc: LegalDocId) => void;
}) {
  const { colors, spacing, fontSize } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      {document.sections.map((section) => (
        <View key={section.heading} style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: "700", color: colors.text }}>
            {section.heading}
          </Text>
          {section.blocks.map((block, i) => (
            <LegalBlockView key={i} block={block} onNavigate={onNavigate} />
          ))}
        </View>
      ))}
    </View>
  );
}

function LegalBlockView({
  block,
  onNavigate,
}: {
  block: LegalBlock;
  onNavigate: (doc: LegalDocId) => void;
}) {
  const { colors, spacing, fontSize } = useTheme();

  const bodyStyle = {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: fontSize.base * 1.5,
  } as const;

  if (block.kind === "list") {
    return (
      <View style={{ gap: spacing.xs }}>
        {block.items.map((item, i) => (
          // Bullet in its own column so wrapped lines stay indented past it
          // rather than running back under the dot.
          <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
            <Text style={bodyStyle}>{"•"}</Text>
            <Text style={[bodyStyle, { flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Text style={bodyStyle}>
      {block.content.map((inline, i) => (
        <LegalInlineView key={i} inline={inline} onNavigate={onNavigate} />
      ))}
    </Text>
  );
}

function LegalInlineView({
  inline,
  onNavigate,
}: {
  inline: LegalInline;
  onNavigate: (doc: LegalDocId) => void;
}) {
  const { colors } = useTheme();

  if (typeof inline === "string") return <>{inline}</>;

  return (
    <Text
      style={{ color: colors.link, textDecorationLine: "underline" }}
      onPress={() => onNavigate(inline.doc)}
    >
      {inline.text}
    </Text>
  );
}
