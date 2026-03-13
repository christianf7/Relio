import { useState } from "react";
import {
  Alert,
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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const dateParts = dateStr.split("/");
  if (dateParts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = dateParts;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2024 || year > 2100) return null;

  const timeParts = timeStr.split(":");
  if (timeParts.length !== 2) return null;

  const hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  const date = new Date(year, month - 1, day, hours, minutes);
  if (isNaN(date.getTime())) return null;

  return date;
}

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={14} color="rgba(255,255,255,0.4)" />
        <Text style={styles.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation(trpc.event.create.mutationOptions());

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert("Missing Field", "Please enter an event title.");
      return;
    }
    if (!date.trim()) {
      Alert.alert("Missing Field", "Please enter a date.");
      return;
    }
    if (!time.trim()) {
      Alert.alert("Missing Field", "Please enter a time.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Missing Field", "Please enter a location.");
      return;
    }

    const parsedDate = parseDateTime(date, time);
    if (!parsedDate) {
      Alert.alert(
        "Invalid Date",
        "Please check the date (DD/MM/YYYY) and time (HH:MM) format.",
      );
      return;
    }

    createMutation.mutate(
      {
        title: title.trim(),
        date: parsedDate.toISOString(),
        location: location.trim(),
        content: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          router.back();
        },
        onError: (err) => {
          Alert.alert(
            "Failed to Create Event",
            err.message || "Something went wrong. Please try again.",
          );
        },
      },
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>New Event</Text>
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
          <FormField label="Event Title" icon="text-outline">
            <TextInput
              style={styles.input}
              placeholder="What's your event called?"
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="next"
              maxLength={100}
            />
          </FormField>

          <View style={styles.dateTimeRow}>
            <View style={styles.dateField}>
              <FormField label="Date" icon="calendar-outline">
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  maxLength={10}
                />
              </FormField>
            </View>
            <View style={styles.timeField}>
              <FormField label="Time" icon="time-outline">
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  maxLength={5}
                />
              </FormField>
            </View>
          </View>

          <FormField label="Location" icon="location-outline">
            <TextInput
              style={styles.input}
              placeholder="Where is it happening?"
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
              value={location}
              onChangeText={setLocation}
              returnKeyType="next"
              maxLength={200}
            />
          </FormField>

          <FormField label="Description" icon="document-text-outline">
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
          </FormField>

          <Pressable
            onPress={handleCreate}
            disabled={createMutation.isPending}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.createButtonPressed,
              createMutation.isPending && styles.createButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                createMutation.isPending
                  ? ["#4A2D8A", "#8A3D6A"]
                  : ["#6C3CE0", "#E04882"]
              }
              style={styles.createButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.createButtonText}>
                {createMutation.isPending ? "Creating..." : "Create Event"}
              </Text>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 20,
  },

  fieldGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 15,
  },

  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  timeField: {
    flex: 0.6,
  },

  createButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  createButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
