import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getLegalDocument, type LegalDocId } from "@mycasepro/shared";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { useTheme } from "@/lib/theme";

/**
 * Terms / Privacy shown as a sheet over whatever screen opened it.
 *
 * Uses iOS's NATIVE sheet presentation (`presentationStyle="pageSheet"`)
 * rather than a custom-animated panel. That's what gives drag-down-to-
 * dismiss, momentum scrolling and rubber-banding at the edges — all of it
 * real system behaviour, not an imitation. The alternative was pulling in
 * reanimated + gesture-handler + a bottom-sheet library and hand-writing
 * the gesture/scroll interaction (getting "only drag to close when the
 * scroll is already at the top" right is the fiddly part), which is a lot
 * of dependency and custom code for one sheet.
 *
 * On Android the same presentation renders as a full-screen modal; the X
 * button and the hardware back button both close it, so it stays usable —
 * it just doesn't get the drag gesture.
 *
 * Deliberately NOT the shared ui/BottomSheet: that one is a short,
 * content-hugging panel for Sort/Filter options, and stretching it to
 * carry a scrolling multi-page document would have compromised it for its
 * actual job.
 */
export function LegalSheet({
  doc,
  onClose,
  onNavigate,
}: {
  /** Which document to show, or null when closed. */
  doc: LegalDocId | null;
  onClose: () => void;
  onNavigate: (next: LegalDocId) => void;
}) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  const document = doc ? getLegalDocument(doc) : null;

  return (
    <Modal
      visible={doc !== null}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header stays put while the body scrolls, so the way out is
            always on screen — the reason the X is here rather than
            inline at the top of the text. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: fontSize.lg,
              fontFamily: fontFamily.serif,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            {document?.title ?? ""}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator
        >
          {document && (
            <>
              <LegalDocumentView document={document} onNavigate={onNavigate} />
              {/* Footer, not header: the date is a provenance detail, and
                  putting it first pushed the actual terms down the page. */}
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
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
