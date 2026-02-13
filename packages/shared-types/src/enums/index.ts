export enum OrderStatus {
  Draft = 'Draft',
  Active = 'Active',
  Paused = 'Paused',
  Cancelled = 'Cancelled',
  Completed = 'Completed',
}

export enum OrderType {
  Standard = 'Standard',
  Repair = 'Repair',
  Complaint = 'Complaint',
  Rework = 'Rework',
}

export enum ProcessStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Blocked = 'Blocked',
  Stopped = 'Stopped',
  Withdrawn = 'Withdrawn',
}

export enum SubProcessStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Stopped = 'Stopped',
  Withdrawn = 'Withdrawn',
}

export enum RequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum ChangeRequestType {
  Modify = 'Modify',
  Withdraw = 'Withdraw',
  Cancel = 'Cancel',
  Pause = 'Pause',
  Resume = 'Resume',
  PriorityChange = 'PriorityChange',
}

export enum NotificationType {
  DeadlineWarning = 'DeadlineWarning',
  DeadlineCritical = 'DeadlineCritical',
  BlockRequest = 'BlockRequest',
  ProcessCompleted = 'ProcessCompleted',
}

export enum HistoryAction {
  Withdrawn = 'Withdrawn',
  Stopped = 'Stopped',
  TimeCorrected = 'TimeCorrected',
  PriorityChanged = 'PriorityChanged',
}

export enum ComplexityType {
  T = 'T',
  S = 'S',
  L = 'L',
}

export enum UserRole {
  Admin = 'Admin',
  Manager = 'Manager',
  Coordinator = 'Coordinator',
  SalesManager = 'SalesManager',
  Department = 'Department',
}
