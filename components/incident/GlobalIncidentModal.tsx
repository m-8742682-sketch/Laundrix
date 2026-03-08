/**
 * GlobalIncidentModal
 * Mounts in _layout.tsx — shows on ANY screen
 *
 * Button mapping:
 *  Owner:   "Yes It's Me" → handleThatsMe (dismiss), "No Report Intruder" → handleNotMe (confirm_not_me → buzzer)
 *  Admin:   "Dismiss {machineId} Buzzer" → handleThatsMe (dismiss), "Dismiss False Alarm" → handleThatsMe (dismiss)
 *  Intruder: "I Understand" → handleDismissLocally
 */

import { useUser } from '@/components/UserContext';
import { useIncidentHandler } from '@/services/useIncidentHandler';
import { stopSound } from '@/services/soundState';
import IncidentModal from './IncidentModal';

export default function GlobalIncidentModal() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  // Owner / Admin view
  const ownerHandler = useIncidentHandler({ userId: user?.uid, isAdmin });

  // Intruder view — only when no owner/admin modal is active
  const intruderHandler = useIncidentHandler({ userId: user?.uid, isIntruder: true });

  const showOwner    = !!ownerHandler.incident;
  const showIntruder = !showOwner && !!intruderHandler.incident;

  const handleOwnerDismiss = () => {
    stopSound();
    ownerHandler.handleDismissLocally();
  };

  const handleIntruderDismiss = () => {
    stopSound();
    intruderHandler.handleDismissLocally();
  };

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
          // Admin: both buttons dismiss (admin just monitors, doesn't trigger buzzer)
          // Owner: "Yes It's Me" dismisses, "No Report Intruder" triggers buzzer
          onThatsMe={ownerHandler.handleThatsMe}   // "Yes It's Me" / "Dismiss False Alarm"
          onNotMe={isAdmin ? ownerHandler.handleThatsMe : ownerHandler.handleNotMe}  // admin both dismiss; owner reports intruder
          onDismiss={handleOwnerDismiss}
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
          onDismiss={handleIntruderDismiss}
          loading={intruderHandler.loading}
          isIntruder
        />
      )}
    </>
  );
}
