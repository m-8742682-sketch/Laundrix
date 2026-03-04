/**
 * graceAlarmService
 *
 * Lightweight pub/sub state store for the current active grace period.
 * GraceAlarmModal subscribes and drives its own sound/UI.
 *
 * Viewmodels (QRScanViewModel, QueueViewModel) call:
 *   - graceAlarmService.isActive()  → boolean check
 *   - graceAlarmService.clear()     → stop local state (returns Promise for compat)
 *
 * Sound is managed by GraceAlarmModal via soundState.ts — NOT here.
 */

import { stopSound } from '@/services/soundState';

export type GraceAlarmState = {
  active: boolean;
  machineId: string;
  userId: string;
  userName: string;
  expiresAt: string;  // ISO
  startedAt: string;  // ISO
};

type Listener = (state: GraceAlarmState | null) => void;

class GraceAlarmService {
  private state: GraceAlarmState | null = null;
  private listeners: Set<Listener> = new Set();

  /**
   * Update current grace state. Called by GraceAlarmModal's RTDB subscription.
   * Passing null clears the state.
   */
  set(state: GraceAlarmState | null): void {
    this.state = state;
    this.notify();
  }

  /** Get current grace state */
  get(): GraceAlarmState | null {
    return this.state;
  }

  /** Returns true if there is an active grace period */
  isActive(): boolean {
    return this.state?.active === true;
  }

  /**
   * Clear grace state locally and stop alarm sound.
   * Returns a Promise for backwards compatibility with callers that use .catch().
   */
  async clear(): Promise<void> {
    this.state = null;
    this.notify();
    stopSound();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately on subscribe
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.state));
  }
}

export const graceAlarmService = new GraceAlarmService();
