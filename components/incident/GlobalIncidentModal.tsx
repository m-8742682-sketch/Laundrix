/**
 * GlobalIncidentModal
 *
 * Mounts in _layout.tsx so the incident modal appears on ANY screen,
 * not just dashboard/queue/admin tabs. Previously the modal only showed
 * when the user happened to be on one of those specific tabs.
 */

import { useUser } from '@/components/UserContext';
import { useIncidentHandler } from '@/services/useIncidentHandler';
import IncidentModal from './IncidentModal';

export default function GlobalIncidentModal() {
  const { user } = useUser();
  const { incident, loading, handleNotMe, handleThatsMe, isAdmin } = useIncidentHandler({
    userId: user?.uid,
    isAdmin: user?.role === 'admin',
  });

  if (!incident) return null;

  return (
    <IncidentModal
      visible
      machineId={incident.machineId}
      intruderName={incident.intruderName}
      secondsLeft={incident.secondsLeft}
      onThatsMe={handleThatsMe}
      onNotMe={handleNotMe}
      loading={loading}
      isAdmin={isAdmin}
    />
  );
}
