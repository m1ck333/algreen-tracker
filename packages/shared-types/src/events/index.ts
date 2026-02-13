// SignalR event payload types matching backend ProductionEventService

export interface OrderActivatedEvent {
  orderId: string;
  orderNumber: string;
  tenantId: string;
}

export interface ProcessStartedEvent {
  orderItemProcessId: string;
  processId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
}

export interface ProcessCompletedEvent {
  orderItemProcessId: string;
  processId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
}

export interface ProcessBlockedEvent {
  orderItemProcessId: string;
  processId: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  tenantId: string;
}

export interface ProcessUnblockedEvent {
  orderItemProcessId: string;
  processId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
}

export interface BlockRequestCreatedEvent {
  blockRequestId: string;
  orderItemProcessId: string | null;
  orderItemSubProcessId: string | null;
  requestNote: string | null;
  tenantId: string;
}

export interface BlockRequestApprovedEvent {
  blockRequestId: string;
  orderItemProcessId: string | null;
  orderItemSubProcessId: string | null;
  blockReason: string;
  tenantId: string;
}

export interface WorkerCheckedInEvent {
  userId: string;
  processId: string;
  sessionId: string;
  tenantId: string;
}

export interface WorkerCheckedOutEvent {
  userId: string;
  processId: string;
  sessionId: string;
  durationMinutes: number | null;
  tenantId: string;
}

export interface DeadlineWarningEvent {
  orderId: string;
  orderNumber: string;
  deliveryDate: string;
  daysRemaining: number;
  level: string;
  tenantId: string;
}
