import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { openContactEmail } from "@/lib/links";
import { Button, Card } from "@/components/ui";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Where do I find my USCIS receipt number?",
    a: "It's on your Form I-797 receipt notice: 3 letters followed by 10 digits, e.g. IOE0912345678.",
  },
  {
    q: "Where do I find my NVC case number?",
    a: "In your NVC welcome letter or fee invoice: 3 letters followed by digits, e.g. MTL2024678901.",
  },
  {
    q: "Where do I find my DS-160 Application ID?",
    a: "On your DS-160 confirmation page: 2 letters followed by digits, e.g. AA00123456789.",
  },
  {
    q: "How often do statuses update?",
    a: "USCIS cases are checked automatically and you'll get an email when something changes. Visa (NVC / DS-160) cases only update when you open them and refresh, because the State Department site requires a CAPTCHA.",
  },
  {
    q: "Is Simply Case affiliated with the government?",
    a: "No. Simply Case is not affiliated with USCIS, the State Department, or any government agency, and it isn't legal advice. Always confirm your status on the official site.",
  },
];

export default function HelpScreen() {
  const { colors, spacing, fontSize } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}>
      {FAQ.map((item) => (
        <Card key={item.q} style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>{item.q}</Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>{item.a}</Text>
        </Card>
      ))}

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" }}>
          Something missing or not working?
        </Text>
        <Button label="Send feedback" variant="secondary" onPress={() => openContactEmail("Simply Case feedback")} />
      </View>
    </ScrollView>
  );
}
