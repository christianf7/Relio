import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: 15 March 2026</Text>

        <Section
          title="Acceptance"
          body="By creating an account or using Relio, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you should not use the app."
        />

        <Section
          title="Eligibility"
          body="You must be legally able to use online services in your jurisdiction and provide accurate account information. You are responsible for maintaining access to your account."
        />

        <Section
          title="User Content"
          body="You are responsible for content you upload or share, including profile details, messages, and event information. You must have the rights needed to share your content."
        />

        <Section
          title="Acceptable Use"
          body="You agree not to abuse, harass, impersonate others, spam, scrape, reverse engineer, or interfere with Relio services. We may suspend or terminate accounts that violate these rules."
        />

        <Section
          title="Events and Connections"
          body="Relio helps facilitate event participation and networking, but does not guarantee outcomes, attendance, compatibility, or safety of third-party events and interactions."
        />

        <Section
          title="Third-Party Services"
          body="Relio may rely on third-party providers for authentication, hosting, storage, and communication. Their terms and policies may also apply to your use."
        />

        <Section
          title="Termination"
          body="You may stop using Relio at any time. We may limit or terminate access for policy violations, abuse, or legal compliance needs."
        />

        <Section
          title="Limitation of Liability"
          body="To the fullest extent allowed by law, Relio is provided on an as-is basis without warranties. We are not liable for indirect, incidental, or consequential damages arising from use of the service."
        />

        <Section
          title="Changes to Terms"
          body="We may update these terms from time to time. Continued use after updates means you accept the revised terms."
        />

        <Section
          title="Contact"
          body="For legal or terms inquiries, contact: me@chrisfitz.dev"
        />

        <Text style={styles.disclaimer}>
          These terms are provided as product copy and may need legal review
          before production release.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 22,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  lastUpdated: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 22,
  },
  disclaimer: {
    marginTop: 8,
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    lineHeight: 18,
  },
});
