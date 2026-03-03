/**
 * Grace Alarm Service — Global Singleton
 *
 * FIXES:
 * 1. clear() fully resets everything — no stale countdown on next grace period
 * 2. start() always re-rings on a genuinely new grace period (new expiresAt)
 * 3. State is global — dismissing in any screen dismisses everywhere
 * 4. After scan+confirm+release+rejoin: previous countdown is wiped, fresh 5-min starts
 */

import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const STORAGE_KEY = "@grace_alarm_state";

export type GraceAlarmState = {
  active: boolean;
  machineId: string;
  userId: string;
  expiresAt: string;       // ISO string
  startedAt: string;       // ISO string
  ringSilenced: boolean;   // user tapped "Stop Ringing" but timer still running
};

type Listener = (state: GraceAlarmState | null) => void;

class GraceAlarmService {
  private sound: Audio.Sound | null = null;
  private countdown: ReturnType<typeof setInterval> | null = null;
  private state: GraceAlarmState | null = null;
  private listeners: Set<Listener> = new Set();

  // ── Boot: restore from storage ────────────────────────────────────────────
  async restore(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as GraceAlarmState;
      if (!saved.active) return;

      // Check if already expired
      if (Date.now() >= new Date(saved.expiresAt).getTime()) {
        await this.clear();
        return;
      }

      this.state = saved;
      this.notify();
      this.startCountdown();

      // Only ring if not previously silenced
      if (!saved.ringSilenced) {
        await this.startRinging();
      }
    } catch { /* ignore */ }
  }

  // ── Start a new grace period ───────────────────────────────────────────────
  async start(machineId: string, userId: string, expiresAt: Date): Promise<void> {
    const expiresAtISO = expiresAt.toISOString();

    // Idempotent: same machine, same user, same expiry → no-op
    if (
      this.state?.active &&
      this.state.machineId === machineId &&
      this.state.userId === userId &&
      this.state.expiresAt === expiresAtISO
    ) {
      return;
    }

    // Always fully stop previous before starting new
    await this._stopEverything();

    this.state = {
      active: true,
      machineId,
      userId,
      expiresAt: expiresAtISO,
      startedAt: new Date().toISOString(),
      ringSilenced: false,
    };

    await this.save();
    this.notify();
    this.startCountdown();
    await this.startRinging();
  }

  // ── User taps "Stop Ringing" — silence alarm but keep countdown ───────────
  async silenceRing(): Promise<void> {
    if (!this.state) return;
    this.state = { ...this.state, ringSilenced: true };
    await this.save();
    await this.stopRinging();
    this.notify();
  }

  // ── User scanned successfully OR dismissed → full clear ───────────────────
  async clear(): Promise<void> {
    await this._stopEverything();
    this.state = null;
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
    this.notify();
  }

  getState(): GraceAlarmState | null { return this.state; }

  isActive(): boolean { return this.state?.active === true; }

  isRingSilenced(): boolean { return this.state?.ringSilenced ?? false; }

  getSecondsLeft(): number {
    if (!this.state) return 0;
    return Math.max(0, Math.floor((new Date(this.state.expiresAt).getTime() - Date.now()) / 1000));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private notify(): void {
    this.listeners.forEach(l => l(this.state));
  }

  private async save(): Promise<void> {
    if (this.state) {
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch {}
    }
  }

  private startCountdown(): void {
    if (this.countdown) { clearInterval(this.countdown); this.countdown = null; }
    this.countdown = setInterval(async () => {
      if (!this.state) { clearInterval(this.countdown!); return; }
      const left = this.getSecondsLeft();

      // Notify listeners every second for countdown UI
      this.notify();

      if (left <= 0) {
        clearInterval(this.countdown!);
        this.countdown = null;
        await this.onExpired();
      }
    }, 1000);
  }

  private async onExpired(): Promise<void> {
    if (!this.state) return;
    const machineId = this.state.machineId;
    await this.clear();

    // Send expired notification
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Grace Period Expired",
          body: `You didn't scan Machine ${machineId} in time. Your slot has been released.`,
          data: { type: "grace_expired", machineId },
        },
        trigger: null,
      });
    } catch {}
  }

  private async startRinging(): Promise<void> {
    await this.stopRinging();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/alarm.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      this.sound = sound;
      await sound.playAsync();
    } catch { /* ignore audio errors */ }
  }

  private async stopRinging(): Promise<void> {
    if (!this.sound) return;
    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
    } catch {}
    this.sound = null;
  }

  /** Fully stop countdown + ring without touching state */
  private async _stopEverything(): Promise<void> {
    if (this.countdown) { clearInterval(this.countdown); this.countdown = null; }
    await this.stopRinging();
  }
}

export const graceAlarmService = new GraceAlarmService();
