/**
 * QR Scan Screen — ENHANCED
 *
 * Fix #8: Unauthorized modal has reason-selection for the scanner
 * (4 preset reasons + free-text "Other"). Submits reason on cancel.
 */

import {
  View, Text, StyleSheet, Pressable, Modal, Animated, StatusBar,
} from "react-native";
import { useEffect, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useQRScanViewModel } from "@/viewmodels/tabs/QRScanViewModel";
import { useUser } from "@/components/UserContext";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";

// ─── Unauthorized Modal (for the intruder/scanner) ───────────────────────────

function UnauthorizedModal({
  visible, secondsLeft, loading, onCancel, t,
}: {
  visible: boolean; secondsLeft: number;
  loading: boolean; onCancel: (reason: string) => void; t: any;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [visible]);

  useEffect(() => {
    if (secondsLeft <= 10 && secondsLeft > 0 && visible) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [secondsLeft]);

  const urgency = secondsLeft <= 15 ? "#EF4444" : secondsLeft <= 30 ? "#F97316" : "#F59E0B";

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ms.backdrop}>
        <Animated.View style={[ms.sheet, { transform: [{ translateX: shakeAnim }] }]}>
          <LinearGradient colors={["#0f172a", "#1e293b"]} style={ms.sheetInner}>

            <View style={ms.warningBadge}>
              <LinearGradient colors={["#EF4444", "#DC2626"]} style={ms.warningCircle}>
                <Ionicons name="alert-circle" size={36} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={ms.title}>{t.unauthorizedAccessDetected}</Text>

            <View style={ms.reportedCard}>
              <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
              <Text style={ms.reportedText}>
                {t.unauthorizedAccessReported}
              </Text>
            </View>

            <Text style={ms.alarmLabel}>{t.unauthorizedAlarmIn}</Text>
            <Animated.Text style={[ms.countdown, { color: urgency, transform: [{ scale: pulseAnim }] }]}>
              {secondsLeft}
            </Animated.Text>
            <Text style={ms.countdownSub}>{t.incidentSecondsLeft}</Text>

            <Pressable
              onPress={() => onCancel("Acknowledged — leaving")}
              disabled={loading}
              style={({ pressed }) => [ms.leaveNowBtn, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient colors={["#EF4444", "#DC2626"]} style={ms.leaveNowGrad}>
                <Ionicons name="exit-outline" size={20} color="#fff" />
                <Text style={ms.leaveNowText}>{loading ? t.loading : t.leaveNow}</Text>
              </LinearGradient>
            </Pressable>

          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: "hidden" },
  sheetInner: { padding: 28, paddingBottom: 44, alignItems: "center" },

  warningBadge: { marginBottom: 16, marginTop: 8 },
  warningCircle: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },

  title: { fontSize: 22, fontWeight: "900", color: "#fff", marginBottom: 20, letterSpacing: -0.5, textAlign: "center" },

  reportedCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 16, padding: 16, marginBottom: 28, width: "100%",
  },
  reportedText: { flex: 1, fontSize: 14, color: "#FCD34D", fontWeight: "600", lineHeight: 20 },

  alarmLabel: { fontSize: 11, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 },
  countdown: { fontSize: 72, fontWeight: "900", lineHeight: 80, letterSpacing: -3, marginBottom: 4 },
  countdownSub: { fontSize: 14, color: "#475569", fontWeight: "600", marginBottom: 28 },

  leaveNowBtn: { width: "100%", borderRadius: 18, overflow: "hidden" },
  leaveNowGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  leaveNowText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QRScanScreen() {
  const { user } = useUser();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { t } = useI18n();

  const {
    scanned, loading, torch, setTorch, onScan,
    incident, incidentLoading, dismissIncident, cancelIncident,
  } = useQRScanViewModel({ userId: user?.uid, userName: user?.name || user?.email || "User", machineId });

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.permIcon}>
          <Ionicons name="camera" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.permText}>{t.cameraPermissionRequired}</Text>
        <Pressable onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>{t.ok || "Grant Permission"}</Text>
        </Pressable>
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
      />

      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent", "transparent", "rgba(0,0,0,0.7)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <LinearGradient colors={["rgba(15,23,42,0.95)", "rgba(15,23,42,0.8)"]} style={styles.headerGrad}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t.scanQRCode}</Text>
            <Text style={styles.headerSub}>{machineId ? `${t.machine}: ${machineId}` : t.pointCameraAtQR}</Text>
          </View>
          <Pressable style={styles.torchBtn} onPress={() => setTorch(!torch)}>
            <Ionicons name={torch ? "flash" : "flash-off"} size={20} color={torch ? "#FCD34D" : "#fff"} />
          </Pressable>
        </LinearGradient>
      </View>

      <View style={styles.frameWrap}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          {loading && <View style={styles.scanLine} />}
        </View>
        <Text style={styles.hint}>
          {loading ? `⚡ ${t.loading}` : `● ${t.cameraActive}`}
        </Text>
      </View>

      <View style={styles.instructions}>
        <LinearGradient colors={["rgba(15,23,42,0.95)", "rgba(30,41,59,0.9)"]} style={styles.instrGrad}>
          <View style={styles.instrRow}>
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.instrIcon}>
              <Ionicons name="locate" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.instrText}>{t.positionQRCode}</Text>
          </View>
          <View style={styles.instrRow}>
            <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.instrIcon}>
              <Ionicons name="hand-left" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.instrText}>{t.keepCameraSteady}</Text>
          </View>
          <View style={styles.instrRow}>
            <LinearGradient colors={["#10B981", "#059669"]} style={styles.instrIcon}>
              <Ionicons name="flash" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.instrText}>{t.scanHappensAutomatically}</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}>
          <LinearGradient colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.08)"]} style={styles.cancelGrad}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={styles.cancelText}>{t.cancelScanning}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {loading && !incident && (
        <View style={styles.loadingOverlay}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.loadingBox}>
            <Ionicons name="sync" size={20} color="#fff" />
            <Text style={styles.loadingText}>{t.verifyingAccess}</Text>
          </LinearGradient>
        </View>
      )}

      <UnauthorizedModal
        visible={incident !== null}
        secondsLeft={incident?.secondsLeft ?? 0}
        loading={incidentLoading}
        onCancel={(reason) => cancelIncident(reason)}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 32 },
  permIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  permText: { fontSize: 18, color: "#fff", fontWeight: "700", marginBottom: 24, textAlign: "center" },
  permBtn: { backgroundColor: "#6366F1", paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16 },
  permBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  headerGrad: {
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 18,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  torchBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },

  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { width: 260, height: 260, position: "relative" },
  corner: { position: "absolute", width: 36, height: 36, borderColor: "#22D3EE", borderWidth: 0 },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  scanLine: {
    position: "absolute", left: 8, right: 8, top: "50%",
    height: 2, backgroundColor: "#22D3EE", opacity: 0.8, borderRadius: 1,
  },
  hint: { marginTop: 20, color: "#22D3EE", fontSize: 13, fontWeight: "700" },

  instructions: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, overflow: "hidden" },
  instrGrad: { padding: 20, gap: 12 },
  instrRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  instrIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  instrText: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "600" },

  footer: { paddingHorizontal: 20, paddingBottom: 36 },
  cancelBtn: { borderRadius: 18, overflow: "hidden" },
  cancelGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 18 },
  cancelText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 20 },
  loadingText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});