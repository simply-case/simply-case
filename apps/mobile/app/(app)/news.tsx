import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

/**
 * Immigration news/articles tab.
 *
 * PLACEHOLDER CONTENT: no real source is wired up yet. Picking one is a
 * separate decision with real tradeoffs — a licensed news API (cost,
 * terms), an RSS feed (e.g. the USCIS newsroom, EOIR/DOJ press releases —
 * free, but per-source parsing and no guaranteed uptime), or hand-curated
 * posts (full control, ongoing manual work). None of those has been
 * chosen, so this renders realistic-looking sample cards to validate the
 * screen's layout, NOT real headlines — do not ship this as-is.
 *
 * When a source is picked: replace SAMPLE_ARTICLES with a real fetch
 * (likely a `news_articles` table populated by a scheduled function,
 * mirroring the check-cases/poll_runs pattern, or a direct client fetch
 * of an RSS feed via a small Edge Function to avoid CORS).
 */
const SAMPLE_ARTICLES = [
  {
    id: "1",
    source: "USCIS Newsroom",
    date: "Sample date",
    title: "USCIS Announces Updated Processing Times for Form I-485",
    summary: "Placeholder summary text standing in for a real article excerpt.",
  },
  {
    id: "2",
    source: "EOIR",
    date: "Sample date",
    title: "Executive Office for Immigration Review Issues Policy Update",
    summary: "Placeholder summary text standing in for a real article excerpt.",
  },
  {
    id: "3",
    source: "USCIS Newsroom",
    date: "Sample date",
    title: "Fee Schedule Changes Take Effect for Select Petition Types",
    summary: "Placeholder summary text standing in for a real article excerpt.",
  },
];

export default function NewsScreen() {
  const { colors, spacing, fontSize } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
      >
      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: 8,
          padding: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
          Sample layout — a real news source hasn&apos;t been picked yet.
        </Text>
      </View>

      {SAMPLE_ARTICLES.map((article) => (
        <Card key={article.id} style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase" }}>
            {article.source} · {article.date}
          </Text>
          <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>{article.title}</Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>{article.summary}</Text>
        </Card>
      ))}
      </ScrollView>
    </View>
  );
}
