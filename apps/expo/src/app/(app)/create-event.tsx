import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
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

function FormSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.formSection}>
      <View style={styles.sectionLabelRow}>
        <Ionicons name={icon} size={15} color="rgba(255,255,255,0.45)" />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </GlassCard>
  );
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!params.id;

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { data: existingEvent, isLoading: isLoadingEvent } = useQuery({
    ...trpc.event.getById.queryOptions({ id: params.id ?? "" }),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingEvent) {
      setTitle(existingEvent.title);
      const d = new Date(existingEvent.date);
      setEventDate(d);
      setEventTime(d);
      setLocation(existingEvent.location);
      setDescription(existingEvent.content ?? "");
      if (existingEvent.bannerUrl) {
        setBannerUri(existingEvent.bannerUrl);
        setBannerUrl(existingEvent.bannerUrl);
      }
    }
  }, [existingEvent]);

  const createMutation = useMutation(trpc.event.create.mutationOptions());
  const updateMutation = useMutation(trpc.event.updateById.mutationOptions());
  const isPending = createMutation.isPending || updateMutation.isPending;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add an event banner.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setBannerUri(asset.uri);
      await uploadImage(asset.uri, asset.mimeType ?? "image/jpeg");
    }
  };

  const uploadImage = async (uri: string, mimeType: string) => {
    setIsUploading(true);
    try {
      const filename = uri.split("/").pop() ?? "banner.jpg";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const cookies = authClient.getCookie();
      if (cookies) {
        headers.Cookie = cookies;
      }
      const res = await fetch(`${getBaseUrl()}/api/upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({ filename, contentType: mimeType }),
      });

      if (!res.ok) throw new Error("Failed to get upload URL");

      const { uploadUrl, publicUrl } = (await res.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const imageRes = await fetch(uri);
      const blob = await imageRes.blob();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image");

      setBannerUrl(publicUrl);
    } catch (err) {
      Alert.alert("Upload Failed", "Could not upload the banner image.");
      setBannerUri(null);
      setBannerUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const buildDate = (): Date => {
    const combined = new Date(eventDate);
    combined.setHours(eventTime.getHours(), eventTime.getMinutes(), 0, 0);
    return combined;
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Missing Field", "Please enter an event title.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Missing Field", "Please enter a location.");
      return;
    }

    const finalDate = buildDate();

    if (isEditing && params.id) {
      updateMutation.mutate(
        {
          id: params.id,
          data: {
            title: title.trim(),
            date: finalDate.toISOString(),
            location: location.trim(),
            content: description.trim() || undefined,
            bannerUrl: bannerUrl ?? undefined,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries();
            router.back();
          },
          onError: (err) => {
            Alert.alert("Update Failed", err.message || "Something went wrong.");
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          title: title.trim(),
          date: finalDate.toISOString(),
          location: location.trim(),
          content: description.trim() || undefined,
          bannerUrl: bannerUrl ?? undefined,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries();
            router.back();
          },
          onError: (err) => {
            Alert.alert("Creation Failed", err.message || "Something went wrong.");
          },
        },
      );
    }
  };

  const formatDisplayDate = (d: Date) =>
    d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatDisplayTime = (d: Date) =>
    d.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isEditing && isLoadingEvent) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#0E0B1F", "#0A0A1A", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Event" : "New Event"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={10}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={pickImage} style={styles.bannerPicker}>
            {bannerUri ? (
              <View style={styles.bannerPreview}>
                <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
                {isUploading && (
                  <View style={styles.bannerOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.bannerOverlayText}>Uploading...</Text>
                  </View>
                )}
                <View style={styles.bannerEditBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <LinearGradient
                colors={["#1A1530", "#120F24"]}
                style={styles.bannerPlaceholder}
              >
                <View style={styles.bannerIconCircle}>
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color="rgba(255,255,255,0.4)"
                  />
                </View>
                <Text style={styles.bannerPlaceholderText}>
                  Add Event Banner
                </Text>
                <Text style={styles.bannerPlaceholderHint}>
                  Tap to choose a photo
                </Text>
              </LinearGradient>
            )}
          </Pressable>

          <FormSection label="Event Title" icon="text-outline">
            <TextInput
              style={styles.input}
              placeholder="What's your event called?"
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
              maxLength={100}
            />
          </FormSection>

          <FormSection label="Date & Time" icon="calendar-outline">
            <View style={styles.dateTimeContainer}>
              <Pressable
                style={styles.dateTimeButton}
                onPress={() => {
                  setShowDatePicker((prev) => !prev);
                  setShowTimePicker(false);
                }}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color="#6C3CE0"
                  style={styles.dateTimeIcon}
                />
                <Text style={styles.dateTimeValue}>
                  {formatDisplayDate(eventDate)}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons
                  name={showDatePicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="rgba(255,255,255,0.3)"
                />
              </Pressable>

              <View style={styles.dateTimeDivider} />

              <Pressable
                style={styles.dateTimeButton}
                onPress={() => {
                  setShowTimePicker((prev) => !prev);
                  setShowDatePicker(false);
                }}
              >
                <Ionicons
                  name="time"
                  size={16}
                  color="#6C3CE0"
                  style={styles.dateTimeIcon}
                />
                <Text style={styles.dateTimeValue}>
                  {formatDisplayTime(eventTime)}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons
                  name={showTimePicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="rgba(255,255,255,0.3)"
                />
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, selected) => {
                  if (Platform.OS === "android") setShowDatePicker(false);
                  if (selected) setEventDate(selected);
                }}
                minimumDate={new Date()}
                themeVariant="dark"
                accentColor="#6C3CE0"
                style={styles.picker}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={eventTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  if (Platform.OS === "android") setShowTimePicker(false);
                  if (selected) setEventTime(selected);
                }}
                themeVariant="dark"
                accentColor="#6C3CE0"
                style={styles.picker}
              />
            )}
          </FormSection>

          <FormSection label="Location" icon="location-outline">
            <TextInput
              style={styles.input}
              placeholder="Where is it happening?"
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
              value={location}
              onChangeText={setLocation}
              returnKeyType="next"
              maxLength={200}
            />
          </FormSection>

          <FormSection label="Description" icon="document-text-outline">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people what this event is about..."
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={2000}
            />
          </FormSection>

          <Pressable
            onPress={handleSubmit}
            disabled={isPending || isUploading}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              (isPending || isUploading) && styles.submitButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                isPending || isUploading
                  ? ["#3A2570", "#6A2D5A"]
                  : ["#6C3CE0", "#E04882"]
              }
              style={styles.submitButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditing ? "Save Changes" : "Create Event"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },

  bannerPicker: {
    borderRadius: 20,
    overflow: "hidden",
  },
  bannerPlaceholder: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderStyle: "dashed",
    gap: 8,
  },
  bannerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(108, 60, 224, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  bannerPlaceholderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.6)",
  },
  bannerPlaceholderHint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.3)",
  },
  bannerPreview: {
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  bannerOverlayText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  bannerEditBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  formSection: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },

  dateTimeContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateTimeIcon: {
    marginRight: 10,
  },
  dateTimeValue: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dateTimeDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginHorizontal: 14,
  },
  picker: {
    marginTop: 4,
  },

  submitButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});
