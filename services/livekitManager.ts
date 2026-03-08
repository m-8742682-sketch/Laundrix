/**
 * LiveKit Manager - Professional Architecture
 * 
 * Based on LiveKit official best practices:
 * - Room singleton pattern with proper lifecycle management
 * - Connection guards to prevent race conditions
 * - Proper cleanup and error handling
 * - Background audio support for calls
 */

import { Room, RoomOptions, RoomEvent } from 'livekit-client';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { BehaviorSubject, Observable } from 'rxjs';

// Room state management
export interface RoomState {
  room: Room | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
}

// Professional room state management
const roomState$ = new BehaviorSubject<RoomState>({
  room: null,
  isConnecting: false,
  isConnected: false,
  error: null,
  connectionState: 'disconnected'
});

// Room singletons with proper isolation
let _voiceRoom: Room | null = null;
let _videoRoom: Room | null = null;
let _voiceConnectionPromise: Promise<void> | null = null;
let _videoConnectionPromise: Promise<void> | null = null;

// Connection locks to prevent race conditions
let _voiceConnecting = false;
let _videoConnecting = false;

/**
 * Get or create voice room singleton
 * Follows LiveKit best practices for room lifecycle
 */
export function getVoiceRoom(): Room {
  if (!_voiceRoom || _voiceRoom.state === 'disconnected') {
    const options: RoomOptions = {
      adaptiveStream: true,
      dynacast: true,
      reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
          // Exponential backoff with max retries
          if (context.retryCount >= 5) return null;
          return Math.min((context.retryCount + 1) * 2000, 30000);
        }
      },
      // Optimize for voice calls
      publishDefaults: {
        audioPreset: {
          maxBitrate: 24000,
          maxFramerate: 1
        }
      }
    };
    
    _voiceRoom = new Room(options);
    _setupRoomEventHandlers(_voiceRoom, 'voice');
  }
  return _voiceRoom;
}

/**
 * Get or create video room singleton
 * Separate from voice to allow concurrent calls
 */
export function getVideoRoom(): Room {
  if (!_videoRoom || _videoRoom.state === 'disconnected') {
    const options: RoomOptions = {
      adaptiveStream: true,
      dynacast: true,
      reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
          if (context.retryCount >= 5) return null;
          return Math.min((context.retryCount + 1) * 2000, 30000);
        }
      },
      // Optimize for video calls
      publishDefaults: {
        audioPreset: {
          maxBitrate: 48000,
          maxFramerate: 1
        },
        videoPreset: {
          maxBitrate: 1500000,
          maxFramerate: 30
        }
      }
    };
    
    _videoRoom = new Room(options);
    _setupRoomEventHandlers(_videoRoom, 'video');
  }
  return _videoRoom;
}

/**
 * Setup room event handlers following LiveKit best practices
 */
function _setupRoomEventHandlers(room: Room, type: 'voice' | 'video'): void {
  room.on(RoomEvent.Connected, () => {
    console.log(`[LiveKit] ${type} room connected`);
    _updateRoomState({
      room,
      isConnected: true,
      isConnecting: false,
      connectionState: 'connected',
      error: null
    });
  });

  room.on(RoomEvent.Disconnected, (reason) => {
    console.log(`[LiveKit] ${type} room disconnected:`, reason);
    _updateRoomState({
      room: null,
      isConnected: false,
      isConnecting: false,
      connectionState: 'disconnected',
      error: null
    });
  });

  room.on(RoomEvent.Reconnecting, () => {
    console.log(`[LiveKit] ${type} room reconnecting`);
    _updateRoomState({
      connectionState: 'reconnecting'
    });
  });

  room.on(RoomEvent.Reconnected, () => {
    console.log(`[LiveKit] ${type} room reconnected`);
    _updateRoomState({
      connectionState: 'connected'
    });
  });

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    console.log(`[LiveKit] ${type} room connection state:`, state);
  });

  room.on(RoomEvent.Error, (error) => {
    console.error(`[LiveKit] ${type} room error:`, error);
    _updateRoomState({
      error: error.message,
      connectionState: 'error'
    });
  });
}

/**
 * Professional room connection with proper guards
 * Prevents the "cannot send signal before connected" error
 */
export async function connectRoom(
  room: Room, 
  url: string, 
  token: string,
  type: 'voice' | 'video'
): Promise<void> {
  
  // Connection guard - prevent race conditions
  const isConnecting = type === 'voice' ? _voiceConnecting : _videoConnecting;
  if (isConnecting) {
    console.warn(`[LiveKit] ${type} room already connecting, skipping duplicate`);
    return;
  }

  // Set connection flag
  if (type === 'voice') {
    _voiceConnecting = true;
  } else {
    _videoConnecting = true;
  }

  try {
    _updateRoomState({
      isConnecting: true,
      connectionState: 'connecting'
    });

    // Ensure proper cleanup before connection
    if (room.state !== 'disconnected') {
      await room.disconnect();
      await _sleep(300); // Allow WebRTC teardown
    }

    // Configure audio session for calls
    await _configureAudioSession(type);

    // Connect to room
    await room.connect(url, token, { 
      autoSubscribe: true,
      maxRetries: 3
    });

    console.log(`[LiveKit] ${type} room connected successfully`);
    
  } catch (error: any) {
    console.error(`[LiveKit] ${type} room connection failed:`, error);
    _updateRoomState({
      error: error.message,
      connectionState: 'error'
    });
    throw error;
  } finally {
    // Clear connection flag
    if (type === 'voice') {
      _voiceConnecting = false;
    } else {
      _videoConnecting = false;
    }
  }
}

/**
 * Professional room disconnection with proper cleanup
 */
export async function disconnectRoom(room: Room, type: 'voice' | 'video'): Promise<void> {
  try {
    console.log(`[LiveKit] Disconnecting ${type} room`);
    
    // Disable tracks before disconnect
    if (room.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(false);
      if (type === 'video') {
        await room.localParticipant.setCameraEnabled(false);
      }
    }

    // Disconnect room
    await room.disconnect();
    
    // Clear room reference
    if (type === 'voice') {
      _voiceRoom = null;
    } else {
      _videoRoom = null;
    }

    // Stop audio session
    await AudioSession.stopAudioSession();
    
    console.log(`[LiveKit] ${type} room disconnected successfully`);
    
  } catch (error) {
    console.error(`[LiveKit] ${type} room disconnect error:`, error);
    throw error;
  }
}

/**
 * Configure audio session based on call type
 */
async function _configureAudioSession(type: 'voice' | 'video'): Promise<void> {
  try {
    await AudioSession.startAudioSession();
    
    const config = {
      android: {
        preferredOutputList: type === 'voice' ? ['earpiece', 'speaker'] : ['speaker'],
        audioTypeOptions: AndroidAudioTypePresets.communication
      },
      ios: {
        defaultOutput: type === 'voice' ? 'earpiece' : 'speaker'
      }
    };
    
    await AudioSession.configureAudio(config);
    console.log(`[LiveKit] Audio session configured for ${type}`);
    
  } catch (error) {
    console.error('[LiveKit] Audio session configuration failed:', error);
    throw error;
  }
}

/**
 * Update room state professionally
 */
function _updateRoomState(updates: Partial<RoomState>): void {
  const current = roomState$.value;
  roomState$.next({ ...current, ...updates });
}

/**
 * Sleep utility
 */
function _sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current room state observable
 */
export function getRoomState(): Observable<RoomState> {
  return roomState$.asObservable();
}

/**
 * Get current room state value
 */
export function getCurrentRoomState(): RoomState {
  return roomState$.value;
}

/**
 * Reset all rooms - emergency cleanup
 */
export async function resetAllRooms(): Promise<void> {
  console.log('[LiveKit] Resetting all rooms');
  
  const promises: Promise<void>[] = [];
  
  if (_voiceRoom && _voiceRoom.state !== 'disconnected') {
    promises.push(disconnectRoom(_voiceRoom, 'voice'));
  }
  
  if (_videoRoom && _videoRoom.state !== 'disconnected') {
    promises.push(disconnectRoom(_videoRoom, 'video'));
  }
  
  await Promise.all(promises);
  
  // Clear all references
  _voiceRoom = null;
  _videoRoom = null;
  _voiceConnectionPromise = null;
  _videoConnectionPromise = null;
  _voiceConnecting = false;
  _videoConnecting = false;
  
  // Reset state
  _updateRoomState({
    room: null,
    isConnecting: false,
    isConnected: false,
    error: null,
    connectionState: 'disconnected'
  });
  
  console.log('[LiveKit] All rooms reset successfully');
}

// Export for external use
export { Room, RoomEvent } from 'livekit-client';