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
  DeadlineWarning: 'DeadlineWarning',
  ProcessReadyForQueue: 'ProcessReadyForQueue',
} as const;

export type SignalREventName = (typeof SignalREvents)[keyof typeof SignalREvents];
