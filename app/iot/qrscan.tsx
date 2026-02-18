/**
 * QR Scan Screen
 * 
 * Scans machine QR codes and handles authorization flow.
 * Shows 60-second countdown modal for unauthorized users.
 */

import { View, Text, StyleSheet, Pressable, Modal, Animated, StatusBar } from "react-native";
import { useEffect, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useQRScanViewModel } from "@/viewmodels/tabs/QRScanViewModel";
import { useUser } from "@/components/UserContext";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";

/* =========================
   COUNTDOWN MODAL (Enhanced)
========================= */
function UnauthorizedModal({
  visible,
  secondsLeft,
  nextUserName,
  loading,
  onDismiss,
  onCancel,
  t,
}: {
  visible: boolean;
  secondsLeft: number;
  nextUserName: string;
  loading: boolean;
  onDismiss: () => void;
  onCancel: () => void;
  t: any;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

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

  const urgencyColor = secondsLeft <= 15 ? "#EF4444" : secondsLeft <= 30 ? "#F97316" : "#22D3EE";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.backdrop}>
        <Animated.View style={[modalStyles.container, { transform: [{ translateX: shakeAnim }] }]}>
          <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={modalStyles.content}>
            {/* Icon */}
            <View style={modalStyles.iconWrapper}>
              <LinearGradient colors={[urgencyColor, urgencyColor]} style={modalStyles.iconCircle}>
                <Ionicons name="warning" size={32} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={modalStyles.title}>{t.notYourTurn}</Text>

            {/* Countdown */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[modalStyles.countdown, { color: urgencyColor }]}>
                {secondsLeft}
              </Text>
            </Animated.View>
            <Text style={modalStyles.countdownLabel}>{t.secondsRemaining}</Text>

            <Text style={modalStyles.message}>
              {t.machineReservedFor} <Text style={modalStyles.userName}>{nextUserName}</Text>
            </Text>
            <Text style={modalStyles.subMessage}>{t.buzzerWillSound}</Text>

            {/* Buttons */}
            <View style={modalStyles.buttons}>
              <Pressable onPress={onDismiss} disabled={loading} style={{ width: '100%' }}>
                <LinearGradient colors={["#22D3EE", "#06B6D4"]} style={modalStyles.primaryButton}>
                  <Text style={modalStyles.primaryText}>
                    {loading ? t.verifyingAccess : t.thatsMe}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={onCancel} disabled={loading} style={modalStyles.secondaryButton}>
                <Text style={modalStyles.secondaryText}>{t.leave}</Text>
              </Pressable>
            </View>

            <Text style={modalStyles.helpText}>
              {t.tapThatsMeIfYouAre} {nextUserName}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 24 },
  container: { width: "100%", maxWidth: 340, borderRadius: 32, overflow: "hidden" },
  content: { padding: 32, alignItems: "center" },
  iconWrapper: { marginBottom: 20 },
  iconCircle: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 20 },
  countdown: { fontSize: 80, fontWeight: "900", lineHeight: 90 },
  countdownLabel: { fontSize: 14, color: "#64748b", fontWeight: "600", marginBottom: 24 },
  message: { fontSize: 16, color: "#334155", textAlign: "center", lineHeight: 24, marginBottom: 8 },
  userName: { fontWeight: "800", color: "#0f172a" },
  subMessage: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginBottom: 28 },
  buttons: { width: "100%", gap: 12 },
  primaryButton: { paddingVertical: 18, alignItems: "center", borderRadius: 18, shadowColor: "#06B6D4", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  secondaryButton: { paddingVertical: 16, alignItems: "center", borderRadius: 18, backgroundColor: "#F1F5F9" },
  secondaryText: { color: "#64748b", fontSize: 16, fontWeight: "700" },
  helpText: { marginTop: 20, fontSize: 12, color: "#94a3b8", textAlign: "center" },
});

/* =========================
   SCREEN
========================= */
export default function QRScanScreen() {
  const { user } = useUser();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { t } = useI18n();

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
    if (!permission?.granted) requestPermission();
  }, [permission]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>{t.cameraPermissionRequired}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : ({ data }) => onScan(data)}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        enableTorch={torch}
      >
        {/* Torch Button (Enhanced) */}
        <Pressable style={styles.torchButton} onPress={() => setTorch(!torch)}>
          <LinearGradient colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} style={styles.torchGradient}>
            <Ionicons name={torch ? "flash" : "flash-off"} size={20} color="#fff" />
            <Text style={styles.torchText}>{torch ? t.flashOn : t.flashOff}</Text>
          </LinearGradient>
        </Pressable>
      </CameraView>

      {/* Header (Enhanced) */}
      <View style={styles.header}>
        <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="scan-outline" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t.scanQRCode}</Text>
              <Text style={styles.headerSub}>{t.pointCameraAtQR}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </LinearGradient>
      </View>

      {/* Scan Frame (Layout kept same, style enhanced) */}
      <View style={styles.frameWrapper}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.cameraStatus}>● {t.cameraActive}</Text>
      </View>

      {/* Instructions (Enhanced Glassmorphism) */}
      <View style={styles.instructionsContainer}>
        <LinearGradient colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.9)"]} style={styles.instructionsGradient}>
          <Text style={styles.instructionTitle}>{t.howToScan}</Text>
          <View style={styles.instructionRow}>
            <Ionicons name="locate" size={16} color="#6366F1" />
            <Text style={styles.instructionText}>{t.positionQRCode}</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="hand-left" size={16} color="#6366F1" />
            <Text style={styles.instructionText}>{t.keepCameraSteady}</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="flash" size={16} color="#6366F1" />
            <Text style={styles.instructionText}>{t.scanHappensAutomatically}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Cancel (Enhanced) */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={{ width: '100%' }}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.cancelButton}>
            <Ionicons name="arrow-back" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.cancelText}>{t.cancelScanning}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {loading && !incident && (
        <View style={styles.loading}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.loadingBox}>
            <Text style={styles.loadingText}>{t.verifyingAccess}</Text>
          </LinearGradient>
        </View>
      )}

      <UnauthorizedModal
        visible={incident !== null}
        secondsLeft={incident?.secondsLeft ?? 0}
        nextUserName={incident?.nextUserName ?? ""}
        loading={incidentLoading}
        onDismiss={dismissIncident}
        onCancel={cancelIncident}
        t={t}
      />
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  root: { flex: 1, backgroundColor: "#000" },

  /* Header */
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  headerGradient: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },

  /* Torch */
  torchButton: { position: "absolute", bottom: 280, alignSelf: "center", borderRadius: 20, overflow: "hidden" },
  torchGradient: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  torchText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  /* Frame */
  frameWrapper: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanFrame: {
    width: 260,
    height: 260,
    backgroundColor: "transparent",
    position: "relative",
  },
  // Corner styling for the frame
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#22D3EE",
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },
  
  cameraStatus: { marginTop: 20, color: "#22D3EE", fontSize: 14, fontWeight: "700" },

  /* Instructions */
  instructionsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionsGradient: { padding: 20 },
  instructionTitle: { fontWeight: "800", marginBottom: 12, color: "#0f172a", fontSize: 16 },
  instructionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  instructionText: { fontSize: 14, color: "#475569", fontWeight: "600" },

  /* Footer */
  footer: { paddingBottom: 30, paddingHorizontal: 20 },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  cancelText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  /* Loading */
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center" },
  loadingBox: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16 },
  loadingText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});