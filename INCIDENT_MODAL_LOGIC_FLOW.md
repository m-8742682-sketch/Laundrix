# Incident Modal - Step-by-Step Logic Flow Diagram

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ APP STARTUP                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ app/_layout.tsx RootLayout Component Mounts                                 │
│                                                                             │
│  onAuthStateChanged(auth, (user) => {                                       │
│    if (user) {                                                              │
│      router.replace('/(tabs)/dashboard')                                    │
│    } else {                                                                │
│      router.replace('/(auth)/login')                                        │
│    }                                                                        │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ AuthProvider (UserContext.tsx) Initializes                                  │
│                                                                             │
│  [user, setUser] = useState(null)                                           │
│  [authUser, setAuthUser] = useState(null)                                   │
│                                                                             │
│  onAuthStateChanged() → setAuthUser(firebaseUser)                           │
│  onSnapshot(doc(db, "users", authUser.uid), ...) → buildUserProfile        │
│  setUser({ uid, email, name, role, ... })                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ GlobalSoundController + other overlays render                              │
│ INCLUDING: GlobalIncidentModal                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ GlobalIncidentModal Component Mounts / Re-renders                           │
│                                                                             │
│  const { user } = useUser()  ← Gets user from UserContext                   │
│                                                                             │
│  ✓ If user exists, user.uid is now available                               │
│  ✗ If user is still null, user.uid is undefined                            │
│                                                                             │
│  console.log('[GlobalIncidentModal] user:', user)                           │
│  console.log('[GlobalIncidentModal] userId:', user?.uid)                    │
│                                                                             │
│  const ownerHandler = useIncidentHandler({                                  │
│    userId: user?.uid,                                                      │
│    isAdmin                                                                  │
│  })                                                                         │
│                                                                             │
│  const intruderHandler = useIncidentHandler({                               │
│    userId: user?.uid,                                                      │
│    isIntruder: true                                                        │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
    CRITICAL MOMENT: Is user?.uid defined?
    ↙                                    ↘
   YES (user ID available)               NO (user is null/uid undefined)
    ↓                                     ↓
    ↓                                    ┌────────────────────────┐
    ↓                                    │ useIncidentHandler:    │
    ↓                                    │                        │
    ↓                                    │ if (!userId) return;   │
    ↓                                    │ ← NO Firestore sub     │
    ↓                                    │                        │
    ↓                                    │ incident stays null    │
    ↓                                    └────────────────────────┘
    ↓                                             ↓
    ↓                                    Modal won't show (❌)
    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ useIncidentHandler Hook: OWNER version                                      │
│                                                                             │
│  [incident, setIncident] = useState(null)                                   │
│                                                                             │
│  useEffect(() => {                                                         │
│    if (!userId) return;  ← userId guard                                     │
│                                                                             │
│    const q = query(                                                        │
│      collection(db, "incidents"),                                          │
│      where("ownerUserId", "==", userId)  ← Query for YOUR machine          │
│    )                                                                        │
│                                                                             │
│    const unsubscribe = onSnapshot(q, (snapshot) => {                        │
│      console.log('[useIncidentHandler] Firestore fired!')                   │
│      if (snapshot.empty) {                                                 │
│        setIncident(null)                                                   │
│      } else {                                                              │
│        const doc = snapshot.docs[0]                                        │
│        const data = doc.data()                                             │
│        console.log('[useIncidentHandler] Found incident:', data)            │
│        startCountdown({ ...data, ... })                                    │
│      }                                                                     │
│    })                                                                       │
│  }, [userId, ...])                                                         │
│                                                                             │
│  Returns: { incident, loading, ... }                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
    HAS FIRESTORE SUBSCRIPTION FIRED?
    ↙                                    ↘
   YES                                  NO
    ↓                                     ↓
    ↓                         ┌──────────────────────────────┐
    ↓                         │ Check Firestore:             │
    ↓                         │ 1. No documents match query  │
    ↓                         │ 2. Firestore permission err  │
    ↓                         │ 3. Network error             │
    ↓                         │ 4. Rules reject query        │
    ↓                         └──────────────────────────────┘
    ↓                                     ↓
    ↓                          incident = null
    ↓                          Modal won't show (❌)
    ↓
    ┌─ Does snapshot contain documents?
    ↙                                    ↘
   YES                                  NO
    ↓                                     ↓
    ↓                         setIncident(null)
    ↓                         showOwner = false
    ↓                         Modal won't show (❌)
    ↓
    ┌─ Is first document status "pending"?
    ↙                                      ↘
   YES (status === "pending")..................NO (pre_pending, resolved, etc)
    ↓                                        ↓
    ↓                        Filter excludes it
    ↓                        incident = null
    ↓                        Modal won't show (❌)
    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ startCountdown() Called                                                     │
│                                                                             │
│  playSound("urgent")                                                        │
│  Vibration.vibrate([...])                                                   │
│  setIncident({ ...doc, secondsLeft: 60 })                                   │
│                                                                             │
│  Every 1 second:                                                            │
│    secondsLeft = max(0, (expiresAt - now) / 1000)                           │
│    setIncident({ ...doc, secondsLeft })                                     │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ GlobalIncidentModal Re-evaluates                                            │
│                                                                             │
│  showOwner = !!ownerHandler.incident  ← Now TRUE                            │
│  showIntruder = !showOwner && !!intruderHandler.incident  ← FALSE           │
│                                                                             │
│  return (                                                                  │
│    <>                                                                       │
│      {showOwner && (                                                        │
│        <IncidentModal                                                       │
│          visible={true}  ← ✓ THIS IS NOW TRUE                              │
│          ... all props ...                                                  │
│        />                                                                   │
│      )}                                                                     │
│    </>                                                                      │
│  )                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ IncidentModal Component Renders                                             │
│                                                                             │
│  <Modal visible={true} transparent animationType="none" ... >               │
│    <Animated.View style={[overlayStyle, { opacity: fadeAnim }]}>            │
│      {/* Header, Body, Buttons, etc. */}                                    │
│    </Animated.View>                                                         │
│  </Modal>                                                                   │
│                                                                             │
│  ✓ MODAL SHOULD NOW BE VISIBLE                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Diagnostic Checkpoint Tree

```
CHECKPOINT 1: Does user exist?
├─ YES ✓ → Move to Checkpoint 2
└─ NO  ✗ → Fix UserContext, user?.uid is undefined


CHECKPOINT 2: Does user?.uid have a value?
├─ YES ✓ → Move to Checkpoint 3
└─ NO  ✗ → AuthProvider not setting user correctly


CHECKPOINT 3: Does useIncidentHandler enter the useEffect?
├─ YES ✓ (see console "[useIncidentHandler]") → Move to Checkpoint 4
└─ NO  ✗ → Something prevents userId from being passed


CHECKPOINT 4: Does Firestore subscription fire?
├─ YES ✓ (see console "Firestore fired") → Move to Checkpoint 5
└─ NO  ✗ → Firestore error/permissions OR no network


CHECKPOINT 5: Does snapshot contain documents?
├─ YES ✓ (snapshot.empty === false) → Move to Checkpoint 6
├─ NO  ✗ (snapshot.empty === true) → No incidents in Firestore
└─ ERR ✗ (onSnapshot error callback) → Firestore error


CHECKPOINT 6: Are documents filtered correctly?
├─ YES ✓ (status === "pending") → Move to Checkpoint 7
└─ NO  ✗ → Incident status is not "pending" (pre_pending?)


CHECKPOINT 7: Does startCountdown get called?
├─ YES ✓ (hear sound, see vibration) → Move to Checkpoint 8
└─ NO  ✗ → activeIncidentIdRef logic prevents it


CHECKPOINT 8: Is incident state set?
├─ YES ✓ (showOwner === true) → Move to Checkpoint 9
└─ NO  ✗ → setIncident not called


CHECKPOINT 9: Is visible prop true in IncidentModal?
├─ YES ✓ → Modal should show
└─ NO  ✗ → showOwner = false evaluation problem


CHECKPOINT 10: Is Modal rendering at all?
├─ YES ✓ (React DevTools shows component) → Move to Checkpoint 11
└─ NO  ✗ → GlobalIncidentModal JSX not executing


CHECKPOINT 11: Is Modal visible in UI?
├─ YES ✓ → SUCCESS! ✓
└─ NO  ✗ → Z-index or visibility issue
```

---

## Debug Commands to Run

### 1. Check if user?.uid is set
```tsx
// Add to GlobalIncidentModal.tsx
useEffect(() => {
  console.log('[GlobalIncidentModal] 🔍 DEBUG:', {
    userExists: !!user,
    userUid: user?.uid,
    userRole: user?.role,
    isAdmin: user?.role === 'admin'
  });
}, [user]);
```

### 2. Check if Firestore subscription fires
```tsx
// Add to useIncidentHandler.ts
useEffect(() => {
  if (!userId) {
    console.log('[useIncidentHandler] ⚠️ userId is falsy:', userId);
    return;
  }

  console.log('[useIncidentHandler] 🔍 Setting up subscription for:', {
    userId,
    isAdmin,
    isIntruder,
    queryType: isAdmin ? 'admin' : isIntruder ? 'intruder' : 'owner'
  });

  const unsubscribe = onSnapshot(q, (snapshot) => {
    console.log('[useIncidentHandler] 📡 Firestore snapshot received:', {
      empty: snapshot.empty,
      docCount: snapshot.docs.length,
      docs: snapshot.docs.map(d => ({
        id: d.id,
        status: d.data().status,
        ownerUserId: d.data().ownerUserId,
        machineId: d.data().machineId
      }))
    });
    
    // ... rest of onSnapshot logic
  }, (error) => {
    console.error('[useIncidentHandler] 🔴 Firestore ERROR:', error);
  });

  return () => unsubscribe();
}, [userId, ...]);
```

### 3. Check if startCountdown is called
```tsx
// Add to useIncidentHandler.ts
const startCountdown = useCallback((doc) => {
  console.log('[startCountdown] 🎬 Starting countdown for:', {
    docId: doc.id,
    machineId: doc.machineId,
    intruder: doc.intruderName,
    expiresAt: doc.expiresAt
  });
  
  // ... rest of startCountdown logic
}, [userId, isAdmin, clearIncident]);
```

### 4. Monitor incident state changes
```tsx
// Add to GlobalIncidentModal.tsx
useEffect(() => {
  console.log('[GlobalIncidentModal] 🔄 Handler state changed:', {
    ownerIncident: ownerHandler.incident?.id,
    intruderIncident: intruderHandler.incident?.id,
    showOwner,
    showIntruder,
    ownerLoading: ownerHandler.loading,
    intruderLoading: intruderHandler.loading
  });
}, [ownerHandler.incident, intruderHandler.incident, showOwner, showIntruder]);
```

---

## Expected Console Output (Working State)

```
[GlobalIncidentModal] 🔍 DEBUG: {
  userExists: true,
  userUid: "abcd1234",
  userRole: "user",
  isAdmin: false
}

[useIncidentHandler] 🔍 Setting up subscription for: {
  userId: "abcd1234",
  isAdmin: false,
  isIntruder: false,
  queryType: "owner"
}

[useIncidentHandler] 📡 Firestore snapshot received: {
  empty: false,
  docCount: 1,
  docs: [{
    id: "incident_001",
    status: "pending",
    ownerUserId: "abcd1234",
    machineId: "M-42"
  }]
}

[startCountdown] 🎬 Starting countdown for: {
  docId: "incident_001",
  machineId: "M-42",
  intruder: "Alice",
  expiresAt: 2026-03-08T15:30:45.000Z
}

[GlobalIncidentModal] 🔄 Handler state changed: {
  ownerIncident: "incident_001",
  intruderIncident: null,
  showOwner: true,
  showIntruder: false,
  ownerLoading: false,
  intruderLoading: false
}
```

---

## Expected Console Output (Not Working - Issue #1: No User)

```
[GlobalIncidentModal] 🔍 DEBUG: {
  userExists: false,
  userUid: undefined,
  userRole: undefined,
  isAdmin: false
}

[useIncidentHandler] ⚠️ userId is falsy: undefined
← NO FURTHER LOGS
← INCIDENT STAYS NULL
← MODAL DOESN'T SHOW
```

---

## Expected Console Output (Not Working - Issue #2: No Documents)

```
[GlobalIncidentModal] 🔍 DEBUG: {
  userExists: true,
  userUid: "abcd1234",
  userRole: "user",
  isAdmin: false
}

[useIncidentHandler] 🔍 Setting up subscription for: {
  userId: "abcd1234",
  isAdmin: false,
  isIntruder: false,
  queryType: "owner"
}

[useIncidentHandler] 📡 Firestore snapshot received: {
  empty: true,
  docCount: 0,
  docs: []
}
← INCIDENT STAYS NULL
← MODAL DOESN'T SHOW
```

---

## Next Action: Run This Right Now

1. **Add the debug logs** from the "Debug Commands" section above
2. **Open the app** in development mode
3. **Open the console** in your development environment
4. **Take a screenshot** of the logs
5. **Share which checkpoint fails** so we can pinpoint the exact issue
