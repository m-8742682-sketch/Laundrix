/**
 * soundState — single source of truth for ALL app sounds
 *
 * Every sound in the app is driven by one BehaviorSubject each.
 * Only GlobalSoundController (mounted in _layout.tsx) reads these
 * and plays/stops Audio.Sound instances.
 *
 * No other component should call Audio.Sound directly EXCEPT
 * GlobalSoundController. Other components just write to these subjects.
 *
 * Sounds:
 *   calling  — incoming / outgoing ringtone  (looping)
 *   alarm    — grace period, critical alerts  (looping)
 *   urgent   — urgent alerts                  (looping, short)
 *   notify   — chat / general notification    (one-shot)
 */

import { BehaviorSubject } from "rxjs";

export type SoundType = "calling" | "alarm" | "urgent" | "notify" | null;

/** Which sound (if any) should be playing right now */
export const activeSound$ = new BehaviorSubject<SoundType>(null);

/** Helper — request a sound to play */
export const playSound = (type: SoundType) => {
  activeSound$.next(type);
};

/** Helper — stop whatever is playing */
export const stopSound = () => {
  activeSound$.next(null);
};

/**
 * Request a one-shot notify beep.
 * Because notify is non-looping, we emit "notify" then immediately
 * revert to null so the controller knows it was a one-shot.
 */
export const playNotifyBeep = () => {
  activeSound$.next("notify");
};