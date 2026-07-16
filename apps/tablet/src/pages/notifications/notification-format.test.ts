import { describe, it, expect } from 'vitest';
import type { NotificationDto } from '@alblue/shared-types';
import { NotificationType } from '@alblue/shared-types';
import { renderTabletNotificationText, buildTimeAgo } from './notification-format';

// Echo translator: returns the key, appending the interpolation params so the
// test can assert both the template path AND that params were threaded through.
const t = (key: string, opts?: Record<string, unknown>): string =>
  opts ? `${key}::${JSON.stringify(opts)}` : key;

const notif = (over: Partial<NotificationDto>): NotificationDto => ({
  id: 'n1',
  userId: 'u1',
  type: NotificationType.OrderActivated,
  title: 'BE title',
  message: 'BE message',
  referenceType: null,
  referenceId: null,
  isRead: false,
  createdAt: '2026-07-03T10:00:00Z',
  paramsJson: null,
  ...over,
});

describe('renderTabletNotificationText', () => {
  it('renders the i18n template with parsed params when paramsJson is valid', () => {
    const result = renderTabletNotificationText(
      notif({ type: NotificationType.OrderActivated, paramsJson: '{"code":"100"}' }),
      t,
    );
    expect(result.title).toBe('notificationsPage.templates.orderActivated.title::{"code":"100"}');
    expect(result.message).toBe(
      'notificationsPage.templates.orderActivated.message::{"code":"100"}',
    );
  });

  it('falls back to BE title/message when paramsJson is malformed (no throw)', () => {
    const result = renderTabletNotificationText(
      notif({ type: NotificationType.OrderActivated, paramsJson: '{not valid json' }),
      t,
    );
    expect(result).toEqual({ title: 'BE title', message: 'BE message' });
  });

  it('falls back to BE strings when there is no template for the type', () => {
    const result = renderTabletNotificationText(
      notif({ type: NotificationType.SubscriptionExpiring, paramsJson: '{"code":"100"}' }),
      t,
    );
    expect(result).toEqual({ title: 'BE title', message: 'BE message' });
  });

  it('falls back to BE strings when paramsJson is absent', () => {
    const result = renderTabletNotificationText(
      notif({ type: NotificationType.OrderActivated, paramsJson: null }),
      t,
    );
    expect(result).toEqual({ title: 'BE title', message: 'BE message' });
  });
});

describe('buildTimeAgo', () => {
  const timeAgo = buildTimeAgo(t);
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('returns "now" for anything under a minute', () => {
    expect(timeAgo(ago(10_000))).toBe('notificationsPage.timeAgo.now');
  });

  it('returns minutes for under an hour', () => {
    expect(timeAgo(ago(5 * 60_000))).toBe('notificationsPage.timeAgo.min::{"count":5}');
  });

  it('returns hours for under a day', () => {
    expect(timeAgo(ago(3 * 60 * 60_000))).toBe('notificationsPage.timeAgo.hour::{"count":3}');
  });

  it('returns days beyond 24 hours', () => {
    expect(timeAgo(ago(2 * 24 * 60 * 60_000))).toBe('notificationsPage.timeAgo.day::{"count":2}');
  });
});
