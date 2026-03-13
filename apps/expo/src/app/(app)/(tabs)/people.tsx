import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
];

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type ConnectionItem = {
  id: string;
  name: string;
  displayName: string | null;
  image: string | null;
  connectedAt: string | Date;
};

type PendingRequest = {
  id: string;
  createdAt: string | Date;
  sender: {
    id: string;
    name: string;
    displayName: string | null;
    image: string | null;
  };
};

function ConnectionCard({
  item,
  index,
  onPress,
}: {
  item: ConnectionItem;
  index: number;
  onPress: () => void;
}) {
  const name = item.displayName ?? item.name;
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]!;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.connectionCard,
        pressed && styles.connectionCardPressed,
      ]}
      onPress={onPress}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.connectionAvatar} />
      ) : (
        <LinearGradient
          colors={gradient}
          style={styles.connectionAvatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.connectionInitials}>{getInitials(name)}</Text>
        </LinearGradient>
      )}
      <View style={styles.connectionInfo}>
        <Text style={styles.connectionName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.connectionTime}>
        {timeAgo(item.connectedAt)}
      </Text>
    </Pressable>
  );
}

function RequestCard({
  request,
  onAccept,
  onDecline,
  onPress,
  isAccepting,
  isDeclining,
}: {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
  isAccepting: boolean;
  isDeclining: boolean;
}) {
  const name = request.sender.displayName ?? request.sender.name;

  return (
    <View style={styles.requestCard}>
      <Pressable
        style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 12 }}
        onPress={onPress}
      >
        {request.sender.image ? (
          <Image
            source={{ uri: request.sender.image }}
            style={styles.requestAvatar}
          />
        ) : (
          <LinearGradient
            colors={["#6C3CE0", "#E04882"]}
            style={styles.requestAvatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.requestInitials}>{getInitials(name)}</Text>
          </LinearGradient>
        )}
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </Pressable>
      <View style={styles.requestActions}>
        <Pressable
          onPress={onAccept}
          disabled={isAccepting || isDeclining}
          style={({ pressed }) => [
            styles.acceptButton,
            pressed && styles.acceptButtonPressed,
          ]}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          )}
        </Pressable>
        <Pressable
          onPress={onDecline}
          disabled={isAccepting || isDeclining}
          style={({ pressed }) => [
            styles.declineButton,
            pressed && styles.declineButtonPressed,
          ]}
        >
          {isDeclining ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
          ) : (
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const {
    data: connections,
    isLoading: connectionsLoading,
    refetch: refetchConnections,
    isRefetching: isRefetchingConnections,
  } = useQuery(trpc.connection.getConnections.queryOptions());

  const {
    data: incomingRequests,
    refetch: refetchRequests,
    isRefetching: isRefetchingRequests,
  } = useQuery(trpc.connection.getIncomingRequests.queryOptions());

  const acceptMutation = useMutation(
    trpc.connection.acceptConnection.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [["connection", "getConnections"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["connection", "getIncomingRequests"]],
        });
        setAcceptingId(null);
      },
      onError: () => setAcceptingId(null),
    }),
  );

  const declineMutation = useMutation(
    trpc.connection.declineConnection.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [["connection", "getIncomingRequests"]],
        });
        setDecliningId(null);
      },
      onError: () => setDecliningId(null),
    }),
  );

  const filteredConnections = useMemo(() => {
    if (!connections) return [];
    if (!search.trim()) return connections;
    const term = search.toLowerCase();
    return connections.filter(
      (c: ConnectionItem) =>
        c.name.toLowerCase().includes(term) ||
        (c.displayName?.toLowerCase().includes(term) ?? false),
    );
  }, [connections, search]);

  const handleRefresh = useCallback(() => {
    refetchConnections();
    refetchRequests();
  }, [refetchConnections, refetchRequests]);

  const pendingRequests = (incomingRequests ?? []) as PendingRequest[];
  const isRefetching = isRefetchingConnections || isRefetchingRequests;

  const renderListHeader = () => (
    <View>
      {/* Search */}
      <GlassCard style={styles.searchBar}>
        <Ionicons
          name="search"
          size={18}
          color="rgba(255, 255, 255, 0.35)"
        />
        <TextInput
          placeholder="Search connections..."
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color="rgba(255, 255, 255, 0.3)"
            />
          </Pressable>
        ) : null}
      </GlassCard>

      {/* Find More People */}
      <Pressable
        onPress={() => router.push("/(app)/find-people" as any)}
        style={({ pressed }) => [
          styles.findMoreCard,
          pressed && styles.findMoreCardPressed,
        ]}
      >
        <LinearGradient
          colors={["#6C3CE0", "#9B59E0"]}
          style={styles.findMoreGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.findMoreContent}>
            <View style={styles.findMoreLeft}>
              <Ionicons name="person-add" size={22} color="#FFFFFF" />
              <View>
                <Text style={styles.findMoreTitle}>Find More People</Text>
                <Text style={styles.findMoreSub}>
                  Discover and connect with others
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </View>
        </LinearGradient>
      </Pressable>

      {/* Pending Requests */}
      {pendingRequests.length > 0 ? (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionLabel}>
            Pending Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              isAccepting={acceptingId === req.id}
              isDeclining={decliningId === req.id}
              onPress={() =>
                router.push(`/(app)/user/${req.sender.id}` as any)
              }
              onAccept={() => {
                setAcceptingId(req.id);
                acceptMutation.mutate({ requestId: req.id });
              }}
              onDecline={() => {
                setDecliningId(req.id);
                declineMutation.mutate({ requestId: req.id });
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Connections header */}
      {(filteredConnections.length > 0 || connectionsLoading) ? (
        <Text style={styles.sectionLabel}>
          Connections
          {filteredConnections.length > 0
            ? ` (${filteredConnections.length})`
            : ""}
        </Text>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (connectionsLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#6C3CE0" />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="people-outline"
          size={52}
          color="rgba(255,255,255,0.12)"
        />
        <Text style={styles.emptyTitle}>No connections yet</Text>
        <Text style={styles.emptySubtitle}>
          {search
            ? "No one matches your search"
            : "Scan a QR code or find people to connect"}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.pageTitle}>People</Text>
      </View>

      <FlatList
        data={filteredConnections}
        renderItem={({ item, index }) => (
          <ConnectionCard
            item={item as ConnectionItem}
            index={index}
            onPress={() =>
              router.push(`/(app)/user/${(item as ConnectionItem).id}` as any)
            }
          />
        )}
        keyExtractor={(item) => (item as ConnectionItem).id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          filteredConnections.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
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
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
    padding: 0,
  },

  findMoreCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  findMoreCardPressed: {
    opacity: 0.85,
  },
  findMoreGradient: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  findMoreContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  findMoreLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  findMoreTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  findMoreSub: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },

  requestsSection: {
    marginBottom: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  requestInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C3CE0",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonPressed: {
    backgroundColor: "#5A2FCB",
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  declineButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },

  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 14,
  },
  connectionCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  connectionInitials: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  connectionInfo: {
    flex: 1,
    gap: 2,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  connectionTime: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.3)",
  },

  emptyContainer: {
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

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});
