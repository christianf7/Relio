import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import FloatingOrbs from "~/components/FloatingOrbs";
import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOTAL_STEPS = 2;

type EnrolledUnit = { code: string; university: string };
type UserRole = "attendee" | "organiser";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ProgressDots({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <View style={progressStyles.container}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            progressStyles.dot,
            i === currentStep && progressStyles.dotActive,
            i < currentStep && progressStyles.dotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#6C3CE0",
  },
  dotCompleted: {
    backgroundColor: "rgba(108, 60, 224, 0.5)",
  },
});

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const { data: profile } = useQuery(trpc.user.getMe.queryOptions());

  const [step, setStep] = useState(0);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [units, setUnits] = useState<EnrolledUnit[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitUni, setNewUnitUni] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const linkedInLocked = Boolean((profile as any)?.linkedInLocked);

  // Role selection
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? profile.name ?? "");
      setBio(profile.bio ?? "");
      setImageUrl(profile.image ?? null);
      setBannerUrl((profile as any).bannerUrl ?? null);
      const parsed = Array.isArray(profile.enrolledUnits)
        ? (profile.enrolledUnits as EnrolledUnit[])
        : [];
      setUnits(parsed);
      const socials = profile.socials as {
        githubUrl?: string;
        linkedInUrl?: string;
        discordUsername?: string;
      } | null;
      setGithubUrl(socials?.githubUrl ?? "");
      setLinkedInUrl(socials?.linkedInUrl ?? "");
      setDiscordUsername(socials?.discordUsername ?? "");
    }
  }, [profile]);

  const updateMutation = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  const completeMutation = useMutation(
    trpc.user.completeOnboarding.mutationOptions({
      onSuccess: async () => {
        if (selectedRole) {
          SecureStore.setItem("onboarding_role", selectedRole);
          SecureStore.setItem("onboarding_tour_pending", "true");
        }
        await queryClient.invalidateQueries({
          queryKey: [["user", "getMe"]],
        });
        router.replace("/(app)" as any);
      },
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  const animateToStep = useCallback(
    (nextStep: number) => {
      const direction = nextStep > step ? 1 : -1;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -direction * 30,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setStep(nextStep);
        slideAnim.setValue(direction * 30);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 60,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [step, fadeAnim, slideAnim],
  );

  const handleContinue = useCallback(() => {
    if (step === 0) {
      if (!displayName.trim()) {
        Alert.alert("Required", "Please enter your display name.");
        return;
      }
      updateMutation.mutate(
        {
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          image: imageUrl,
          bannerUrl,
          enrolledUnits: units,
          socials: {
            githubUrl: githubUrl.trim() || null,
            linkedInUrl: linkedInUrl.trim() || null,
            discordUsername: discordUsername.trim() || null,
          },
        },
        { onSuccess: () => animateToStep(1) },
      );
    }
  }, [
    step,
    displayName,
    bio,
    imageUrl,
    bannerUrl,
    units,
    githubUrl,
    linkedInUrl,
    discordUsername,
    updateMutation,
    animateToStep,
  ]);

  const handleGetStarted = useCallback(() => {
    if (!selectedRole) {
      Alert.alert("Select a role", "Please pick how you'll use Relio.");
      return;
    }
    completeMutation.mutate();
  }, [selectedRole, completeMutation]);

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

  const handlePickBanner = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsBannerUploading(true);

    try {
      const filename = asset.uri.split("/").pop() ?? "banner.jpg";
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
        body: JSON.stringify({ filename, contentType, folder: "banners" }),
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

      setBannerUrl(publicUrl);
    } catch {
      Alert.alert("Upload Failed", "Could not upload the banner image. Try again.");
    } finally {
      setIsBannerUploading(false);
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

  const displayNameVal =
    displayName || profile?.name || session?.user?.name || "User";

  const isBusy =
    updateMutation.isPending || completeMutation.isPending || isUploading || isBannerUploading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <LinearGradient
        colors={["#0A0A1A", "#1A0A2E", "#16213E", "#0A0A1A"]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <FloatingOrbs />

      <View style={[styles.topSection, { paddingTop: insets.top + 16 }]}>
        <Animated.View
          style={{
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
            alignItems: "center",
          }}
        >
          <Image
            source={{ uri: "https://relio-cdn.chrisfitz.dev/relio.png" }}
            style={styles.logoImage}
          />
          <Text style={styles.stepTitle}>
            {step === 0 ? "Set up your profile" : "How will you use Relio?"}
          </Text>
          <Text style={styles.stepSubtitle}>
            {step === 0
              ? "Tell people who you are"
              : "This helps us tailor your experience"}
          </Text>
        </Animated.View>
        <ProgressDots currentStep={step} totalSteps={TOTAL_STEPS} />
      </View>

      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {step === 0 ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Banner */}
            <Pressable onPress={handlePickBanner} style={styles.bannerPicker} disabled={isBannerUploading}>
              {bannerUrl ? (
                <View style={styles.bannerPreview}>
                  <Image source={{ uri: bannerUrl }} style={styles.bannerImage} />
                  {isBannerUploading && (
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
                  {isBannerUploading ? (
                    <>
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                      <Text style={styles.bannerPlaceholderText}>Uploading...</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.bannerIconCircle}>
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color="rgba(255,255,255,0.4)"
                        />
                      </View>
                      <Text style={styles.bannerPlaceholderText}>
                        Add Profile Banner
                      </Text>
                      <Text style={styles.bannerPlaceholderHint}>
                        Tap to choose a cover photo
                      </Text>
                    </>
                  )}
                </LinearGradient>
              )}
            </Pressable>

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
              <Text style={styles.avatarHint}>Tap to add a photo</Text>
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
              <Text style={styles.label}>Your Courses</Text>
              {units.length > 0 && (
                <View style={styles.chipContainer}>
                  {units.map((unit) => (
                    <View key={unit.code} style={styles.unitChip}>
                      <View style={styles.unitChipContent}>
                        <Text style={styles.unitChipCode}>{unit.code}</Text>
                        <Text style={styles.unitChipUni}>
                          {unit.university}
                        </Text>
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
              )}
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
              <Text style={styles.label}>Socials (optional)</Text>
              <GlassCard style={styles.socialInputCard}>
                <Ionicons
                  name="logo-github"
                  size={18}
                  color="rgba(255,255,255,0.5)"
                />
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
                <Ionicons
                  name="logo-discord"
                  size={18}
                  color="rgba(255,255,255,0.5)"
                />
                <TextInput
                  style={styles.socialInput}
                  value={discordUsername}
                  onChangeText={setDiscordUsername}
                  placeholder="Discord username"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </GlassCard>
              <GlassCard style={styles.socialInputCard}>
                <Ionicons
                  name="logo-linkedin"
                  size={18}
                  color={
                    linkedInLocked
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(255,255,255,0.5)"
                  }
                />
                <TextInput
                  style={[
                    styles.socialInput,
                    linkedInLocked && styles.socialInputDisabled,
                  ]}
                  value={linkedInUrl}
                  onChangeText={setLinkedInUrl}
                  placeholder="LinkedIn URL"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!linkedInLocked}
                />
              </GlassCard>
              {linkedInLocked ? (
                <Text style={styles.lockedHint}>
                  LinkedIn is managed by your OAuth login and can&apos;t be
                  edited.
                </Text>
              ) : null}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.roleContainer}>
            <Pressable
              onPress={() => setSelectedRole("attendee")}
              style={({ pressed }) => [
                styles.roleCardWrapper,
                pressed && styles.roleCardPressed,
              ]}
            >
              <LinearGradient
                colors={
                  selectedRole === "attendee"
                    ? ["rgba(108, 60, 224, 0.25)", "rgba(224, 72, 130, 0.15)"]
                    : ["rgba(255, 255, 255, 0.04)", "rgba(255, 255, 255, 0.02)"]
                }
                style={[
                  styles.roleCard,
                  selectedRole === "attendee" && styles.roleCardSelected,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.roleIconContainer}>
                  <LinearGradient
                    colors={["#6C3CE0", "#4880E0"]}
                    style={styles.roleIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="people" size={28} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.roleTitle}>Student / Attendee</Text>
                <Text style={styles.roleDescription}>
                  Find classmates, connect at events, and grow your professional
                  network
                </Text>
                {selectedRole === "attendee" && (
                  <View style={styles.roleCheckmark}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#6C3CE0"
                    />
                  </View>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => setSelectedRole("organiser")}
              style={({ pressed }) => [
                styles.roleCardWrapper,
                pressed && styles.roleCardPressed,
              ]}
            >
              <LinearGradient
                colors={
                  selectedRole === "organiser"
                    ? ["rgba(224, 72, 130, 0.25)", "rgba(253, 116, 108, 0.15)"]
                    : ["rgba(255, 255, 255, 0.04)", "rgba(255, 255, 255, 0.02)"]
                }
                style={[
                  styles.roleCard,
                  selectedRole === "organiser" && styles.roleCardSelected,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.roleIconContainer}>
                  <LinearGradient
                    colors={["#E04882", "#FD746C"]}
                    style={styles.roleIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="calendar" size={28} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.roleTitle}>Event Organiser</Text>
                <Text style={styles.roleDescription}>
                  Create and manage events, build your community, and engage
                  attendees
                </Text>
                {selectedRole === "organiser" && (
                  <View style={styles.roleCheckmark}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#E04882"
                    />
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarInner}>
          {step > 0 && (
            <Pressable
              onPress={() => animateToStep(step - 1)}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <Pressable
            onPress={
              step === TOTAL_STEPS - 1 ? handleGetStarted : handleContinue
            }
            disabled={isBusy}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
              isBusy && styles.continueButtonDisabled,
              step === 0 && styles.continueButtonFull,
            ]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {step === TOTAL_STEPS - 1 ? "Get Started" : "Continue"}
                </Text>
                {step < TOTAL_STEPS - 1 && (
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                )}
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  topSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  logoImage: {
    width: 48,
    height: 48,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "400",
    marginTop: 6,
    textAlign: "center",
  },
  contentWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
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
  avatarHint: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: 10,
  },

  // Banner
  bannerPicker: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  bannerPlaceholder: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderStyle: "dashed",
    gap: 8,
  },
  bannerIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    height: 150,
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

  // Fields
  fieldGroup: {
    marginBottom: 22,
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

  // Units
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

  // Socials
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
  socialInputDisabled: {
    color: "rgba(255, 255, 255, 0.45)",
  },
  lockedHint: {
    marginTop: -6,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
  },

  // Role selection
  roleContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
  },
  roleCardWrapper: {
    borderRadius: 20,
  },
  roleCardPressed: {
    opacity: 0.85,
  },
  roleCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    overflow: "hidden",
  },
  roleCardSelected: {
    borderColor: "rgba(108, 60, 224, 0.4)",
  },
  roleIconContainer: {
    marginBottom: 16,
  },
  roleIconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  roleDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 20,
    fontWeight: "400",
    paddingRight: 32,
  },
  roleCheckmark: {
    position: "absolute",
    top: 24,
    right: 24,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  bottomBarInner: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  continueButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6C3CE0",
    paddingVertical: 16,
    borderRadius: 16,
  },
  continueButtonFull: {
    flex: 1,
  },
  continueButtonPressed: {
    backgroundColor: "#5A2DC0",
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
