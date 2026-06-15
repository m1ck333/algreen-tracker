export const SignalREvents = {
  OrderActivated: 'OrderActivated',
  ProcessStarted: 'ProcessStarted',
  ProcessCompleted: 'ProcessCompleted',
  ProcessBlocked: 'ProcessBlocked',
  ProcessUnblocked: 'ProcessUnblocked',
  BlockRequestCreated: 'BlockRequestCreated',
  BlockRequestApproved: 'BlockRequestApproved',
  WorkerCheckedIn: 'WorkerCheckedIn',
  WorkerCheckedOut: 'WorkerCheckedOut',
  WorkerAutoLoggedOut: 'WorkerAutoLoggedOut',
  DeadlineWarning: 'DeadlineWarning',
  ProcessReadyForQueue: 'ProcessReadyForQueue',
  ProcessDefinitionUpdated: 'ProcessDefinitionUpdated',
  OrderUpdated: 'OrderUpdated',
  ChangeRequestCreated: 'ChangeRequestCreated',
  ChangeRequestApproved: 'ChangeRequestApproved',
  ChangeRequestRejected: 'ChangeRequestRejected',
  /**
   * Generic "a new in-app notification was just persisted for someone in this
   * tenant" event. Broadcast by the BE after any NotificationCreator write or
   * inline notification write in ProductionEventService — covers every type
   * (low-stock, block requests, deadlines, auto-logout, ...) without the FE
   * needing one subscription per type.
   */
  NotificationCreated: 'NotificationCreated',
} as const;

export type SignalREventName = (typeof SignalREvents)[keyof typeof SignalREvents];
