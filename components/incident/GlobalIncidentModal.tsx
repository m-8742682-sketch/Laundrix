/**
 * GlobalIncidentModal
 * Mounts in _layout.tsx — shows on ANY screen
 *
 * Role detection:
 *  - isAdmin AND incident.intruderId === user.uid  → show as INTRUDER (not admin)
 *  - isAdmin (not intruder)                        → show ADMIN modal (admin_pending only)
 *  - not admin, ownerUserId === user.uid            → show OWNER modal (owner_pending)
 *  - intruder                                       → show INTRUDER info modal (owner_pending or admin_pending)
 */

import { useUser } from '@/components/UserContext';
import { useIncidentHandler } from '@/services/useIncidentHandler';
import { stopSound } from '@/services/soundState';
import IncidentModal from './IncidentModal';

export default function GlobalIncidentModal() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  // Owner / Admin subscription
  const ownerHandler = useIncidentHandler({ userId: user?.uid, isAdmin });
  // Intruder subscription (runs in parallel — deduplicated by global dismissed set)
  const intruderHandler = useIncidentHandler({ userId: user?.uid, isIntruder: true });

  // If admin is also the intruder on the active incident → treat them as intruder
  const adminIsIntruder = isAdmin && ownerHandler.incident?.intruderId === user?.uid;

  const showOwner    = !!ownerHandler.incident && !adminIsIntruder;
  const showIntruder = adminIsIntruder
    ? true  // admin who is intruder: use intruder modal on ownerHandler's incident
    : (!showOwner && !!intruderHandler.incident);

  const activeIntruderIncident = adminIsIntruder ? ownerHandler.incident : intruderHandler.incident;
  const activeIntruderHandler  = adminIsIntruder ? ownerHandler : intruderHandler;

  const handleOwnerDismiss    = () => { stopSound(); ownerHandler.handleDismissLocally(); };
  const handleIntruderDismiss = () => { stopSound(); activeIntruderHandler.handleDismissLocally(); };

  return (
    <>
      {showOwner && (
        <IncidentModal
          visible
          machineId={ownerHandler.incident!.machineId}
          intruderName={ownerHandler.incident!.intruderName}
          intruderId={ownerHandler.incident!.intruderId}
          ownerUserName={ownerHandler.incident!.ownerUserName}
          createdAt={ownerHandler.incident!.createdAt}
          secondsLeft={ownerHandler.incident!.secondsLeft}
          isAdmin={isAdmin && !adminIsIntruder}
          onThatsMe={isAdmin ? ownerHandler.handleAdminDismiss   : ownerHandler.handleThatsMe}
          onNotMe={isAdmin   ? ownerHandler.handleAdminFalseAlarm : ownerHandler.handleNotMe}
          onDismiss={handleOwnerDismiss}
          loading={ownerHandler.loading}
        />
      )}
      {showIntruder && !!activeIntruderIncident && (
        <IncidentModal
          visible
          machineId={activeIntruderIncident.machineId}
          intruderName={activeIntruderIncident.intruderName}
          secondsLeft={activeIntruderIncident.secondsLeft}
          onThatsMe={activeIntruderHandler.handleDismissLocally}
          onNotMe={activeIntruderHandler.handleDismissLocally}
          onDismiss={handleIntruderDismiss}
          loading={activeIntruderHandler.loading}
          isIntruder
        />
      )}
    </>
  );
}
