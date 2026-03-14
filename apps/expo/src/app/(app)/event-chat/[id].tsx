import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
  ["#4A1942", "#E04882"],
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getGradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}

function formatMessageTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ${time}`;
}

type EventMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date | string;
  sender: {
    id: string;
    name: string;
    displayName: string | null;
    image: string | null;
  };
};

function GroupMessageBubble({
  message,
  isMine,
  isOrganiser,
  showSender,
  onDelete,
}: {
  message: EventMessage;
  isMine: boolean;
  isOrganiser: boolean;
  showSender: boolean;
  onDelete: () => void;
}) {
  const canDelete = isMine || isOrganiser;
  const senderName = message.sender.displayName ?? message.sender.name;
  const gradient = getGradientForId(message.sender.id);

  const handleLongPress = () => {
    if (!canDelete) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Delete Message", "Cancel"],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) onDelete();
        },
      );
    } else {
      Alert.alert("Message", undefined, [
        { text: "Delete Message", style: "destructive", onPress: onDelete },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      style={[
        styles.groupBubbleContainer,
        isMine
          ? styles.groupBubbleContainerRight
          : styles.groupBubbleContainerLeft,
      ]}
    >
      {!isMine && showSender && (
        <View style={styles.senderRow}>
          {message.sender.image ? (
            <Image
              source={{ uri: message.sender.image }}
              style={styles.senderAvatar}
            />
          ) : (
            <LinearGradient
              colors={gradient}
              style={styles.senderAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.senderAvatarInitials}>
                {getInitials(senderName)}
              </Text>
            </LinearGradient>
          )}
          <Text style={styles.senderName}>{senderName}</Text>
        </View>
      )}

      {isMine ? (
        <LinearGradient
          colors={["#6C3CE0", "#8B5CF6"]}
          style={[styles.groupBubble, styles.groupBubbleMine]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.bubbleTextMine}>{message.content}</Text>
          <Text style={styles.bubbleTimeMine}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.groupBubble,
            styles.groupBubbleTheirs,
            !showSender && styles.groupBubbleTheirsContinuation,
          ]}
        >
          <Text style={styles.bubbleTextTheirs}>{message.content}</Text>
          <Text style={styles.bubbleTimeTheirs}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function EventChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;

  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { data: event, isLoading: eventLoading } = useQuery(
    trpc.event.getById.queryOptions({ id }),
  );

  const { data: messages, isLoading: messagesLoading } = useQuery({
    ...trpc.message.getEventMessages.queryOptions({ eventId: id, take: 100 }),
    refetchInterval: 3000,
  });

  const sendMutation = useMutation(
    trpc.message.sendEventMessage.mutationOptions(),
  );
  const deleteMutation = useMutation(
    trpc.message.deleteMessageById.mutationOptions(),
  );

  const isOrganiser = useMemo(
    () => event?.organisers.some((o) => o.id === myId) ?? false,
    [event, myId],
  );

  const participantCount =
    (event?.participants.length ?? 0) + (event?.organisers.length ?? 0);

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed || sendMutation.isPending) return;

    setMessageText("");
    sendMutation.mutate(
      { eventId: id, content: trimmed },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [["message", "getEventMessages"]],
          });
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        onError: (err) => {
          setMessageText(trimmed);
          Alert.alert("Error", err.message || "Failed to send message.");
        },
      },
    );
  }, [messageText, id, sendMutation, queryClient]);

  const handleDelete = useCallback(
    (messageId: string) => {
      Alert.alert(
        "Delete Message",
        "This message will be permanently deleted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              deleteMutation.mutate(
                { messageId },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({
                      queryKey: [["message", "getEventMessages"]],
                    });
                  },
                },
              ),
          },
        ],
      );
    },
    [deleteMutation, queryClient],
  );

  const isLoading = eventLoading || messagesLoading;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={styles.headerInfo}
          onPress={() => router.push(`/(app)/event/${id}` as any)}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event?.title ?? "Event Chat"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {participantCount} {participantCount === 1 ? "member" : "members"}
            {isOrganiser && " · Organiser"}
          </Text>
        </Pressable>

        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C3CE0" />
          </View>
        ) : !messages || messages.length === 0 ? (
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.emptyChat}
          >
            <View style={styles.emptyIconBg}>
              <Ionicons
                name="chatbubbles-outline"
                size={36}
                color="rgba(108, 60, 224, 0.6)"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {event?.title ?? "Event"} Chat
            </Text>
            <Text style={styles.emptyHint}>
              Be the first to send a message in this event
            </Text>
          </Animated.View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages as EventMessage[]}
            renderItem={({ item, index }) => {
              const prevMsg = index > 0
                ? (messages as EventMessage[])[index - 1]
                : null;
              const showSender =
                !prevMsg || prevMsg.senderId !== item.senderId;

              return (
                <GroupMessageBubble
                  message={item}
                  isMine={item.senderId === myId}
                  isOrganiser={isOrganiser}
                  showSender={showSender}
                  onDelete={() => handleDelete(item.id)}
                />
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: 8 },
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        )}

        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message the group..."
              placeholderTextColor="rgba(255, 255, 255, 0.25)"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={4000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim() || sendMutation.isPending}
              style={({ pressed }) => [
                styles.sendButton,
                (!messageText.trim() || sendMutation.isPending) &&
                  styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(10, 10, 26, 0.95)",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.4)",
  },

  keyboardView: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyHint: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.35)",
    textAlign: "center",
  },

  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  groupBubbleContainer: {
    marginBottom: 4,
    maxWidth: "82%",
  },
  groupBubbleContainerRight: {
    alignSelf: "flex-end",
  },
  groupBubbleContainerLeft: {
    alignSelf: "flex-start",
  },

  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    marginTop: 8,
  },
  senderAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  senderAvatarInitials: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
  },

  groupBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupBubbleMine: {
    borderBottomRightRadius: 6,
  },
  groupBubbleTheirs: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderBottomLeftRadius: 6,
    borderTopLeftRadius: 20,
  },
  groupBubbleTheirsContinuation: {
    borderTopLeftRadius: 6,
  },

  bubbleTextMine: {
    fontSize: 15,
    fontWeight: "400",
    color: "#FFFFFF",
    lineHeight: 21,
  },
  bubbleTimeMine: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTextTheirs: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 21,
  },
  bubbleTimeTheirs: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.3)",
    marginTop: 4,
    alignSelf: "flex-end",
  },

  inputBar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(10, 10, 26, 0.95)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    color: "#FFFFFF",
    maxHeight: 100,
    paddingVertical: 6,
    padding: 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C3CE0",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(108, 60, 224, 0.3)",
  },
  sendButtonPressed: {
    backgroundColor: "#5A2FCB",
  },
});
