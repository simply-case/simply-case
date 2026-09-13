import { ScrollView, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { ListRow } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

/**
 * Formerly the empty "More" tab. Renamed to Resources (ROADMAP Phase F1) —
 * a real index of official government tools, opened in the in-app browser
 * rather than the system browser so the user never fully leaves the app.
 *
 * Deliberately real links, not "coming soon" placeholders: a disabled tab
 * with no explanation reads as broken, but an empty features list isn't
 * better just because the tab has a name. Each entry here is something
 * genuinely useful today, on the official government site. As F2/F3/F5
 * land, entries get replaced with real in-app screens one at a time —
 * RESOURCE_LINKS is the single place that happens, so no other file needs
 * to change when a link becomes a feature.
 */
interface ResourceLink {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const RESOURCE_LINKS: ResourceLink[] = [
  {
    id: "case-status",
    title: "USCIS Case Status Online",
    description: "Look up any receipt number directly on USCIS's own site.",
    url: "https://egov.uscis.gov/",
    icon: "search-outline",
  },
  {
    id: "processing-times",
    title: "USCIS Processing Times",
    description: "Official current processing-time estimates by form and office.",
    url: "https://egov.uscis.gov/processing-times/",
    icon: "time-outline",
  },
  {
    id: "visa-bulletin",
    title: "Visa Bulletin",
    description: "Monthly priority-date cutoffs from the Department of State.",
    url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    icon: "calendar-outline",
  },
  {
    id: "ceac-status",
    title: "Visa Status (CEAC)",
    description: "Check an immigrant or nonimmigrant visa application status.",
    url: "https://ceac.state.gov/CEACStatTracker/Status.aspx",
    icon: "airplane-outline",
  },
  {
    id: "nvc-timeframes",
    title: "NVC Timeframes",
    description: "How long the National Visa Center is currently taking to process documents.",
    url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html",
    icon: "hourglass-outline",
  },
];

export default function ResourcesScreen() {
  const { colors, spacing, fontSize, radii } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
      >
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs }}>
          Official tools from USCIS and the Department of State, opened
          right here in the app.
        </Text>

        {RESOURCE_LINKS.map((link) => (
          <ListRow
            key={link.id}
            onPress={() => WebBrowser.openBrowserAsync(link.url)}
            accessibilityLabel={link.title}
            accessibilityHint={link.description}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={link.icon} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
                  {link.title}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {link.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </View>
          </ListRow>
        ))}

        <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textAlign: "center", marginTop: spacing.md }}>
          These open the official government sites. Simply Case is not
          affiliated with USCIS or the U.S. Department of State.
        </Text>
      </ScrollView>
    </View>
  );
}
