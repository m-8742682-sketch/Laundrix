# Incident Modal Debug Analysis

## Problem Statement
GlobalIncidentModal renders perfectly but doesn't show on the screen like the GraceAlarmModal does.

---

## Current Logic Flow

### 1. **GlobalIncidentModal.tsx** (Entry Point)
```
GlobalIncidentModal (mount in _layout.tsx)
  ├─ Gets user from UserContext
  ├─ Creates TWO useIncidentHandler hooks:
  │  ├─ ownerHandler = useIncidentHandler({ userId, isAdmin })
  │  └─ intruderHandler = useIncidentHandler({ userId, isIntruder: true })
  └─ Renders based on:
     ├─ showOwner = !!ownerHandler.incident
     └─ showIntruder = !showOwner && !!intruderHandler.incident
```

### 2. **useIncidentHandler.ts** (Logic)
```
useIncidentHandler({ userId, isAdmin, isIntruder })
  ├─ [incident, setIncident] = useState(null)
  ├─ useEffect([userId, ...])
  │  ├─ IF userId is empty/falsy: return (NO SUBSCRIPTION)
  │  ├─ Firestore query:
  │  │  ├─ Admin: where("status", "==", "pending")
  │  │  ├─ Owner: where("ownerUserId", "==", userId)
  │  │  └─ Intruder: where("intruderId", "==", userId)
  │  └─ onSnapshot(..) → startCountdown({...})
  └─ Returns { incident, loading, ... }
```

### 3. **IncidentModal.tsx** (Rendering)
```
IncidentModal
  ├─ Props: visible={should}, ...
  └─ <Modal visible={visible} ... >
     └─ Renders the modal
```

---

## ⚠️ Critical Differences from GraceAlarmModal

### GraceAlarmModal (WORKING) ✓
```tsx
const [isReady, setIsReady] = useState(false);
const shouldShow = isReady && !graceEnded && (isMyTurn || isAdmin) && !isDismissed;

if (!shouldShow) return null;  // ← GUARD: Don't render until ready

return <Modal visible transparent ... >
```
- ✓ Waits for Firestore subscription to fire FIRST (`isReady` flag)
- ✓ Only then renders the Modal
- ✓ Has explicit ready check before any rendering

### GlobalIncidentModal (ISSUE?) ✗
```tsx
const showOwner    = !!ownerHandler.incident;
const showIntruder = !showOwner && !!intruderHandler.incident;

return (
  <>
    {showOwner && <IncidentModal visible ... />}
    {showIntruder && <IncidentModal visible ... />}
  </>
)
```
- ✗ NO "ready" guard - components always render
- ✗ `showOwner` is `false` when `incident === null`
- ✗ IncidentModal receives `visible={false}` on mount
- ✗ But Modal STILL gets added to the React tree!

---

## 🔍 Potential Issues (In Order of Likelihood)

### Issue #1: **userId is NOT being passed correctly**
**Symptom:** Firestore subscription never starts
**Root Cause:** `user?.uid` might be undefined or empty string when GlobalIncidentModal mounts

**Debug Check:**
```tsx
// Add to GlobalIncidentModal
console.log('[GlobalIncidentModal] user:', user);
console.log('[GlobalIncidentModal] userId:', user?.uid);
console.log('[GlobalIncidentModal] showOwner:', showOwner);
console.log('[GlobalIncidentModal] showIntruder:', showIntruder);
```

**Expected:** `user?.uid` = "some-user-id-string"  
**If Issue:** `user?.uid` = undefined or empty string

---

### Issue #2: **Firestore subscription is not firing**
**Symptom:** Subscription runs but `onSnapshot` callback never fires
**Root Cause:** No matching documents OR Firestore permission issue

**Debug Check in useIncidentHandler:**
```tsx
useEffect(() => {
  if (!userId) {
    console.log('[useIncidentHandler] userId empty, skipping subscription');
    return;
  }

  console.log('[useIncidentHandler] Setting up subscription for userId:', userId);

  const unsubscribe = onSnapshot(q, (snapshot) => {
    console.log('[useIncidentHandler] Firestore fired!');
    console.log('  snapshot.empty:', snapshot.empty);
    console.log('  snapshot.docs.length:', snapshot.docs.length);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      console.log('  First incident:', data);
    }
  }, error => {
    console.error('[useIncidentHandler] Firestore error:', error);
  });
}, [userId, ...]);
```

**Expected:** Console should show multiple snapshots with documents  
**If Issue:** Console shows nothing OR error about permissions

---

### Issue #3: **Modal is rendered but z-index/visibility issue**
**Symptom:** Modal exists in DOM but not visible (hidden behind other elements)
**Root Cause:** Another component has higher z-index

**Debug Check:**
```tsx
// In GlobalIncidentModal
return (
  <>
    {showOwner && (
      <View style={{ position: 'absolute', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <IncidentModal visible ... />
      </View>
    )}
  </>
)
```

**Expected:** Modal appears on top  
**If Changes:** Modal becomes visible → z-index issue

---

### Issue #4: **The incident document exists but doesn't match the query**
**Symptom:** Firestore has incidents but they're not "pending" status
**Root Cause:** Status is "pre_pending" or something else

**Firebase Function:**
```typescript
// Check incidents collection directly:
// - For owner: Look for docs with ownerUserId=uid AND status="pending"
// - For admin: Look for any docs with status="pending"
// - For intruder: Look for docs with intruderId=uid (any status)
```

---

## 🛠️ Testing Strategy

### Step 1: Add Debug Logs
Add console.logs to trace the data flow:
1. **GlobalIncidentModal mount** - check user?.uid
2. **useIncidentHandler effect** - check subscription setup
3. **Firestore onSnapshot** - check if callback fires
4. **incident state update** - check if incident object is set

### Step 2: Create Test Data
Manually create an incident in Firestore:
```
Collection: incidents
Document: test-incident-001
Fields:
  ownerUserId: "<YOUR-UID>"
  intruderId: "<ANOTHER-UID>"
  intruderName: "Test Intruder"
  machineId: "M-001"
  status: "pending"
  expiresAt: <Date 2 minutes from now>
  createdAt: <Now>
```

### Step 3: Open App & Monitor
1. Open app
2. Open Developer Console (npx expo run:android --device with dev tools)
3. Filter logs for "[GlobalIncidentModal]" and "[useIncidentHandler]"
4. Check if subscription fires
5. Check if incident object appears
6. Check if modal shows

---

## 🎯 Next Steps (What to Check First)

1. **Run your app and check the console**
   - Do you see "[GlobalIncidentModal] user:" logs?
   - Is userId present?

2. **Check Firestore**
   - Navigate to Firebase Console → Firestore Database
   - Look at the "incidents" collection
   - Filter for your userId as ownerUserId AND status="pending"
   - Are there any documents?

3. **Check if subscription fires**
   - Add the debug logs from Issue #2
   - Create a test incident with exact timestamps
   - Watch the console for "Firestore fired!" log

4. **If Firestore works, check Modal**
   - Is the `visible` prop being passed correctly?
   - Does `showOwner` evaluate to true?

---

## 📋 Comparison: GraceAlarmModal vs GlobalIncidentModal

| Aspect | GraceAlarmModal | GlobalIncidentModal |
|--------|---|---|
| **Ready Guard** | ✓ `if (!shouldShow) return null;` | ✗ Always renders JSX |
| **Data Source** | Realtime Database (RTDB) | Firestore |
| **Dismissed Tracking** | Module-level Set | Not applicable yet |
| **Modal Type** | Single Modal per user | Two conditional Modals |
| **Visibility Logic** | `shouldShow` flag | `!!incident` check |
| **Error Handling** | Firestore errors logged | Error handling present |

---

## 🔑 Key Insight

**The issue is likely NOT in IncidentModal rendering logic itself.**  
**It's likely IN the data flow:**
1. User not being passed correctly
2. Firestore subscription not firing
3. Incident object never being set
4. Query not matching any documents

**START BY ADDING LOGS** to trace where the data stops flowing.
