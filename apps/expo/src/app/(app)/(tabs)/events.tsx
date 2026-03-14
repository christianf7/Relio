import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FloatingOrbs from "~/components/FloatingOrbs";
import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

type FilterType = "All" | "Upcoming" | "This Week" | "My Events" | "Past";
const FILTERS: FilterType[] = [
  "All",
  "Upcoming",
  "This Week",
  "My Events",
  "Past",
];

const CARD_GRADIENTS: [string, string][] = [
  ["#2D1B69", "#11998E"],
  ["#4A1942", "#E04882"],
  ["#1A2980", "#26D0CE"],
  ["#2C3E50", "#FD746C"],
  ["#0F2027", "#2C5364"],
  ["#1A2980", "#4880E0"],
];

function formatEventDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function EventCard({
  event,
  index,
  onPress,
}: {
  event: {
    id: string;
    title: string;
    date: Date | string;
    location: string;
    bannerUrl: string | null;
    organisers: { id: string; name: string }[];
  };
  index: number;
  onPress: () => void;
}) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length]!;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        pressed && styles.eventCardPressed,
      ]}
    >
      {event.bannerUrl ? (
        <Image
          source={{ uri: event.bannerUrl }}
          style={styles.eventBannerImage}
        />
      ) : (
        <LinearGradient
          colors={gradient}
          style={styles.eventImageContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.eventImageDecor} />
          <View
            style={[
              styles.eventImageDecor,
              {
                width: 30,
                height: 30,
                borderRadius: 15,
                bottom: 8,
                right: 8,
                top: undefined,
                opacity: 0.15,
              },
            ]}
          />
        </LinearGradient>
      )}
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.eventMetaRow}>
          <Ionicons
            name="location-outline"
            size={13}
            color="rgba(255,255,255,0.4)"
          />
          <Text style={styles.eventLocation} numberOfLines={1}>
            {event.location}
          </Text>
        </View>
        <View style={styles.eventMetaRow}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color="rgba(255,255,255,0.4)"
          />
          <Text style={styles.eventDate}>
            {formatEventDate(event.date)}
          </Text>
        </View>
        {event.organisers.length > 0 && (
          <Text style={styles.eventOrganiser} numberOfLines={1}>
            by {event.organisers.map((o) => o.name).join(", ")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");

  const {
    data: events,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery(trpc.event.getEvents.queryOptions());

  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let filtered = [...events];

    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.location.toLowerCase().includes(term),
      );
    }

    const now = new Date();

    switch (activeFilter) {
      case "Upcoming":
        filtered = filtered
          .filter((e) => new Date(e.date) > now)
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
        break;
      case "This Week": {
        const weekFromNow = new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        );
        filtered = filtered
          .filter((e) => {
            const d = new Date(e.date);
            return d > now && d < weekFromNow;
          })
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
        break;
      }
      case "My Events":
        filtered = filtered.filter(
          (e) =>
            e.organisers.some((o) => o.id === userId) ||
            e.participants.some((p) => p.id === userId),
        );
        break;
      case "Past":
        filtered = filtered
          .filter((e) => new Date(e.date) < now)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );
        break;
    }

    return filtered;
  }, [events, search, activeFilter, userId]);

  const renderEmptyList = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6C3CE0" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color="rgba(255,255,255,0.2)"
          />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Ionicons
          name="calendar-outline"
          size={48}
          color="rgba(255,255,255,0.15)"
        />
        <Text style={styles.emptyTitle}>No events found</Text>
        <Text style={styles.emptySubtitle}>
          {search || activeFilter !== "All"
            ? "Try a different search or filter"
            : "Create your first event to get started"}
        </Text>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <GlassCard style={styles.searchBar}>
        <Ionicons
          name="search"
          size={18}
          color="rgba(255, 255, 255, 0.35)"
        />
        <TextInput
          placeholder="Search events..."
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color="rgba(255, 255, 255, 0.3)"
            />
          </Pressable>
        )}
      </GlassCard>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTERS.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setActiveFilter(filter)}
            style={[
              styles.filterChip,
              activeFilter === filter && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <FloatingOrbs opacity={0.5} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.pageTitle}>Events</Text>
        <Pressable
          onPress={() => router.push("/(app)/create-event" as any)}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <LinearGradient
            colors={["#6C3CE0", "#9B59E0"]}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      <FlatList
        data={filteredEvents}
        renderItem={({ item, index }) => (
          <EventCard
            event={item}
            index={index}
            onPress={() => router.push(`/(app)/event/${item.id}` as any)}
          />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={[
          styles.listContent,
          filteredEvents.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6C3CE0"
          />
        }
      />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  addButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  addButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  listHeader: {
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 8,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
    padding: 0,
  },

  filterScroll: {
    paddingHorizontal: 0,
    gap: 10,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
  },
  filterTextActive: {
    color: "#0A0A1A",
  },

  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  eventCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 14,
  },
  eventCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  eventImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  eventBannerImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    resizeMode: "cover",
  },
  eventImageDecor: {
    position: "absolute",
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    top: -10,
    right: -10,
  },
  eventInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eventLocation: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.5)",
    flex: 1,
  },
  eventDate: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.5)",
  },
  eventOrganiser: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.3)",
    marginTop: 2,
  },

  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.3)",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },
});
