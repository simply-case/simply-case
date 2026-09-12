import { useEffect, useRef } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * A pulsing placeholder block, used instead of a bare ActivityIndicator for
 * list/detail loading states. HANDOFF.md called loading states "the weakest
 * part of both apps" — a spinner tells you something is happening but not
 * what's about to appear; a skeleton shaped like the real content doesn't
 * make the screen feel like it jumped the moment data arrives.
 *
 * Uses the RN Animated API rather than a new dependency — this is one
 * looping opacity tween, not worth pulling in a library for.
 */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const { colors, radii } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, opacity }, style]}
    />
  );
}

/** The case-list loading state: a handful of card-shaped skeletons instead
 * of a single centered spinner, so the screen's structure is visible while
 * data is still in flight. */
export function CaseListSkeleton() {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Skeleton style={{ height: 16, width: "55%" }} />
          <Skeleton style={{ height: 12, width: "35%" }} />
          <Skeleton style={{ height: 22, width: 90, borderRadius: radii.full, marginTop: spacing.xs }} />
        </View>
      ))}
    </View>
  );
}
