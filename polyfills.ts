/**
 * polyfills.ts
 *
 * CRITICAL: import this at the very top of app/_layout.tsx (before any other import).
 *
 * Patches the React Native / Hermes runtime with Web APIs that LiveKit SDK requires:
 *   - Event / EventTarget (used by LiveKit's internal AbortController & emitters)
 *   - URL polyfill (used by LiveKit's WebSocket URL construction)
 *
 * Without these you get:
 *   ReferenceError: Property 'Event' doesn't exist
 *   ReferenceError: AbortController is not defined
 */

// URL polyfill — must be first
import 'react-native-url-polyfill/auto';

// Event / EventTarget polyfill
import {
  Event,
  EventTarget,
  defineEventAttribute,
} from 'event-target-shim';

if (typeof global.Event === 'undefined') {
  (global as any).Event = Event;
}
if (typeof global.EventTarget === 'undefined') {
  (global as any).EventTarget = EventTarget;
}
if (typeof global.defineEventAttribute === 'undefined') {
  (global as any).defineEventAttribute = defineEventAttribute;
}

// AbortController polyfill (if missing — older Hermes versions)
if (typeof global.AbortController === 'undefined') {
  const { AbortController, AbortSignal } = require('abortcontroller-polyfill/dist/cjs-ponyfill');
  (global as any).AbortController = AbortController;
  (global as any).AbortSignal = AbortSignal;
}
