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

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
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
          title="Overview"
          body="Relio collects and uses information to provide social networking features like profiles, event participation, messaging, and QR-based connections. By using Relio, you agree to this Privacy Policy."
        />

        <Section
          title="Information We Collect"
          body="We may collect account information (such as name, email, and profile photo), profile content you provide (bio, socials, enrolled units), event and connection activity, and basic technical information required to run the app securely."
        />

        <Section
          title="How We Use Information"
          body="We use your information to authenticate your account, personalize your profile, power event and people discovery, enable messaging, prevent abuse, and maintain the safety and reliability of the service."
        />

        <Section
          title="OAuth and LinkedIn"
          body="If you sign in with LinkedIn, Relio may use LinkedIn account data needed for authentication and profile linking. LinkedIn profile URL fields managed by OAuth may be locked from manual editing in-app."
        />

        <Section
          title="Sharing and Disclosure"
          body="Relio does not sell personal data. We may share data with trusted service providers (for hosting, authentication, storage, and analytics) only as needed to operate the app. We may also disclose information when required by law."
        />

        <Section
          title="Data Retention"
          body="We retain account and activity data while your account is active and as reasonably necessary for legal, security, and operational purposes."
        />

        <Section
          title="Your Choices"
          body="You can update profile information in-app. You may request account deletion or data access/correction by contacting the support address listed below."
        />

        <Section
          title="Security"
          body="We use reasonable administrative and technical safeguards to protect data, but no system is guaranteed to be 100% secure."
        />

        <Section
          title="Contact"
          body="For privacy questions or requests, contact: me@chrisfitz.dev"
        />

        <Text style={styles.disclaimer}>
          This policy is provided as product copy and may need legal review
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
