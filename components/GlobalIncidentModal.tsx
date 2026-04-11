/**
 * GlobalIncidentModal
 *
 * Phase 1 (status: "pending" / "owner_pending"):
 *   Owner    → "Someone's at Your Machine" (Yes It's Me / Report Intruder)
 *   Intruder → "Your Access Was Reported"  (I Understand)
 *   Admin    → nothing (waits for owner to decide)
 *
 * Phase 2 (status: "admin_pending") — triggered only after owner presses "Report Intruder":
 *   Admin    → "Unauthorized Access Alert" (Dismiss Buzzer / False Alarm)
 *   Intruder → modal updates to admin_pending urgency
 *
 * Special: admin who IS the intruder → always shows intruder modal, not admin modal.
 */

import { useUser } from '@/components/UserContext';
import { useIncidentHandler } from '@/services/useIncidentHandler';
import { stopSound } from '@/services/soundState';
import IncidentModal from './IncidentModal';

export default function GlobalIncidentModal() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  // Owner subscription: Phase 1 (pending/owner_pending) via Firestore + RTDB bonus
  // For non-admin users only — admin has separate subscription below
  const ownerHandler = useIncidentHandler({
    userId: user?.uid,
    isAdmin: false,    // owner subscription is never admin mode
    isIntruder: false,
  });

  // Admin Phase 2 subscription: admin_pending status
  const adminHandler = useIncidentHandler({
    userId: user?.uid,
    isAdmin: isAdmin,
    isIntruder: false,
  });

  // Intruder subscription: any phase, for ALL users (admin might also be intruder)
  const intruderHandler = useIncidentHandler({
    userId: user?.uid,
    isAdmin: false,
    isIntruder: true,
  });

  // Is this admin user also the intruder on any active incident?
  const adminIsIntruder = isAdmin && !!intruderHandler.incident;
  // Admin may also be the machine owner — show owner modal instead of admin modal
  const adminIsOwner    = isAdmin && !!ownerHandler.incident;

  // ── Decide what to show ───────────────────────────────────────────────────

  // Owner modal: the machine's rightful owner (regular user OR admin who owns the machine)
  const showOwner = (!isAdmin && !!ownerHandler.incident) || adminIsOwner;

  // Admin Phase 2 modal: admin, has admin_pending incident, NOT the intruder, NOT the owner
  const showAdmin = isAdmin && !adminIsIntruder && !adminIsOwner && !!adminHandler.incident;

  // Intruder modal: current user is intruder (works for both admin-intruder and regular intruder)
  const showIntruder = !!intruderHandler.incident && !showOwner && !showAdmin;

  return (
    <>
      {/* ── Owner modal (Phase 1) ── */}
      {showOwner && !!ownerHandler.incident && (
        <IncidentModal
          visible
          machineId={ownerHandler.incident.machineId}
          intruderName={ownerHandler.incident.intruderName}
          intruderId={ownerHandler.incident.intruderId}
          ownerUserName={ownerHandler.incident.ownerUserName}
          createdAt={ownerHandler.incident.createdAt}
          secondsLeft={ownerHandler.incident.secondsLeft}
          isAdmin={false}
          onThatsMe={ownerHandler.handleThatsMe}
          onNotMe={ownerHandler.handleNotMe}
          onDismiss={() => { stopSound(); ownerHandler.handleDismissLocally(); }}
          loading={ownerHandler.loading}
        />
      )}

      {/* ── Admin modal (Phase 2 only) ── */}
      {showAdmin && !!adminHandler.incident && (
        <IncidentModal
          visible
          machineId={adminHandler.incident.machineId}
          intruderName={adminHandler.incident.intruderName}
          intruderId={adminHandler.incident.intruderId}
          ownerUserName={adminHandler.incident.ownerUserName}
          createdAt={adminHandler.incident.createdAt}
          secondsLeft={adminHandler.incident.secondsLeft}
          isAdmin={true}
          onThatsMe={adminHandler.handleAdminDismiss}
          onNotMe={adminHandler.handleAdminFalseAlarm}
          onDismiss={() => { stopSound(); adminHandler.handleDismissLocally(); }}
          loading={adminHandler.loading}
        />
      )}

      {/* ── Intruder modal (Phase 1 + 2, also admin-who-is-intruder) ── */}
      {showIntruder && !!intruderHandler.incident && (
        <IncidentModal
          visible
          machineId={intruderHandler.incident.machineId}
          intruderName={intruderHandler.incident.intruderName}
          secondsLeft={intruderHandler.incident.secondsLeft}
          onThatsMe={intruderHandler.handleDismissLocally}
          onNotMe={intruderHandler.handleDismissLocally}
          onDismiss={() => { stopSound(); intruderHandler.handleDismissLocally(); }}
          loading={intruderHandler.loading}
          isIntruder
        />
      )}
    </>
  );
}
