/**
 * QR Scan Screen
 *
 * Unauthorized access flow:
 *   Step 1 — PreWarningModal: "Machine in use by [owner]. Proceed?"
 *             [Leave Now]  [Yes, I understand]
 *   Step 2 — IncidentCountdownModal: "Unauthorized access detected. 60s countdown."
 *             No action buttons — user just sees the countdown.
 *
 * Scan is locked from first scan until an explicit action (leave, timeout, or authorized).
 */

import {
  View, Text, StyleSheet, Pressable, Modal, Animated, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useQRScanViewModel } from "@/viewmodels/tabs/QRScanViewModel";
import { useUser } from "@/components/UserContext";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";

// ─── Pre-Warning Modal ───────────────────────────────────────────────────────

function PreWarningModal({
  visible,
  ownerUserName,
  machineId,
  onLeave,
  onProceed,
  t,
}: {
  visible: boolean;
  ownerUserName: string;
  machineId: string;
  onLeave: () => void;
  onProceed: () => void;
  t: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      slideAnim.setValue(60);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <LinearGradient colors={["#F59E0B", "#D97706"]} style={styles.modalHeader}>
            <View style={styles.modalIconBox}>
              <Ionicons name="warning" size={30} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>
              {t.machineCurrentlyInUse ?? "Machine Currently In Use"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {t.machineBelongsTo ?? "This machine belongs to"} {ownerUserName}
            </Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            <View style={styles.warningCard}>
              <Ionicons name="information-circle" size={20} color="#D97706" />
              <Text style={styles.warningText}>
                {t.unauthorizedProceedWarning ??
                  "If you proceed, the machine owner and admin will be alerted immediately. A 60-second action window will open."}
              </Text>
            </View>

            <Text style={styles.questionText}>
              {t.doYouWantToProceed ?? "Do you want to proceed?"}
            </Text>

            <View style={styles.modalActions}>
              {/* Leave — primary safe action */}
              <Pressable
                onPress={onLeave}
                style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
              >
                <LinearGradient colors={["#10B981", "#059669"]} style={styles.btnGradient}>
                  <Ionicons name="arrow-back" size={18} color="#fff" />
                  <Text style={styles.btnTextWhite}>{t.leaveNow ?? "Leave Now"}</Text>
                </LinearGradient>
              </Pressable>

              {/* Proceed — secondary, danger */}
              <Pressable
                onPress={onProceed}
                style={({ pressed }) => [styles.btnDanger, pressed && styles.btnPressed]}
              >
                <Text style={styles.btnTextDanger}>
                  {t.yesIProceed ?? "Yes, I understand — proceed"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Incident Countdown Modal (intruder side) ─────────────────────────────────

function IncidentCountdownModal({
  visible,
  secondsLeft,
  machineId,
  onCancel,
  t,
}: {
  visible: boolean;
  secondsLeft: number;
  machineId?: string;
  onCancel: () => void;
  t: any;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const isUrgent = secondsLeft <= 15;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: isUrgent ? pulseAnim : 1 }] },
          ]}
        >
          <LinearGradient
            colors={isUrgent ? ["#DC2626", "#B91C1C"] : ["#EF4444", "#DC2626"]}
            style={styles.modalHeader}
          >
            <View style={styles.modalIconBox}>
              <Ionicons name="alert-circle" size={30} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>
              {t.unauthorizedAccessDetected ?? "Unauthorized Access Detected"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {machineId
                ? `${t.machine ?? "Machine"} ${machineId}`
                : t.machineAccess ?? "Machine access"}
            </Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            <View style={styles.countdownBox}>
              <Text style={styles.countdownLabel}>
                {t.actionsTakenIn ?? "Actions will be taken in"}
              </Text>
              <Text style={[styles.countdownValue, isUrgent && styles.countdownUrgent]}>
                {timeStr}
              </Text>
              <Text style={styles.countdownSub}>
                {t.ownerAndAdminNotified ?? "The machine owner and admin have been notified."}
              </Text>
            </View>

            {isUrgent && (
              <View style={styles.urgentBanner}>
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={styles.urgentText}>
                  {t.buzzerWillTrigger ?? "The buzzer will trigger very soon!"}
                </Text>
              </View>
            )}

            {/* Cancel — just goes back, incident is still running on backend */}
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}
            >
              <Text style={styles.btnOutlineText}>{t.leaveNow ?? "Leave Now"}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function QRScanScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const params = useLocalSearchParams();
  const machineId = params.machineId as string | undefined;

  const {
    scanned,
    loading,
    torch,
    setTorch,
    onScan,
    preWarning,
    onPreWarningLeave,
    onPreWarningProceed,
    incident,
    cancelIncident,
  } = useQRScanViewModel({
    userId: user?.uid,
    userName: user?.name,
    machineId,
  });

  const [permission, requestPermission] = useCameraPermissions();
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cornerPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const scanLine = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    scanLine.start();

    const cornerPulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(cornerPulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(cornerPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    cornerPulseAnim.start();
  }, []);

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>{t.requestingCameraPermission ?? "Requesting camera..."}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permText}>{t.cameraPermissionRequired ?? "Camera permission required"}</Text>
        <Pressable onPress={requestPermission} style={styles.permBtn}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.permBtnGrad}>
            <Text style={styles.permBtnText}>{t.grantPermission ?? "Grant Permission"}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        torch={torch ? "on" : "off"}
        onBarcodeScanned={scanned ? undefined : ({ data }) => onScan(data)}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Dark overlay with cutout */}
      <View style={styles.overlay2}>
        <View style={styles.topMask} />
        <View style={styles.middleRow}>
          <View style={styles.sideMask} />
          <Animated.View style={[styles.scanBox, { transform: [{ scale: cornerPulse }] }]}>
            {/* Corner decorations */}
            {[
              { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
              { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
              { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
              { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
            ].map((corner, i) => (
              <View
                key={i}
                style={[
                  styles.corner,
                  corner as any,
                  { borderColor: scanned ? "#10B981" : "#6366F1" },
                ]}
              />
            ))}

            {/* Scan line */}
            {!scanned && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
              />
            )}

            {scanned && (
              <View style={styles.scannedOverlay}>
                <Ionicons
                  name={loading ? "hourglass" : "checkmark-circle"}
                  size={48}
                  color={loading ? "#F59E0B" : "#10B981"}
                />
                <Text style={styles.scannedText}>
                  {loading ? (t.processing ?? "Processing...") : (t.scanned ?? "Scanned!")}
                </Text>
              </View>
            )}
          </Animated.View>
          <View style={styles.sideMask} />
        </View>
        <View style={styles.bottomMask}>
          <Text style={styles.instructionText}>
            {scanned
              ? (loading ? (t.processing ?? "Processing...") : (t.scanSuccess ?? "Scan successful!"))
              : (t.positionQRCode ?? "Position the QR code within the frame")}
          </Text>

          <View style={styles.bottomControls}>
            {/* Torch */}
            <Pressable
              onPress={() => setTorch(!torch)}
              style={[styles.controlBtn, torch && styles.controlBtnActive]}
            >
              <Ionicons
                name={torch ? "flashlight" : "flashlight-outline"}
                size={22}
                color="#fff"
              />
            </Pressable>

            {/* Back */}
            <Pressable onPress={() => router.back()} style={styles.controlBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Step 1: Pre-warning */}
      <PreWarningModal
        visible={!!preWarning}
        ownerUserName={preWarning?.ownerUserName ?? ""}
        machineId={preWarning?.machineId ?? ""}
        onLeave={onPreWarningLeave}
        onProceed={onPreWarningProceed}
        t={t}
      />

      {/* Step 2: Incident countdown */}
      <IncidentCountdownModal
        visible={!!incident}
        secondsLeft={incident?.secondsLeft ?? 0}
        machineId={incident?.machineId}
        onCancel={cancelIncident}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
    gap: 16,
    padding: 24,
  },
  permText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  permBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  permBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Overlay
  overlay2: { flex: 1 },
  topMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  middleRow: { flexDirection: "row", height: 250 },
  sideMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  bottomMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 20,
  },
  scanBox: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  scanLine: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: "#6366F1",
    opacity: 0.85,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  scannedText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  instructionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomControls: { flexDirection: "row", gap: 16 },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  controlBtnActive: { backgroundColor: "rgba(99,102,241,0.5)", borderColor: "#6366F1" },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  modalHeader: {
    padding: 24,
    alignItems: "center",
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    textAlign: "center",
  },
  modalContent: { padding: 24 },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 19,
    fontWeight: "500",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 20,
  },
  modalActions: { gap: 10 },
  btnPrimary: { borderRadius: 14, overflow: "hidden" },
  btnDanger: {
    padding: 14,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 8,
  },
  btnTextWhite: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnTextDanger: { color: "#DC2626", fontSize: 14, fontWeight: "600" },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnOutline: {
    padding: 14,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  btnOutlineText: { color: "#64748B", fontSize: 15, fontWeight: "600" },

  // Countdown modal
  countdownBox: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 16,
  },
  countdownLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 8,
  },
  countdownValue: {
    fontSize: 52,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -2,
  },
  countdownUrgent: { color: "#DC2626" },
  countdownSub: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  urgentText: { color: "#DC2626", fontSize: 13, fontWeight: "600", flex: 1 },
});
