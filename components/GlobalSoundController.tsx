import { useEffect, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Vibration, Platform } from "react-native";
import {
  shouldPlayIncomingRingtone$,
  shouldPlayOutgoingDialTone$,
} from "@/services/callState";
import { activeSound$, SoundType, stopSound } from "@/services/soundState";
import { combineLatest } from "rxjs";

type PlayableSound = "calling" | NonNullable<SoundType>;

const SOUND_FILES = {
  calling: require("@/assets/sounds/calling.mp3"),
  alarm:   require("@/assets/sounds/alarm.mp3"),
  urgent:  require("@/assets/sounds/urgent.mp3"),
  notify:  require("@/assets/sounds/notify.mp3"),
} as const;

const LOOPING: Record<PlayableSound, boolean> = {
  calling: true,
  alarm:   true,
  urgent:  false,
  notify:  false,
};

const PRIORITY: Record<PlayableSound, number> = {
  calling: 1,
  alarm:   2,
  urgent:  3,
  notify:  4,
};

type ActiveSound = { player: AudioPlayer; type: PlayableSound };

export default function GlobalSoundController() {
  const current     = useRef<ActiveSound | null>(null);
  const reconciling = useRef(false);
  const desired     = useRef<PlayableSound | null>(null);

  const stopCurrent = () => {
    Vibration.cancel();
    const prev = current.current;
    if (!prev) return;
    current.current = null;
    try { prev.player.pause(); }  catch {}
    try { prev.player.remove(); } catch {}
  };

  const playSoundType = async (type: PlayableSound) => {
    if (current.current?.type === type) return;
    stopCurrent();
    if (desired.current !== type) return;

    try {
      // 🚀 核心修复点 2：统一使用 expo-audio 的标准跨平台属性名
      // 去掉了 IOS 和 Android 后缀，这样 TypeScript 就不会报错了
      await setAudioModeAsync({
        playsInSilentMode: true,
      });

      const player = createAudioPlayer(SOUND_FILES[type]);
      player.loop   = LOOPING[type];
      player.volume = 1.0;

      if (desired.current !== type) {
        try { player.remove(); } catch {}
        return;
      }

      current.current = { player, type };
      player.play();

      if (!LOOPING[type]) {
        const checkFinish = setInterval(() => {
          try {
            if (player.duration > 0 && player.currentTime >= player.duration - 0.1) {
              clearInterval(checkFinish);
              try { player.remove(); } catch {}
              if (current.current?.type === type) current.current = null;
              if (activeSound$.value === type) stopSound();
            }
          } catch {
            clearInterval(checkFinish);
          }
        }, 100);
      }

      if (type === "calling" && Platform.OS === "android") {
        Vibration.vibrate([500, 1000], true);
      }
    } catch (e) {
      console.error("[GlobalSound] Error playing", type, e);
    }
  };

  const reconcile = async (wantsCall: boolean, appSound: SoundType) => {
    let requested: PlayableSound | null = wantsCall ? "calling" : (appSound ?? null);

    const higherPriorityActive =
      (current.current !== null && requested !== null && PRIORITY[requested] > PRIORITY[current.current.type]) ||
      (desired.current !== null && requested !== null && PRIORITY[requested] > PRIORITY[desired.current]);
    if (higherPriorityActive) {
      return; 
    }

    desired.current = requested;
    if (reconciling.current) return;
    reconciling.current = true;

    try {
      if (requested === null) {
        stopCurrent();
      } else {
        await playSoundType(requested);
      }
    } finally {
      reconciling.current = false;
      if (desired.current !== requested) {
        reconcile(
          shouldPlayIncomingRingtone$.value || shouldPlayOutgoingDialTone$.value,
          activeSound$.value
        );
      }
    }
  };

  useEffect(() => {
    const sub = combineLatest([
      shouldPlayIncomingRingtone$,
      shouldPlayOutgoingDialTone$,
      activeSound$,
    ]).subscribe(([incoming, outgoing, appSound]) => {
      reconcile(incoming || outgoing, appSound);
    });

    return () => {
      sub.unsubscribe();
      stopCurrent();
    };
  }, []);

  return null;
}