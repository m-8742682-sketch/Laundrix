/**
 * GlobalSoundController
 *
 * THE ONLY component that touches Audio.Sound in the entire app.
 * Mounted once in _layout.tsx.
 *
 * Sound priority (highest wins):
 *   1. calling  — incoming/outgoing ringtone (looping)
 *   2. alarm    — grace period / critical    (looping)
 *   3. urgent   — urgent alerts              (one-shot)
 *   4. notify   — chat / general             (one-shot)
 *
 * All other components just call playSound() / stopSound() from soundState.ts.
 * Call ringtones are driven by callState.shouldPlayIncomingRingtone$ etc.
 */

import { useEffect, useRef } from "react";
import { Audio } from "expo-av";
import { Vibration, Platform } from "react-native";
import {
  shouldPlayIncomingRingtone$,
  shouldPlayOutgoingDialTone$,
} from "@/services/callState";
import { activeSound$, SoundType, stopSound } from "@/services/soundState";
import { combineLatest } from "rxjs";

type SoundState = {
  sound: Audio.Sound;
  type: NonNullable<SoundType> | "calling";
};

const SOUND_FILES = {
  calling: require("@/assets/sounds/calling.mp3"),
  alarm:   require("@/assets/sounds/alarm.mp3"),
  urgent:  require("@/assets/sounds/urgent.mp3"),
  notify:  require("@/assets/sounds/notify.mp3"),
} as const;

const LOOPING = {
  calling: true,
  alarm:   true,
  urgent:  false,
  notify:  false,
} as const;

export default function GlobalSoundController() {
  // Use a ref so async callbacks always see the latest value
  const current = useRef<SoundState | null>(null);
  // Prevent overlapping reconcile calls
  const reconciling = useRef(false);
  // Latest desired sound — set synchronously, acted on asynchronously
  const desired = useRef<"calling" | NonNullable<SoundType> | null>(null);

  const stopCurrent = async () => {
    Vibration.cancel();
    const prev = current.current;
    if (!prev) return;
    current.current = null;
    try { await prev.sound.stopAsync(); } catch {}
    try { await prev.sound.unloadAsync(); } catch {}
  };

  const playSoundType = async (type: "calling" | NonNullable<SoundType>) => {
    // Already playing this exact type — nothing to do
    if (current.current?.type === type) return;

    await stopCurrent();

    // Check if desired changed while we were stopping
    if (desired.current !== type) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const looping = LOOPING[type];
      const { sound } = await Audio.Sound.createAsync(
        SOUND_FILES[type],
        { isLooping: looping, volume: 1.0 }
      );

      // Check again — may have changed during createAsync (which is slow)
      if (desired.current !== type) {
        sound.unloadAsync().catch(() => {});
        return;
      }

      current.current = { sound, type };
      await sound.playAsync();

      // One-shot: auto-cleanup when finished
      if (!looping) {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            if (current.current?.type === type) current.current = null;
            if (activeSound$.value === type) stopSound();
          }
        });
      }

      // Vibrate for incoming calls on Android
      if (type === "calling" && Platform.OS === "android") {
        Vibration.vibrate([500, 1000], true);
      }
    } catch (e) {
      console.error("[GlobalSound] Error playing", type, e);
    }
  };

  const reconcile = async (
    wantsCall: boolean,
    appSound: SoundType
  ) => {
    // Compute what we want based on priority
    let want: "calling" | NonNullable<SoundType> | null = null;
    if (wantsCall) {
      want = "calling";
    } else if (appSound) {
      want = appSound;
    }

    desired.current = want;

    // Prevent concurrent reconcile runs
    if (reconciling.current) return;
    reconciling.current = true;

    try {
      if (want === null) {
        await stopCurrent();
      } else {
        await playSoundType(want);
      }
    } finally {
      reconciling.current = false;

      // If desired changed while we were running, reconcile again
      if (desired.current !== want) {
        reconcile(
          shouldPlayIncomingRingtone$.value || shouldPlayOutgoingDialTone$.value,
          activeSound$.value
        );
      }
    }
  };

  useEffect(() => {
    // Combine all three signal sources into one stream
    const sub = combineLatest([
      shouldPlayIncomingRingtone$,
      shouldPlayOutgoingDialTone$,
      activeSound$,
    ]).subscribe(([incoming, outgoing, appSound]) => {
      const wantsCall = incoming || outgoing;
      reconcile(wantsCall, appSound);
    });

    return () => {
      sub.unsubscribe();
      stopCurrent();
    };
  }, []);

  return null;
}