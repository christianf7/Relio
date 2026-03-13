import { useCallback, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient } from "~/utils/auth";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SIGNED_UP_EVENTS = [
  {
    id: "evt_1",
    title: "UniHack 2026",
    date: new Date("2026-04-15T09:00:00Z"),
    location: "Melbourne Convention Centre",
    bannerUrl: null,
    content: "Australia's largest student hackathon",
  },
  {
    id: "evt_2",
    title: "DevFest Melbourne",
    date: new Date("2026-05-20T10:00:00Z"),
    location: "Google Office, Melbourne",
    bannerUrl: null,
    content: "Annual developer conference hosted by Google",
  },
  {
    id: "evt_3",
    title: "Startup Weekend",
    date: new Date("2026-06-10T18:00:00Z"),
    location: "RMIT Activator",
    bannerUrl: null,
    content: "54-hour startup creation event",
  },
  {
    id: "evt_4",
    title: "AI/ML Meetup",
    date: new Date("2026-04-28T18:30:00Z"),
    location: "Zendesk Melbourne",
    bannerUrl: null,
    content: "Monthly AI/ML community meetup",
  },
];

const PEOPLE_TO_CONNECT = [
  { id: "usr_1", name: "Julia Smyth", avatarUrl: null, metAt: "UniHack" },
  { id: "usr_2", name: "Alex Chen", avatarUrl: null, metAt: "UniHack" },
  { id: "usr_3", name: "Sarah Kim", avatarUrl: null, metAt: "DevFest" },
  { id: "usr_4", name: "Marcus Lee", avatarUrl: null, metAt: "UniHack" },
  { id: "usr_5", name: "Priya Patel", avatarUrl: null, metAt: "Startup Weekend" },
];

const SUGGESTED_EVENTS = [
  {
    id: "evt_s1",
    title: "Tech Networking Night",
    date: new Date("2026-06-01T18:00:00Z"),
    location: "Innovation Hub",
    bannerUrl: null,
    organiserName: "TechMelb",
  },
  {
    id: "evt_s2",
    title: "Design Thinking Workshop",
    date: new Date("2026-05-15T09:00:00Z"),
    location: "RMIT Design Hub",
    bannerUrl: null,
    organiserName: "DesignCo",
  },
  {
    id: "evt_s3",
    title: "Cloud Summit 2026",
    date: new Date("2026-07-10T09:00:00Z"),
    location: "Convention Centre",
    bannerUrl: null,
    organiserName: "AWS",
  },
  {
    id: "evt_s4",
    title: "Founders Forum",
    date: new Date("2026-05-28T17:00:00Z"),
    location: "Stone & Chalk",
    bannerUrl: null,
    organiserName: "StartupVic",
  },
];

const CAROUSEL_GRADIENTS: [string, string][] = [
  ["#2D1B69", "#11998E"],
  ["#4A1942", "#E04882"],
  ["#1A2980", "#26D0CE"],
  ["#2C3E50", "#FD746C"],
];

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
];

const SUGGESTED_GRADIENTS: [string, string][] = [
  ["#0F2027", "#2C5364"],
  ["#2D1B69", "#4A1942"],
  ["#1A2980", "#4880E0"],
  ["#2C3E50", "#3498DB"],
];

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  if (GlassView && Platform.OS === "ios") {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.glassBase, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.glassBase, styles.glassFallback, style]}>
      {children}
    </View>
  );
}

function DotIndicator({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dotContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable>
        <View style={styles.arrowCircle}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const [activeEventIndex, setActiveEventIndex] = useState(0);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const fullName = session?.user?.name ?? "User";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveEventIndex(index);
    },
    [],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#10101F", "#0A0A1A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <GlassCard style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
          </GlassCard>
        </View>

        <View style={styles.carouselSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleCarouselScroll}
          >
            {SIGNED_UP_EVENTS.map((event, index) => (
              <View key={event.id} style={styles.carouselPage}>
                <Pressable style={styles.carouselCard}>
                  <LinearGradient
                    colors={
                      CAROUSEL_GRADIENTS[index % CAROUSEL_GRADIENTS.length]!
                    }
                    style={styles.carouselGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View
                      style={[styles.decorCircle, { top: -30, right: 40 }]}
                    />
                    <View
                      style={[
                        styles.decorCircle,
                        {
                          width: 120,
                          height: 120,
                          borderRadius: 60,
                          bottom: -40,
                          right: -20,
                          opacity: 0.08,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.decorCircle,
                        {
                          width: 60,
                          height: 60,
                          borderRadius: 30,
                          top: 20,
                          right: -10,
                          opacity: 0.12,
                        },
                      ]}
                    />
                    <View style={styles.carouselContent}>
                      <Text style={styles.carouselLabel}>
                        Event you signed up to
                      </Text>
                      <View style={styles.carouselBottom}>
                        <Text style={styles.carouselTitle}>{event.title}</Text>
                        <Text style={styles.carouselMeta}>
                          {formatDate(event.date)} · {event.location}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <DotIndicator
            count={SIGNED_UP_EVENTS.length}
            activeIndex={activeEventIndex}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Connect Back With These People" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {PEOPLE_TO_CONNECT.map((person, index) => (
              <Pressable key={person.id} style={styles.personCard}>
                <LinearGradient
                  colors={
                    AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]!
                  }
                  style={styles.personAvatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.personInitials}>
                    {getInitials(person.name)}
                  </Text>
                </LinearGradient>
                <Text style={styles.personName} numberOfLines={1}>
                  {person.name}
                </Text>
                <Text style={styles.personMetAt} numberOfLines={1}>
                  Met at {person.metAt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Events you may be interested in" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {SUGGESTED_EVENTS.map((event, index) => (
              <Pressable key={event.id} style={styles.suggestedCard}>
                <LinearGradient
                  colors={
                    SUGGESTED_GRADIENTS[index % SUGGESTED_GRADIENTS.length]!
                  }
                  style={styles.suggestedImage}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View
                    style={[
                      styles.decorCircle,
                      {
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        top: 15,
                        right: 15,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.decorCircle,
                      {
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        bottom: -20,
                        left: 20,
                        opacity: 0.06,
                      },
                    ]}
                  />
                </LinearGradient>
                <View style={styles.suggestedInfo}>
                  <Text style={styles.suggestedOrganiser}>
                    {event.organiserName}
                  </Text>
                  <Text style={styles.suggestedTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.suggestedDate}>
                    {formatDate(event.date)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  scrollView: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "400",
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  carouselSection: {
    marginBottom: 32,
  },
  carouselPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
  },
  carouselCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  carouselGradient: {
    height: 180,
    padding: 24,
    position: "relative",
    overflow: "hidden",
  },
  carouselContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  carouselLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.2,
  },
  carouselBottom: {
    gap: 4,
  },
  carouselTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  carouselMeta: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.6)",
  },
  decorCircle: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  dotInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },

  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: -1,
  },

  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  personCard: {
    alignItems: "center",
    width: 100,
    gap: 6,
  },
  personAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  personInitials: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  personName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  personMetAt: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.45)",
    textAlign: "center",
  },

  suggestedCard: {
    width: 180,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  suggestedImage: {
    height: 130,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  suggestedInfo: {
    padding: 14,
    gap: 3,
  },
  suggestedOrganiser: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.45)",
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  suggestedDate: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
});
