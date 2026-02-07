/**
 * QR Scan Screen
 * 
 * Scans machine QR codes and handles authorization flow.
 * Shows 60-second countdown modal for unauthorized users.
 */

import { View, Text, StyleSheet, Pressable, Modal, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useQRScanViewModel } from "@/viewmodels/tabs/QRScanViewModel";
import { useUser } from "@/components/UserContext";
import { LinearGradient } from "expo-linear-gradient";

/* =========================
   COUNTDOWN MODAL
========================= */
function UnauthorizedModal({
  visible,
  secondsLeft,
  nextUserName,
  loading,
  onDismiss,
  onCancel,
}: {
  visible: boolean;
  secondsLeft: number;
  nextUserName: string;
  loading: boolean;
  onDismiss: () => void;
  onCancel: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for countdown
  useEffect(() => {
    if (!visible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [visible]);

  // Shake when time is low
  useEffect(() => {
    if (secondsLeft <= 10 && secondsLeft > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [secondsLeft]);

  const urgencyColor = secondsLeft <= 15 ? "#ef4444" : secondsLeft <= 30 ? "#f97316" : "#eab308";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.backdrop}>
        <Animated.View
          style={[
            modalStyles.container,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {/* Warning Icon */}
          <View style={[modalStyles.iconCircle, { backgroundColor: urgencyColor }]}>
            <Text style={modalStyles.icon}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={modalStyles.title}>Not Your Turn!</Text>
          
          {/* Countdown */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={[modalStyles.countdown, { color: urgencyColor }]}>
              {secondsLeft}
            </Text>
          </Animated.View>
          <Text style={modalStyles.countdownLabel}>seconds remaining</Text>

          {/* Message */}
          <Text style={modalStyles.message}>
            This machine is reserved for{"\n"}
            <Text style={modalStyles.userName}>{nextUserName}</Text>
          </Text>
          <Text style={modalStyles.subMessage}>
            The buzzer will sound when time runs out.
          </Text>

          {/* Buttons */}
          <View style={modalStyles.buttons}>
            <Pressable
              style={({ pressed }) => [
                modalStyles.dismissButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={onDismiss}
              disabled={loading}
            >
              <LinearGradient
                colors={["#22c55e", "#16a34a"]}
                style={modalStyles.buttonGradient}
              >
                <Text style={modalStyles.dismissText}>
                  {loading ? "Verifying..." : "That's Me ✓"}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                modalStyles.cancelButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={modalStyles.cancelText}>Leave</Text>
            </Pressable>
          </View>

          {/* Help text */}
          <Text style={modalStyles.helpText}>
            Tap "That's Me" if you are {nextUserName}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 20,
  },
  countdown: {
    fontSize: 72,
    fontWeight: "900",
    lineHeight: 80,
  },
  countdownLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: "#334155",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  userName: {
    fontWeight: "700",
    color: "#0f172a",
  },
  subMessage: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  dismissButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  dismissText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  cancelText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  helpText: {
    marginTop: 16,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
});

/* =========================
   SCREEN
========================= */
export default function QRScanScreen() {
  const { user } = useUser();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();

  const {
    scanned,
    loading,
    torch,
    setTorch,
    onScan,
    incident,
    incidentLoading,
    dismissIncident,
    cancelIncident,
  } = useQRScanViewModel({
    userId: user?.uid,
    userName: user?.name || user?.email || "User",
    machineId,
  });

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={
          scanned ? undefined : ({ data }) => onScan(data)
        }
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        enableTorch={torch}
      >
        <View style={styles.torchButtonWrapper}>
          <Text
            style={styles.torchButton}
            onPress={() => setTorch(!torch)}
          >
            {torch ? "🔦 Flash On" : "🔦 Flash Off"}
          </Text>
        </View>
      </CameraView>

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🧺</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Scan QR Code</Text>
            <Text style={styles.headerSub}>
              Point camera at the machine QR
            </Text>
          </View>
        </View>

        <Text style={styles.close} onPress={() => router.back()}>
          ✕
        </Text>
      </View>

      {/* Scan Frame */}
      <View style={styles.frameWrapper}>
        <View style={styles.scanFrame} />
        <Text style={styles.cameraStatus}>● Camera active</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>How to scan:</Text>
        <Text style={styles.instructionText}>
          • Position QR code within the frame
        </Text>
        <Text style={styles.instructionText}>
          • Keep camera steady and well-lit
        </Text>
        <Text style={styles.instructionText}>
          • Scan happens automatically
        </Text>
      </View>

      {/* Cancel */}
      <View style={styles.footer}>
        <Text style={styles.cancel} onPress={() => router.back()}>
          Cancel Scanning
        </Text>
      </View>

      {/* Loading Overlay */}
      {loading && !incident && (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Verifying access…</Text>
        </View>
      )}

      {/* Unauthorized Incident Modal */}
      <UnauthorizedModal
        visible={incident !== null}
        secondsLeft={incident?.secondsLeft ?? 0}
        nextUserName={incident?.nextUserName ?? ""}
        loading={incidentLoading}
        onDismiss={dismissIncident}
        onCancel={cancelIncident}
      />
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  /* Header */
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 18 },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSub: {
    color: "#e0e7ff",
    fontSize: 13,
    marginTop: 2,
  },
  close: {
    color: "#fff",
    fontSize: 22,
  },

  /* Scan Frame */
  frameWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.1)",
    shadowColor: "#60a5fa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  cameraStatus: {
    marginTop: 12,
    color: "#22c55e",
    fontSize: 13,
  },

  /* Instructions */
  instructions: {
    backgroundColor: "#f8fafc",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  instructionTitle: {
    fontWeight: "700",
    marginBottom: 8,
    color: "#1e293b",
  },
  instructionText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 4,
  },

  /* Footer */
  footer: {
    paddingBottom: 30,
    alignItems: "center",
  },
  cancel: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    color: "#374151",
    fontWeight: "600",
  },

  /* Loading */
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  /* Torch */
  torchButtonWrapper: {
    position: "absolute",
    bottom: 250,
    alignSelf: "center",
  },
  torchButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#fff",
    padding: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
});
