/**
 * GlobalIncidentModal
 *
 * Mounts in _layout.tsx so the incident modal appears on ANY screen.
 *
 * Three audiences — each gets a different modal view:
 *  1. Owner (ownerUserId === me)   → "Someone's at your machine — That's Me / Report"
 *  2. Intruder (intruderId === me) → "Not Your Turn — wait or leave"
 *  3. Admin                        → "Unauthorized Alert — Trigger Alarm / Dismiss"
 */

import { useUser } from '@/components/UserContext';
import { useIncidentHandler } from '@/services/useIncidentHandler';
import IncidentModal from './IncidentModal';

export default function GlobalIncidentModal() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  // Owner / Admin view (owner sees their machine being intruded on)
  const ownerHandler = useIncidentHandler({
    userId: user?.uid,
    isAdmin,
  });

  // Intruder view (this user triggered an incident on someone else's machine)
  const intruderHandler = useIncidentHandler({
    userId: user?.uid,
    isIntruder: true,
  });

  // Admin already sees everything via ownerHandler (isAdmin=true queries all)
  // Intruder modal takes lower priority — only show if no owner/admin modal is active
  const showOwner   = !!ownerHandler.incident;
  const showIntruder = !showOwner && !!intruderHandler.incident;

  return (
    <>
      {showOwner && (
        <IncidentModal
          visible
          machineId={ownerHandler.incident!.machineId}
          intruderName={ownerHandler.incident!.intruderName}
          secondsLeft={ownerHandler.incident!.secondsLeft}
          onThatsMe={ownerHandler.handleThatsMe}
          onNotMe={ownerHandler.handleNotMe}
          loading={ownerHandler.loading}
          isAdmin={isAdmin}
        />
      )}
      {showIntruder && (
        <IncidentModal
          visible
          machineId={intruderHandler.incident!.machineId}
          intruderName={intruderHandler.incident!.intruderName}
          secondsLeft={intruderHandler.incident!.secondsLeft}
          onThatsMe={intruderHandler.handleDismissLocally}
          onNotMe={intruderHandler.handleDismissLocally}
          loading={intruderHandler.loading}
          isIntruder
        />
      )}
    </>
  );
}
