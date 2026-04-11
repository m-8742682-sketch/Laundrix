/**
 * appState.ts — Global app-level state flags
 *
 * isDashboardReady$ — becomes true when the dashboard tab mounts for the
 * first time after login.  NotificationPopup subscribes to this so it never
 * fires popups on auth / info screens.
 */
import { BehaviorSubject } from 'rxjs';

export const isDashboardReady$ = new BehaviorSubject<boolean>(false);

export const setDashboardReady = () => {
  if (!isDashboardReady$.value) isDashboardReady$.next(true);
};

export const resetDashboardReady = () => {
  isDashboardReady$.next(false);
};
