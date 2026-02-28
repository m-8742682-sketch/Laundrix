/**
 * CallAudioController - SIMPLE VERSION
 * 
 * Just listens to boolean flags and plays/stops sound accordingly
 */

import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';
import { shouldPlayIncomingRingtone$, shouldPlayOutgoingDialTone$ } from '@/services/callState';

// Global sound instance - ONLY ONE
let currentSound: Audio.Sound | null = null;
let currentType: 'incoming' | 'outgoing' | null = null;

export default function CallAudioController() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    console.log('[CallAudio] Initializing');

    // Subscribe to incoming ring flag
    const incomingSub = shouldPlayIncomingRingtone$.subscribe((shouldPlay) => {
      console.log('[CallAudio] Incoming ring:', shouldPlay);
      if (shouldPlay) {
        playRingtone('incoming');
      } else if (currentType === 'incoming') {
        stopRingtone();
      }
    });

    // Subscribe to outgoing ring flag
    const outgoingSub = shouldPlayOutgoingDialTone$.subscribe((shouldPlay) => {
      console.log('[CallAudio] Outgoing ring:', shouldPlay);
      if (shouldPlay) {
        playRingtone('outgoing');
      } else if (currentType === 'outgoing') {
        stopRingtone();
      }
    });

    return () => {
      console.log('[CallAudio] Cleanup');
      incomingSub.unsubscribe();
      outgoingSub.unsubscribe();
      stopRingtone();
    };
  }, []);

  const playRingtone = async (type: 'incoming' | 'outgoing') => {
    try {
      // Don't play if already playing same type
      if (currentType === type && currentSound) {
        console.log('[CallAudio] Already playing', type);
        return;
      }

      // Stop any existing sound first
      await stopRingtone();

      console.log('[CallAudio] Playing', type);

      // Set audio mode BEFORE creating sound
      await Audio.setAudioModeAsync({ 
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1,
        shouldDuckAndroid: false,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/calling.mp3'),
        { 
          isLooping: true,
          volume: 1.0,
        }
      );

      currentSound = sound;
      currentType = type;
      
      await sound.playAsync();
      console.log('[CallAudio] Sound playing successfully');

      // Vibrate for incoming calls
      if (type === 'incoming' && Platform.OS === 'android') {
        Vibration.vibrate([500, 1000], true);
      }
    } catch (error) {
      console.error('[CallAudio] Play error:', error);
    }
  };

  const stopRingtone = async () => {
    try {
      Vibration.cancel();
      
      if (currentSound) {
        console.log('[CallAudio] Stopping');
        try {
          await currentSound.stopAsync();
        } catch (e) {}
        try {
          await currentSound.unloadAsync();
        } catch (e) {}
        currentSound = null;
      }
      
      currentType = null;
    } catch (error) {
      console.error('[CallAudio] Stop error:', error);
      currentSound = null;
      currentType = null;
    }
  };

  return null;
}