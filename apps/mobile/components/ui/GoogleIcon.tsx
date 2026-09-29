import Svg, { Path } from "react-native-svg";

/**
 * Google's four-color "G" mark, as vector paths.
 *
 * Drawn rather than pulled from @expo/vector-icons because that library's
 * `google` glyph is a FONT glyph — a font can only render in ONE color, so
 * it comes out as a flat single-color G, which is not Google's mark and
 * isn't what their sign-in branding guidelines allow.
 *
 * Using the real mark on a "Sign in with Google" control is the sanctioned
 * use of it. If the button around it changes, check those guidelines again
 * before altering the mark itself — the colors and proportions here are
 * Google's and shouldn't be recolored, rotated, or stretched to taste.
 *
 * viewBox is 48x48 (Google's own), so `size` scales it uniformly.
 */
export function GoogleIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* blue — right arm + crossbar */}
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      {/* green — lower right sweep */}
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      {/* yellow — left edge */}
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      {/* red — upper sweep */}
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}
