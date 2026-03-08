/**
 * incidentAlarmService
 *
 * Lightweight pub/sub state store for the current active incident.
 * GlobalIncidentModal subscribes and drives its own sound/UI.
 *
 * Viewmodels call:
 *   - incidentAlarmService.isActive()  → boolean check
 *   - incidentAlarmService.clear()     → stop local state (returns Promise for compat)
 *
 * Sound is managed by GlobalIncidentModal via soundState.ts — NOT here.
 */

import { stopSound } from '@/services/soundState';

export type IncidentAlarmState = {
  active: boolean;
  incidentId: string;
  machineId: string;
  intruderId: string;
  intruderName: string;
  ownerUserId: string;
  ownerUserName: string;
  expiresAt: string;  // ISO
  createdAt: string;  // ISO
  isAdmin: boolean;
  isIntruder: boolean;
  isOwner: boolean;
};

type Listener = (state: IncidentAlarmState | null) => void;

class IncidentAlarmService {
  private state: IncidentAlarmState | null = null;
  private listeners: Set<Listener> = new Set();

  /**
   * Update current incident state. Called by GlobalIncidentModal's Firestore subscription.
   * Passing null clears the state.
   */
  set(state: IncidentAlarmState | null): void {
    this.state = state;
    this.notify();
  }

  /** Get current incident state */
  get(): IncidentAlarmState | null {
    return this.state;
  }

  /** Returns true if there is an active incident */
  isActive(): boolean {
    return this.state?.active === true;
  }

  /**
   * Clear the current incident state.
   * Returns Promise for compatibility with existing code.
   */
  async clear(): Promise<void> {
    this.set(null);
    stopSound();
  }

  /** Subscribe to incident state changes */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state); // immediately notify with current state
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const incidentAlarmService = new IncidentAlarmService();