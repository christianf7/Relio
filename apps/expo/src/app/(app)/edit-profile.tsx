import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

type EnrolledUnit = { code: string; university: string };

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

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const { data: profile, isLoading } = useQuery(
    trpc.user.getMe.queryOptions(),
  );

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [units, setUnits] = useState<EnrolledUnit[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");

  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitUni, setNewUnitUni] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? profile.name ?? "");
      setBio(profile.bio ?? "");
      setImageUrl(profile.image ?? null);
      const parsed = Array.isArray(profile.enrolledUnits)
        ? (profile.enrolledUnits as EnrolledUnit[])
        : [];
      setUnits(parsed);
      const socials = profile.socials as {
        githubUrl?: string;
        linkedInUrl?: string;
        discordUrl?: string;
      } | null;
      setGithubUrl(socials?.githubUrl ?? "");
      setLinkedInUrl(socials?.linkedInUrl ?? "");
      setDiscordUrl(socials?.discordUrl ?? "");
    }
  }, [profile]);

  const updateMutation = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["user", "getMe"]] });
        router.back();
      },
      onError: (err) => {
        Alert.alert("Error", err.message);
      },
    }),
  );

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || null,
      image: imageUrl,
      enrolledUnits: units,
      socials: {
        githubUrl: githubUrl.trim() || null,
        linkedInUrl: linkedInUrl.trim() || null,
        discordUrl: discordUrl.trim() || null,
      },
    });
  }, [displayName, bio, imageUrl, units, githubUrl, linkedInUrl, discordUrl, updateMutation]);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploading(true);

    try {
      const filename = asset.uri.split("/").pop() ?? "photo.jpg";
      const ext = filename.split(".").pop() ?? "jpg";
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      const cookies = authClient.getCookie();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (cookies) headers["Cookie"] = cookies;

      const res = await fetch(`${getBaseUrl()}/api/upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({ filename, contentType }),
      });

      if (!res.ok) throw new Error("Failed to get upload URL");

      const { uploadUrl, publicUrl } = (await res.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const imageResponse = await fetch(asset.uri);
      const blob = await imageResponse.blob();

      await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });

      setImageUrl(publicUrl);
    } catch {
      Alert.alert("Upload Failed", "Could not upload your image. Try again.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const addUnit = useCallback(() => {
    const code = newUnitCode.trim().toUpperCase();
    const uni = newUnitUni.trim();
    if (!code || !uni) {
      Alert.alert("Missing Info", "Enter both a unit code and university.");
      return;
    }
    if (units.some((u) => u.code === code)) {
      Alert.alert("Duplicate", "This unit is already added.");
      return;
    }
    setUnits((prev) => [...prev, { code, university: uni }]);
    setNewUnitCode("");
    setNewUnitUni("");
  }, [newUnitCode, newUnitUni, units]);

  const removeUnit = useCallback((code: string) => {
    setUnits((prev) => prev.filter((u) => u.code !== code));
  }, []);

  const displayNameVal = displayName || profile?.name || session?.user?.name || "User";

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={updateMutation.isPending}
          hitSlop={12}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color="#6C3CE0" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={handlePickImage} disabled={isUploading}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={["#6C3CE0", "#E04882"]}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>
                  {getInitials(displayNameVal)}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.cameraOverlay}>
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
        </View>

        {/* Display Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Display Name</Text>
          <GlassCard style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
            />
          </GlassCard>
        </View>

        {/* Bio */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Bio</Text>
          <GlassCard style={styles.inputCard}>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </GlassCard>
        </View>

        {/* Enrolled Units */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Enrolled Units</Text>
          {units.length > 0 ? (
            <View style={styles.chipContainer}>
              {units.map((unit) => (
                <View key={unit.code} style={styles.unitChip}>
                  <View style={styles.unitChipContent}>
                    <Text style={styles.unitChipCode}>{unit.code}</Text>
                    <Text style={styles.unitChipUni}>{unit.university}</Text>
                  </View>
                  <Pressable
                    onPress={() => removeUnit(unit.code)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <GlassCard style={styles.addUnitCard}>
            <TextInput
              style={styles.addUnitInput}
              value={newUnitCode}
              onChangeText={setNewUnitCode}
              placeholder="Unit code (e.g. FIT2099)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.addUnitDivider} />
            <TextInput
              style={styles.addUnitInput}
              value={newUnitUni}
              onChangeText={setNewUnitUni}
              placeholder="University"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
            />
            <Pressable onPress={addUnit} style={styles.addUnitButton}>
              <Ionicons name="add-circle" size={28} color="#6C3CE0" />
            </Pressable>
          </GlassCard>
        </View>

        {/* Socials */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Socials</Text>
          <GlassCard style={styles.socialInputCard}>
            <Ionicons name="logo-github" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.socialInput}
              value={githubUrl}
              onChangeText={setGithubUrl}
              placeholder="GitHub URL"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </GlassCard>
          <GlassCard style={styles.socialInputCard}>
            <Ionicons name="logo-linkedin" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.socialInput}
              value={linkedInUrl}
              onChangeText={setLinkedInUrl}
              placeholder="LinkedIn URL"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </GlassCard>
          <GlassCard style={styles.socialInputCard}>
            <Ionicons name="logo-discord" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.socialInput}
              value={discordUrl}
              onChangeText={setDiscordUrl}
              placeholder="Discord username"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </GlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(108, 60, 224, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0A0A1A",
  },

  fieldGroup: {
    marginBottom: 24,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inputCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "400",
    padding: 0,
  },
  multilineInput: {
    minHeight: 72,
    lineHeight: 22,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  unitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unitChipContent: {
    gap: 1,
  },
  unitChipCode: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    letterSpacing: 0.3,
  },
  unitChipUni: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.4)",
  },
  addUnitCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addUnitInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
    padding: 0,
  },
  addUnitDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  addUnitButton: {
    padding: 2,
  },

  socialInputCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  socialInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    padding: 0,
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
