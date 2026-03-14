import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";

import { GlassCard } from "./GlassCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");
const TAB_COUNT = 5;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 49 : 56;

type TooltipStep = {
  tabIndex: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const ATTENDEE_STEPS: TooltipStep[] = [
  {
    tabIndex: 1,
    icon: "people",
    title: "People",
    description:
      "Find your classmates and people at events you've attended",
  },
  {
    tabIndex: 2,
    icon: "scan",
    title: "Scan",
    description: "Scan QR codes to instantly connect with people in person",
  },
  {
    tabIndex: 3,
    icon: "calendar",
    title: "Events",
    description: "Browse upcoming events and join to meet new people",
  },
  {
    tabIndex: 4,
    icon: "person",
    title: "Profile",
    description: "Your profile, connections, and QR code live here",
  },
];

const ORGANISER_STEPS: TooltipStep[] = [
  {
    tabIndex: 3,
    icon: "calendar",
    title: "Events",
    description: "Create and manage your events here",
  },
  {
    tabIndex: 1,
    icon: "people",
    title: "People",
    description: "See who's connecting through your events",
  },
  {
    tabIndex: 2,
    icon: "scan",
    title: "Scan",
    description: "Check attendees in with QR scanning",
  },
  {
    tabIndex: 4,
    icon: "person",
    title: "Profile",
    description: "Manage your organiser profile and connections",
  },
];

export function OnboardingTooltipOverlay() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<TooltipStep[]>([]);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const tooltipScale = useRef(new Animated.Value(0.85)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const spotlightOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pending = SecureStore.getItem("onboarding_tour_pending");
    if (pending !== "true") return;

    const role = SecureStore.getItem("onboarding_role");
    const tourSteps = role === "organiser" ? ORGANISER_STEPS : ATTENDEE_STEPS;
    setSteps(tourSteps);
    setCurrentStepIndex(0);
    setVisible(true);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(spotlightOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(tooltipScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: 300,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateTransition = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipScale, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();
        Animated.parallel([
          Animated.spring(tooltipScale, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(tooltipOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [tooltipOpacity, tooltipScale],
  );

  const handleNext = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        SecureStore.setItem("onboarding_tour_pending", "false");
        setVisible(false);
      });
    } else {
      animateTransition(() => {
        setCurrentStepIndex((prev) => prev + 1);
      });
    }
  }, [
    currentStepIndex,
    steps.length,
    overlayOpacity,
    tooltipOpacity,
    spotlightOpacity,
    animateTransition,
  ]);

  if (!visible || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex]!;
  const tabBarBottom = insets.bottom;
  const spotlightX = currentStep.tabIndex * TAB_WIDTH;
  const spotlightCenterX = spotlightX + TAB_WIDTH / 2;
  const isLastStep = currentStepIndex === steps.length - 1;

  const tooltipLeft = Math.max(
    16,
    Math.min(spotlightCenterX - 140, SCREEN_WIDTH - 296),
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents="none"
      />

      {/* Spotlight ring */}
      <Animated.View
        style={[
          styles.spotlightRing,
          {
            opacity: spotlightOpacity,
            left: spotlightCenterX - 32,
            bottom: tabBarBottom + TAB_BAR_HEIGHT / 2 - 32,
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.spotlightInner} />
      </Animated.View>

      {/* Pointer arrow */}
      <Animated.View
        style={[
          styles.arrowContainer,
          {
            opacity: tooltipOpacity,
            left: spotlightCenterX - 8,
            bottom: tabBarBottom + TAB_BAR_HEIGHT + 32,
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.arrow} />
      </Animated.View>

      {/* Tooltip card */}
      <Animated.View
        style={[
          styles.tooltipContainer,
          {
            left: tooltipLeft,
            bottom: tabBarBottom + TAB_BAR_HEIGHT + 44,
            opacity: tooltipOpacity,
            transform: [{ scale: tooltipScale }],
          },
        ]}
      >
        <Pressable onPress={handleNext}>
          <GlassCard style={styles.tooltipCard}>
            <View style={styles.tooltipHeader}>
              <View style={styles.tooltipIconCircle}>
                <Ionicons
                  name={currentStep.icon}
                  size={18}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
            </View>
            <Text style={styles.tooltipDescription}>
              {currentStep.description}
            </Text>
            <View style={styles.tooltipFooter}>
              <Text style={styles.tooltipCounter}>
                {currentStepIndex + 1} of {steps.length}
              </Text>
              <View style={styles.tooltipButton}>
                <Text style={styles.tooltipButtonText}>
                  {isLastStep ? "Got it" : "Next"}
                </Text>
                {!isLastStep && (
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color="#FFFFFF"
                  />
                )}
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>

      {/* Full-screen tap target (behind the tooltip) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  spotlightRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(108, 60, 224, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  spotlightInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(108, 60, 224, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.3)",
  },
  arrowContainer: {
    position: "absolute",
    zIndex: 20,
  },
  arrow: {
    width: 16,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderTopWidth: 0,
    borderLeftWidth: 0,
    transform: [{ rotate: "45deg" }],
  },
  tooltipContainer: {
    position: "absolute",
    width: 280,
    zIndex: 30,
  },
  tooltipCard: {
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tooltipIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(108, 60, 224, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  tooltipDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 20,
    fontWeight: "400",
  },
  tooltipFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  tooltipCounter: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.35)",
    fontWeight: "500",
  },
  tooltipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(108, 60, 224, 0.3)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tooltipButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
