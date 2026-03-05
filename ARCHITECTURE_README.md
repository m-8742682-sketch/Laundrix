# Laundrix — Voice & Video Call Architecture

> **Production-grade LiveKit + React Native architecture for zero-crash, zero-race-condition calling.**

---

## 1. Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CALL FLOW OVERVIEW                          │
│                                                                 │
│  Caller (A)                           Receiver (B)             │
│  ─────────                            ──────────               │
│  voice-outgoing / video-outgoing      FCM push (system level)  │
│       │                                    │                   │
│       │  Firestore: calls/{callId}         ▼                   │
│       │  status: "calling"          voice-incoming overlay      │
│       │                                    │                   │
│       │◄──── B accepts ────────────────────┤                   │
│       │  status: "connected"               │                   │
│       ▼                                    ▼                   │
│  voice-call (LiveKit room)         voice-call (LiveKit room)   │
│       │                                    │                   │
│       └────── WebRTC via LiveKit SFU ──────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Critical Polyfills (MUST apply first)

LiveKit SDK internally uses Web APIs (`Event`, `EventTarget`, `AbortController`) that do NOT exist in React Native's Hermes/JSC engine. Without these, you get:

```
ReferenceError: Property 'Event' doesn't exist
```

**Fix — add to the very top of `app/_layout.tsx` (before any imports):**

```ts
// polyfills.ts — imported first in _layout.tsx
import 'react-native-url-polyfill/auto';

// Patch global Event for LiveKit / AbortController
if (typeof global.Event === 'undefined') {
  (global as any).Event = class Event {
    type: string;
    constructor(type: string) { this.type = type; }
  };
}
if (typeof global.EventTarget === 'undefined') {
  const { EventTarget } = require('event-target-shim');
  (global as any).EventTarget = EventTarget;
}
```

**Required packages:**
```bash
npx expo install react-native-url-polyfill event-target-shim
```

---

## 3. Room Singleton Pattern

**Never** create a `new Room()` inside a component render cycle. Always use module-level singletons:

```ts
// ✅ CORRECT — module level, survives minimize/maximize
let _voiceRoom: Room | null = null;
let _videoRoom: Room | null = null;

export function getVoiceRoom(): Room {
  if (!_voiceRoom || _voiceRoom.state === 'disconnected') {
    _voiceRoom = new Room({ adaptiveStream: true, dynacast: true });
  }
  return _voiceRoom;
}

// ❌ WRONG — creates new Room on every render
function MyComponent() {
  const room = new Room(); // CRASH: double WebRTC negotiation
}
```

---

## 4. Connection Guard (Prevents Race Conditions)

The bug `cannot send signal request before connected` happens when disconnect is called before connect finishes. Solution: connection state lock.

```ts
// In callState.ts
let _isConnecting = false;
let _connectAbort: (() => void) | null = null;

export async function connectRoom(room: Room, url: string, token: string) {
  if (_isConnecting) {
    console.warn('[LiveKit] Already connecting, aborting duplicate');
    return;
  }
  if (room.state === 'connected') return; // already good (maximize case)

  _isConnecting = true;
  try {
    if (room.state !== 'disconnected') {
      await room.disconnect();
      await sleep(300); // let WebRTC fully teardown
    }
    await room.connect(url, token, { autoSubscribe: true });
  } finally {
    _isConnecting = false;
  }
}
```

---

## 5. Lifecycle: Minimize vs Real End

```
[Screen mounts] → connect room
       │
[User minimizes] → set isMinimizing=true → navigate back
       │                └─ cleanup: DO NOT disconnect (room stays live)
       │
[User maximizes] → room.state === 'connected' → skip reconnect
       │
[User ends call] → set isMinimizing=false → disconnect room → null singleton
```

```ts
const isMinimizing = useRef(false);

useEffect(() => {
  return () => {
    // Only disconnect on REAL end, not minimize
    if (!isMinimizing.current) {
      room.disconnect().catch(() => {});
      AudioSession.stopAudioSession().catch(() => {});
    }
  };
}, []);
```

---

## 6. Ping Timeout / Background Heartbeat

The `ping timeout triggered` error means the WebSocket heartbeat failed. Causes:
1. **App in background** — Android/iOS freeze JS thread
2. **Unstable network** — reconnect handles this automatically

**Fixes:**

**Android — Foreground Service:**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

<service
  android:name="expo.modules.notifications.service.ExpoNotificationPresentationService"
  android:foregroundServiceType="microphone" />
```

**iOS — Background Audio:**
```json
// app.json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": ["audio", "voip", "remote-notification"]
    }
  }
}
```

**LiveKit reconnect config (in Room options):**
```ts
const room = new Room({
  adaptiveStream: true,
  dynacast: true,
  reconnectPolicy: {
    nextRetryDelayInMs: (context) => {
      if (context.retryCount >= 5) return null; // give up after 5 tries
      return (context.retryCount + 1) * 2000;
    }
  }
});
```

---

## 7. useEffect Infinite Loop Prevention

The `Maximum update depth exceeded` error in video call happens when objects/arrays are in `useEffect` deps.

**Rules:**
- Never put `{}` or `[]` literals in deps
- Use `useMemo` for derived objects that go in deps
- Use functional state updates (`prev => ...`) to avoid closures over stale state
- For SDK event listeners: register once in `[]` dep effect, use refs for values

```ts
// ❌ WRONG
const opts = { video: true, audio: true };
useEffect(() => { connect(opts); }, [opts]); // NEW object every render!

// ✅ CORRECT
const optsRef = useRef({ video: true, audio: true });
useEffect(() => { connect(optsRef.current); }, []); // stable ref
```

---

## 8. Background / Killed App Notifications

```
┌───────────────────────────────────────────────────────────────┐
│ NOTIFICATION DELIVERY CHAIN                                   │
│                                                               │
│  Backend (Vercel)                                             │
│     │                                                         │
│     ▼  FCM data message (priority: high, content_available)  │
│  Firebase Cloud Messaging                                     │
│     │                                                         │
│     ├──► Android: System tray notification (always works)     │
│     │    + setBackgroundMessageHandler wakes Headless JS      │
│     │                                                         │
│     └──► iOS: APNs → VoIP push (CallKit) for calls           │
│              + regular APNs for other notifications           │
│                                                               │
│  App killed state:                                            │
│     getInitialNotification() → handles tap on open           │
│                                                               │
│  App background state:                                        │
│     onNotificationOpenedApp() → handles tap                   │
│                                                               │
│  App foreground state:                                        │
│     setNotificationHandler → banner + sound                   │
│     onMessage() → local notification                          │
└───────────────────────────────────────────────────────────────┘
```

**FCM payload structure for calls:**
```json
{
  "to": "<fcm_token>",
  "priority": "high",
  "content_available": true,
  "data": {
    "type": "voice_call",
    "callId": "call-xxx",
    "callerId": "uid-xxx",
    "callerName": "John"
  },
  "notification": {
    "title": "📞 Incoming Call",
    "body": "John is calling you",
    "android": { "channel_id": "calls", "priority": "max" }
  }
}
```

---

## 9. Notification Settings Architecture

| Setting Key | What it controls |
|-------------|-----------------|
| `allNotifications` | Master toggle — allows all OS notifications |
| `machineReady` | Grace modal popup + alarm sound |
| `queueReminders` | Notify when position ≤ 2 in queue |
| `queueRing` | Alarm sound when your turn arrives |
| `incomingCalls` | Call notifications (incoming call FCM) |
| `chatMessages` | Chat message notifications |
| `systemAlerts` | Unauthorized access alerts |
| `doNotDisturb` | Suppress all sounds (visual only) |

All settings stored in Firestore `users/{uid}/settings` AND AsyncStorage for offline access.

---

## 10. File Structure

```
app/
  _layout.tsx          ← Global overlays + polyfills here
  call/
    _IncomingCallOverlay.tsx   ← Global incoming banner
    _OutgoingCallOverlay.tsx   ← Global outgoing banner
    _ActiveCallOverlay.tsx     ← Global active call banner
    voice-incoming.tsx         ← Full screen incoming voice
    voice-outgoing.tsx         ← Full screen outgoing voice
    voice-call.tsx             ← Active voice call
    video-incoming.tsx         ← Full screen incoming video
    video-outgoing.tsx         ← Full screen outgoing video
    video-call.tsx             ← Active video call

services/
  callState.ts          ← Single source of truth for all call state
  notification.service.ts

components/
  GraceAlarmModal.tsx
  incident/
    IncidentModal.tsx          ← Machine owner: "Is this you?"
    UnauthorizedModal.tsx      ← Intruder: "You're at a reserved machine"
    AdminIncidentModal.tsx     ← Admin: real-time buzzer control

app/(settings)/
  notifications_settings.tsx  ← Full notification preferences
```

---

## 11. Known LiveKit + React Native Gotchas

| Error | Cause | Fix |
|-------|-------|-----|
| `Property 'Event' doesn't exist` | Missing polyfill | Add event-target-shim |
| `cannot send signal before connected` | Disconnect before connect | Add connection lock |
| `Cannot read 'client' of undefined` | Async task on unmounted component | Use cleanup flags |
| `could not createOffer with closed peer` | Room reused after disconnect | Reset singleton after disconnect |
| `ping timeout` | App backgrounded | Foreground service + background audio |
| `Maximum update depth exceeded` | Object/func in useEffect deps | Use refs, useMemo, functional updates |
