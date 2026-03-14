import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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

type Message = {
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

function MessageBubble({
  message,
  isMine,
  onDelete,
}: {
  message: Message;
  isMine: boolean;
  onDelete: () => void;
}) {
  const handleLongPress = () => {
    if (!isMine) return;

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
        styles.bubbleContainer,
        isMine ? styles.bubbleContainerRight : styles.bubbleContainerLeft,
      ]}
    >
      {isMine ? (
        <LinearGradient
          colors={["#6C3CE0", "#8B5CF6"]}
          style={[styles.bubble, styles.bubbleMine]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.bubbleTextMine}>{message.content}</Text>
          <Text style={styles.bubbleTimeMine}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleTheirs]}>
          <Text style={styles.bubbleTextTheirs}>{message.content}</Text>
          <Text style={styles.bubbleTimeTheirs}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function useKeyboardHeight() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height - insets.bottom, {
        duration: Platform.OS === "ios" ? 250 : 150,
      });
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.value = withTiming(0, {
        duration: Platform.OS === "ios" ? 250 : 150,
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  return keyboardHeight;
}

export default function DirectMessageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;

  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const keyboardHeight = useKeyboardHeight();

  const animatedContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value,
  }));

  const { data: otherUser, isLoading: userLoading } = useQuery(
    trpc.user.getById.queryOptions({ id }),
  );

  const {
    data: messages,
    isLoading: messagesLoading,
  } = useQuery({
    ...trpc.message.getDirectMessages.queryOptions({ userId: id, take: 100 }),
    refetchInterval: 3000,
  });

  const sendMutation = useMutation(
    trpc.message.sendDirectMessage.mutationOptions(),
  );
  const deleteMutation = useMutation(
    trpc.message.deleteMessageById.mutationOptions(),
  );
  const markReadMutation = useMutation(
    trpc.message.markConversationRead.mutationOptions(),
  );

  const prevMessageCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (id) {
      markReadMutation.mutate(
        { userId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: [["message", "getConversations"]],
            });
            queryClient.invalidateQueries({
              queryKey: [["message", "getUnreadDmCount"]],
            });
            queryClient.invalidateQueries({
              queryKey: [["user", "getMe"]],
            });
          },
        },
      );
    }
  }, [id, messages?.length]);

  useEffect(() => {
    if (!messages) return;
    const count = messages.length;
    if (prevMessageCountRef.current !== null && count > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1] as Message | undefined;
      if (lastMsg && lastMsg.senderId !== myId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    prevMessageCountRef.current = count;
  }, [messages?.length]);

  useEffect(() => {
    if (keyboardHeight.value > 0 && messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [keyboardHeight.value]);

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed || sendMutation.isPending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessageText("");
    sendMutation.mutate(
      { receiverId: id, content: trimmed },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [["message", "getDirectMessages"]],
          });
          queryClient.invalidateQueries({
            queryKey: [["message", "getConversations"]],
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
                      queryKey: [["message", "getDirectMessages"]],
                    });
                    queryClient.invalidateQueries({
                      queryKey: [["message", "getConversations"]],
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

  const otherName =
    otherUser?.displayName ?? otherUser?.name ?? "User";
  const gradient = getGradientForId(id);
  const isLoading = userLoading || messagesLoading;

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
          style={styles.headerProfile}
          onPress={() => router.push(`/(app)/user/${id}` as any)}
        >
          {otherUser?.image ? (
            <Image
              source={{ uri: otherUser.image }}
              style={styles.headerAvatar}
            />
          ) : (
            <LinearGradient
              colors={gradient}
              style={styles.headerAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.headerAvatarInitials}>
                {getInitials(otherName)}
              </Text>
            </LinearGradient>
          )}
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherName}
            </Text>
            {otherUser?.connectionStatus === "connected" && (
              <Text style={styles.headerStatus}>Connected</Text>
            )}
          </View>
        </Pressable>

        <View style={{ width: 44 }} />
      </View>

      <Animated.View style={[{ flex: 1 }, animatedContainerStyle]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C3CE0" />
          </View>
        ) : !messages || messages.length === 0 ? (
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.emptyChat}
          >
            {otherUser?.image ? (
              <Image
                source={{ uri: otherUser.image }}
                style={styles.emptyAvatar}
              />
            ) : (
              <LinearGradient
                colors={gradient}
                style={styles.emptyAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.emptyAvatarInitials}>
                  {getInitials(otherName)}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.emptyName}>{otherName}</Text>
            <Text style={styles.emptyHint}>
              Send a message to start the conversation
            </Text>
          </Animated.View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages as Message[]}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.senderId === myId}
                onDelete={() => handleDelete(item.id)}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
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
              ref={inputRef}
              style={styles.textInput}
              placeholder="Message..."
              placeholderTextColor="rgba(255, 255, 255, 0.25)"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={4000}
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
      </Animated.View>
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
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerStatus: {
    fontSize: 12,
    fontWeight: "500",
    color: "#34D399",
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
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyAvatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyName: {
    fontSize: 20,
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
    paddingBottom: 8,
  },

  bubbleContainer: {
    marginBottom: 6,
    maxWidth: "80%",
  },
  bubbleContainerRight: {
    alignSelf: "flex-end",
  },
  bubbleContainerLeft: {
    alignSelf: "flex-start",
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderBottomLeftRadius: 6,
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
