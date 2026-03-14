import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;
const SCAN_COOLDOWN_MS = 1000;

type ScanMode = "scan" | "myqr";

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

function ScanLineAnimation() {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: SCAN_AREA_SIZE - 4,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [translateY]);

  return (
    <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
      <LinearGradient
        colors={["transparent", "#6C3CE0", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.scanLineGradient}
      />
    </Animated.View>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>("scan");
  const [scannedUserId, setScannedUserId] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const lastScanAtRef = useRef(0);

  const userId = session?.user?.id ?? "";

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { data: profile } = useQuery((trpc as any).user.getMe.queryOptions());

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const connectMutation = useMutation(
    (trpc as any).connection.connectViaQr.mutationOptions({
      onSuccess: (data: any) => {
        if (data.alreadyConnected) {
          Alert.alert(
            "Already Connected",
            `You're already connected with ${data.user.displayName ?? data.user.name}.`,
            [{ text: "OK", onPress: resetScanner }],
          );
        } else {
          Alert.alert(
            "Connected!",
            `You are now connected with ${data.user.displayName ?? data.user.name}.`,
            [{ text: "OK", onPress: resetScanner }],
          );
        }
      },
      onError: (err: any) => {
        Alert.alert("Error", err.message, [
          { text: "OK", onPress: resetScanner },
        ]);
      },
    }),
  );

  const resetScanner = useCallback(() => {
    setHasScanned(false);
    setScannedUserId(null);
  }, []);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();

      if (
        hasScanned ||
        connectMutation.isPending ||
        now - lastScanAtRef.current < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      lastScanAtRef.current = now;

      const match = data.match(/^relio:\/\/connect\/(.+)$/);
      if (!match?.[1]) {
        Alert.alert(
          "Invalid QR",
          "This doesn't appear to be a Relio QR code.",
          [{ text: "OK", onPress: resetScanner }],
        );
        return;
      }

      const targetUserId = match[1];
      setHasScanned(true);
      setScannedUserId(targetUserId);
      connectMutation.mutate({ userId: targetUserId } as any);
    },
    [hasScanned, connectMutation, resetScanner],
  );

  if (!permission) {
    return (
      <View
        style={[styles.container, styles.centered, { paddingTop: insets.top }]}
      >
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[styles.container, styles.centered, { paddingTop: insets.top }]}
      >
        <View style={styles.permissionContent}>
          <LinearGradient
            colors={["#6C3CE0", "#E04882"]}
            style={styles.permissionIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="camera-outline" size={36} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan QR codes and connect with people
            instantly.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && styles.permissionButtonPressed,
            ]}
          >
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={[styles.toggleContainer, { top: insets.top + 12 }]}>
        <GlassCard style={styles.toggleCard}>
          <Pressable
            onPress={() => {
              setMode("scan");
              resetScanner();
            }}
            style={[
              styles.toggleOption,
              mode === "scan" && styles.toggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "scan" && styles.toggleTextActive,
              ]}
            >
              Scan
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("myqr")}
            style={[
              styles.toggleOption,
              mode === "myqr" && styles.toggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "myqr" && styles.toggleTextActive,
              ]}
            >
              My QR
            </Text>
          </Pressable>
        </GlassCard>
      </View>

      {mode === "scan" ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={hasScanned ? undefined : handleBarCodeScanned}
          />

          {/* Overlay */}
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanArea}>
                {/* Corner decorations */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <ScanLineAnimation />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              {connectMutation.isPending ? (
                <View style={styles.scanStatus}>
                  <ActivityIndicator size="small" color="#6C3CE0" />
                  <Text style={styles.scanStatusText}>Connecting...</Text>
                </View>
              ) : (
                <Text style={styles.scanHint}>
                  Point at a Relio QR code to connect
                </Text>
              )}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.myQrContainer}>
          <View style={styles.myQrContent}>
            <Text style={styles.myQrLabel}>
              {(profile as any)?.displayName ??
                (profile as any)?.name ??
                session?.user?.name ??
                "Your"}{" "}
              QR Code
            </Text>
            {userId ? (
              <GlassCard style={styles.qrCard}>
                <View style={styles.qrBackground}>
                  <QRCode
                    value={`relio://connect/${userId}`}
                    size={200}
                    backgroundColor="#FFFFFF"
                    color="#0A0A1A"
                  />
                </View>
              </GlassCard>
            ) : (
              <ActivityIndicator size="large" color="#6C3CE0" />
            )}
            <Text style={styles.myQrHint}>
              Let others scan this to connect with you instantly
            </Text>
          </View>
        </View>
      )}
    </View>
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

  toggleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  toggleCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
  },
  toggleOption: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9,
  },
  toggleOptionActive: {
    backgroundColor: "rgba(108, 60, 224, 0.9)",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.55)",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: "relative",
    overflow: "hidden",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    paddingTop: 32,
  },

  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#6C3CE0",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },

  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
  },
  scanLineGradient: {
    height: 2,
    width: "100%",
  },

  scanHint: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
  },
  scanStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scanStatusText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6C3CE0",
  },

  permissionContent: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: "#6C3CE0",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionButtonPressed: {
    backgroundColor: "#5A2FCB",
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  myQrContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  myQrContent: {
    alignItems: "center",
    gap: 24,
  },
  myQrLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  qrCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  qrBackground: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
  },
  myQrHint: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.4)",
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
