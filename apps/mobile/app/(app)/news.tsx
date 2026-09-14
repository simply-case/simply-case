import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Database } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { EmptyState, ListRow, Skeleton } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

type NewsRow = Database["public"]["Tables"]["news_items"]["Row"];

const SOURCE_LABEL: Record<string, string> = {
  federal_register: "Federal Register",
  uscis_newsroom: "USCIS Newsroom",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Real immigration news (ROADMAP Phase F4), replacing the placeholder
 * sample cards. Reads from news_items, populated on a schedule by the
 * fetch-news Edge Function (supabase/functions/fetch-news) — never fetched
 * directly from the client, so a dead upstream feed can't break this
 * screen and there's no way for junk to reach it unfiltered.
 *
 * Before migration 0013 is applied to production this query will fail;
 * the error state below handles that the same as any other real failure
 * rather than falling back to fake data.
 */
export default function NewsScreen() {
  const { colors, spacing, fontSize } = useTheme();
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("news_items")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setError(null);
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    loadNews().finally(() => setLoading(false));
  }, [loadNews]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: spacing.xs }}>
              <Skeleton style={{ height: 12, width: "40%" }} />
              <Skeleton style={{ height: 18, width: "85%" }} />
              <Skeleton style={{ height: 14, width: "95%" }} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            title="Couldn't load news"
            message="Something went wrong fetching the latest updates. Pull down to try again."
          />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            title="No news yet"
            message="Check back soon — this updates automatically every few hours."
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <ListRow onPress={() => WebBrowser.openBrowserAsync(item.url)} accessibilityLabel={item.title}>
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: fontSize.xs, color: colors.textFaint, textTransform: "uppercase" }}>
                  {SOURCE_LABEL[item.source] ?? item.source} · {formatDate(item.published_at)}
                </Text>
                <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
                  {item.title}
                </Text>
                {item.summary && (
                  <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }} numberOfLines={3}>
                    {item.summary}
                  </Text>
                )}
              </View>
            </ListRow>
          )}
        />
      )}
    </View>
  );
}
