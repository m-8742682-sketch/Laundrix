/**
 * graceAlarmService — FIXED
 *
 * Bug fixed: _stopEverything() was calling stopSound() before playSound("alarm"),
 * which created a rapid stop→start that GlobalSoundController could drop due to
 * its reconciling guard. Now _stopEverything() only clears the interval — it does
 * NOT touch soundState. Sound is managed exclusively by GraceAlarmModal's effect.
 *
 * This service is responsible only for:
 *   • Running the local countdown
 *   • Firing the expired notification
 *
 * Sound is played/stopped by GraceAlarmModal directly via soundState.
 * graceAlarmService no longer touches sound at all.
 */

import * as Notifications from "expo-notifications";

export type GraceAlarmState = {
  active: boolean;
  machineId: string;
  userId: string;
  userName: string;
  expiresAt: string;
  startedAt: string;
};

type Listener = (state: GraceAlarmState | null) => void;

class GraceAlarmService {
  private countdown: ReturnType<typeof setInterval> | null = null;
  private state: GraceAlarmState | null = null;
  private listeners: Set<Listener> = new Set();

  async start(
    machineId: string,
    userId: string,
    expiresAt: Date,
    options?: { userName?: string; startedAt?: string }
  ): Promise<void> {
    const expiresAtISO = expiresAt.toISOString();
    const userName  = options?.userName  ?? "";
    const startedAt = options?.startedAt ?? new Date().toISOString();

    // Idempotent — same grace already running
    if (
      this.state?.active &&
      this.state.machineId === machineId &&
      this.state.expiresAt === expiresAtISO
    ) return;

    // Only clear the countdown timer — do NOT call stopSound()
    this._stopCountdown();

    this.state = { active: true, machineId, userId, userName, expiresAt: expiresAtISO, startedAt };
    this.notify();
    this.startCountdown();
    // Sound is handled by GraceAlarmModal — no playSound() here
  }

  async clear(): Promise<void> {
    this._stopCountdown();
    this.state = null;
    this.notify();
    // Sound is handled by GraceAlarmModal — no stopSound() here
  }

  getState(): GraceAlarmState | null { return this.state; }
  isActive(): boolean { return this.state?.active === true; }

  getSecondsLeft(): number {
    if (!this.state) return 0;
    return Math.max(0, Math.floor((new Date(this.state.expiresAt).getTime() - Date.now()) / 1000));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async restore(): Promise<void> {}

  private notify(): void { this.listeners.forEach(l => l(this.state)); }

  private startCountdown(): void {
    this._stopCountdown();
    this.countdown = setInterval(async () => {
      if (!this.state) { clearInterval(this.countdown!); return; }
      this.notify();
      if (this.getSecondsLeft() <= 0) {
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

  private _stopCountdown(): void {
    if (this.countdown) { clearInterval(this.countdown); this.countdown = null; }
  }
}

export const graceAlarmService = new GraceAlarmService();
