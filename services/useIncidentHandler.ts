/**
 * useIncidentHandler — v4
 *
 * WHY incidentSignals collection (not RTDB / Firestore query):
 *   - RTDB security rules often block client reads silently
 *   - Firestore `where ownerUserId == uid` is a LIST query — security rules
 *     that reference resource.data don't apply to list operations
 *   - incidentSignals/{userId} is a DIRECT document read → security rule:
 *     "allow read: if request.auth.uid == userId"  (one line, always works)
 *   - Backend writes this doc in handleConfirm / handleReportIntruder
 *   - Backend deletes it on resolve / dismiss / timeout
 *
 * Role paths:
 *   Owner:   onSnapshot(doc(db, 'incidentSignals', userId)) — written on confirm
 *   Admin:   onSnapshot(doc(db, 'incidentSignals', userId)) — written on report intruder
 *   Intruder: Firestore query where intruderId==userId (no security rule issue
 *             because intruder is querying BY their own id — backend can configure
 *             this easily; also kept as fallback with RTDB)
 *
 * KEY INVARIANTS:
 *   - clearIncident() does NOT add to _dismissed (only userDismiss() does)
 *   - startCountdown deps = [clearIncident] ONLY → won't re-run on userId load
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import {
  doc, collection, query, where, onSnapshot, Timestamp, deleteDoc,
} from "firebase/firestore";
import { ref as rtdbRef, onValue, off } from "firebase/database";
import { db, rtdb } from "@/services/firebase";
import { incidentAction } from "@/services/api";
import { playSound, stopSound } from "@/services/soundState";

export type ActiveIncident = {
  id: string;
  machineId: string;
  intruderName: string;
  intruderId: string;
  ownerUserId: string;
  ownerUserName: string;
  createdAt?: string;
  expiresAt: Date;
  secondsLeft: number;
};

type IncidentDoc = Omit<ActiveIncident, "secondsLeft">;
type Params = { userId?: string; isAdmin?: boolean; isIntruder?: boolean };

// Module-level dismissed set — only userDismiss() adds to it, never cleanup
const _dismissed = new Set<string>();

export function useIncidentHandler({ userId, isAdmin, isIntruder }: Params) {
  const [incident, setIncident]   = useState<ActiveIncident | null>(null);
  const [loading, setLoading]     = useState(false);
  const countdownRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIdRef               = useRef<string | null>(null);

  const clearIncident = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    stopSound();
    Vibration.cancel();
    activeIdRef.current = null;
    setIncident(null);
  }, []);

  const userDismiss = useCallback(() => {
    if (activeIdRef.current) _dismissed.add(activeIdRef.current);
    clearIncident();
  }, [clearIncident]);

  // deps = [clearIncident] ONLY — prevents re-run when userId/isAdmin loads
  const startCountdown = useCallback((doc: IncidentDoc) => {
    if (activeIdRef.current === doc.id) return;
    if (_dismissed.has(doc.id)) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    activeIdRef.current = doc.id;
    playSound("urgent");
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    const tick = () => {
      const rem = Math.max(0, Math.floor((doc.expiresAt.getTime() - Date.now()) / 1000));
      if (rem <= 0) { clearIncident(); return; }
      setIncident({ ...doc, secondsLeft: rem });
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, [clearIncident]);

  const parseSignalDoc = useCallback((data: any, docId: string): IncidentDoc | null => {
    if (!data?.incidentId) return null;
    let expiresAt: Date;
    if (data.expiresAt instanceof Timestamp)     expiresAt = data.expiresAt.toDate();
    else if (typeof data.expiresAt === "string") expiresAt = new Date(data.expiresAt);
    else                                         expiresAt = new Date(Date.now() + 60000);
    if (expiresAt.getTime() <= Date.now()) return null;
    if (_dismissed.has(data.incidentId)) return null;
    return {
      id:            data.incidentId,
      machineId:     data.machineId     ?? "",
      intruderName:  data.intruderName  ?? "Unknown",
      intruderId:    data.intruderId    ?? "",
      ownerUserId:   data.ownerUserId   ?? userId ?? "",
      ownerUserName: data.ownerUserName ?? "Unknown",
      createdAt:     data.createdAt,
      expiresAt,
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubs: (() => void)[] = [];

    // ════════════════════════════════════════════════════════════════════════
    // OWNER path  — listens to incidentSignals/{userId} (direct doc, no query)
    // Backend writes this in handleConfirm() when intruder acknowledges
    // ════════════════════════════════════════════════════════════════════════
    if (!isAdmin && !isIntruder) {
      // PRIMARY: Firestore incidentSignals/{userId} — guaranteed by security rules
      const signalRef = doc(db, "incidentSignals", userId);
      const unsubSignal = onSnapshot(signalRef, (snap) => {
        if (!snap.exists()) { clearIncident(); return; }
        const parsed = parseSignalDoc(snap.data(), snap.id);
        if (parsed) startCountdown(parsed);
        else clearIncident();
      }, (e: any) => console.warn("[IncidentHandler] owner signal read error:", e?.code ?? e?.message));
      unsubs.push(unsubSignal);

      // BACKUP: RTDB userIncident/{userId} (works if RTDB rules configured)
      const rtdbPath = rtdbRef(rtdb, `userIncident/${userId}`);
      const rtdbUnsub = onValue(rtdbPath, (snap) => {
        if (!snap.exists()) return; // don't clear — Firestore signal is primary
        const d = snap.val();
        if (!d?.incidentId || activeIdRef.current === d.incidentId) return;
        const expMs = d.expiresAt ? new Date(d.expiresAt).getTime() : Date.now() + 60000;
        if (expMs <= Date.now() || _dismissed.has(d.incidentId)) return;
        startCountdown({
          id:            d.incidentId,
          machineId:     d.machineId     ?? "",
          intruderName:  d.intruderName  ?? "Unknown",
          intruderId:    d.intruderId    ?? "",
          ownerUserId:   d.ownerUserId   ?? userId,
          ownerUserName: d.ownerUserName ?? "Unknown",
          createdAt:     d.createdAt,
          expiresAt:     new Date(d.expiresAt),
        });
      }, (e: any) => console.warn("[IncidentHandler] RTDB backup error:", e?.code ?? e?.message));
      unsubs.push(() => off(rtdbPath));

      return () => { unsubs.forEach(u => u()); clearIncident(); };
    }

    // ════════════════════════════════════════════════════════════════════════
    // ADMIN path — listens to incidentSignals/{adminUserId} (direct doc)
    // Backend writes this in handleReportIntruder() for each admin user
    // ════════════════════════════════════════════════════════════════════════
    if (isAdmin) {
      const signalRef = doc(db, "incidentSignals", userId);
      const unsub = onSnapshot(signalRef, (snap) => {
        if (!snap.exists()) { clearIncident(); return; }
        const parsed = parseSignalDoc(snap.data(), snap.id);
        if (parsed) startCountdown(parsed);
        else clearIncident();
      }, (e: any) => console.error("[IncidentHandler] admin signal read error:", e?.code ?? e?.message));
      return () => { unsub(); clearIncident(); };
    }

    // ════════════════════════════════════════════════════════════════════════
    // INTRUDER path — Firestore query where intruderId == userId
    // Security rule: allow list if request.auth.uid == resource.data.intruderId
    // ════════════════════════════════════════════════════════════════════════
    const ACTIVE = new Set(["owner_pending", "pending", "admin_pending"]);
    const q = query(collection(db, "incidents"), where("intruderId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { clearIncident(); return; }
      const now = Date.now();
      const live = snap.docs.filter((d) => {
        if (!ACTIVE.has(d.data().status ?? "")) return false;
        const ea = d.data().expiresAt;
        const ms = ea instanceof Timestamp ? ea.toDate().getTime()
          : typeof ea === "string" ? new Date(ea).getTime() : now + 1;
        return ms > now;
      });
      if (!live.length) { clearIncident(); return; }
      live.sort((a, b) =>
        ((b.data().createdAt) ?? "").localeCompare((a.data().createdAt) ?? "")
      );
      const d = live[0]; const data = d.data();
      let expiresAt: Date;
      if (data.expiresAt instanceof Timestamp)     expiresAt = data.expiresAt.toDate();
      else if (typeof data.expiresAt === "string") expiresAt = new Date(data.expiresAt);
      else                                         expiresAt = new Date(now + 60000);
      if (_dismissed.has(d.id) || expiresAt.getTime() <= now) { clearIncident(); return; }
      startCountdown({
        id:            d.id,
        machineId:     data.machineId     ?? "",
        intruderName:  data.intruderName  ?? "Unknown",
        intruderId:    data.intruderId    ?? "",
        ownerUserId:   data.ownerUserId   ?? data.nextUserId ?? "",
        ownerUserName: data.ownerUserName ?? data.nextUserName ?? "Unknown",
        createdAt:     data.createdAt,
        expiresAt,
      });
    }, (e: any) => console.error("[IncidentHandler] intruder query error:", e?.code ?? e?.message));
    return () => { unsub(); clearIncident(); };
  }, [userId, isAdmin, isIntruder, startCountdown, clearIncident, parseSignalDoc]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleNotMe = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try {
      const result = await incidentAction(incident.id, userId, "confirm_not_me");
      if (result.data?.buzzerTriggered) Alert.alert("🔔 Buzzer Activated", "The machine alarm has been triggered.");
      userDismiss();
    } catch (e: any) { Alert.alert("Error", e?.message ?? "Failed to report"); }
    finally { setLoading(false); }
  };

  const handleThatsMe = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try { await incidentAction(incident.id, userId, "thats_me"); userDismiss(); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Failed to dismiss"); }
    finally { setLoading(false); }
  };

  const handleDismissLocally = () => userDismiss();

  const handleAdminDismiss = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try { await incidentAction(incident.id, userId, "admin_dismiss"); userDismiss(); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Failed to dismiss buzzer"); }
    finally { setLoading(false); }
  };

  const handleAdminFalseAlarm = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try { await incidentAction(incident.id, userId, "admin_dismiss_false"); userDismiss(); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Failed to dismiss"); }
    finally { setLoading(false); }
  };

  return { incident, loading, handleNotMe, handleThatsMe, handleDismissLocally, handleAdminDismiss, handleAdminFalseAlarm, isAdmin: !!isAdmin };
}
