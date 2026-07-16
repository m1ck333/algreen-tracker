import type { NotificationDto } from '@alblue/shared-types';
import { NotificationType } from '@alblue/shared-types';

/**
 * Map BE notification type → i18n template path. Mirrors the dashboard's
 * SidebarFooter map so the bell list reads in whichever language the tablet
 * is set to. The renderer falls back to the BE-provided Title/Message if a
 * template is missing or paramsJson can't be parsed.
 */
const TABLET_NOTIFICATION_TEMPLATE: Partial<Record<NotificationType, string>> = {
  [NotificationType.MaterialLowStock]: 'notificationsPage.templates.materialLowStock',
  [NotificationType.OrderActivated]: 'notificationsPage.templates.orderActivated',
  [NotificationType.ProcessCompleted]: 'notificationsPage.templates.processCompleted',
  [NotificationType.ProcessBlocked]: 'notificationsPage.templates.processBlocked',
  [NotificationType.BlockRequest]: 'notificationsPage.templates.blockRequest',
  [NotificationType.BlockRequestApproved]: 'notificationsPage.templates.blockRequestApproved',
  [NotificationType.BlockRequestRejected]: 'notificationsPage.templates.blockRequestRejected',
  [NotificationType.WorkerAutoLoggedOut]: 'notificationsPage.templates.workerAutoLoggedOut',
  [NotificationType.DeadlineWarning]: 'notificationsPage.templates.deadlineWarning',
  [NotificationType.DeadlineCritical]: 'notificationsPage.templates.deadlineCritical',
  [NotificationType.ChangeRequest]: 'notificationsPage.templates.changeRequest',
  [NotificationType.ChangeRequestApproved]: 'notificationsPage.templates.changeRequestApproved',
  [NotificationType.ChangeRequestRejected]: 'notificationsPage.templates.changeRequestRejected',
};

export function renderTabletNotificationText(
  n: NotificationDto,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { title: string; message: string } {
  const tplPath = TABLET_NOTIFICATION_TEMPLATE[n.type];
  if (tplPath && n.paramsJson) {
    try {
      const params = JSON.parse(n.paramsJson) as Record<string, unknown>;
      return {
        title: t(`${tplPath}.title`, params),
        message: t(`${tplPath}.message`, params),
      };
    } catch {
      // Fall through to BE strings.
    }
  }
  return { title: n.title, message: n.message };
}

export function buildTimeAgo(t: (key: string, opts?: Record<string, unknown>) => string) {
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('notificationsPage.timeAgo.now');
    if (mins < 60) return t('notificationsPage.timeAgo.min', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notificationsPage.timeAgo.hour', { count: hours });
    const days = Math.floor(hours / 24);
    return t('notificationsPage.timeAgo.day', { count: days });
  };
}
