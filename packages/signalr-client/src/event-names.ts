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
  ProcessDefinitionUpdated: 'ProcessDefinitionUpdated',
  OrderUpdated: 'OrderUpdated',
} as const;

export type SignalREventName = (typeof SignalREvents)[keyof typeof SignalREvents];
