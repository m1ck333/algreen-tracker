import {
  OrderStatus,
  OrderType,
  ProcessStatus,
  SubProcessStatus,
  RequestStatus,
  ChangeRequestType,
  NotificationType,
  ComplexityType,
  UserRole,
} from '../enums';

// ─── Pagination ─────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// ─── Identity ────────────────────────────────────────────

export interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  /** Extra roles beyond the primary `role`. Saša 08.06.2026 — a user can be
   *  e.g. Coordinator (primary) + Magacioner (additional). Use `hasRole`
   *  helper instead of comparing `role` directly when checking permissions. */
  additionalRoles: UserRole[];
  processes: { processId: string }[];
  canIncludeWithdrawnInAnalysis: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Check if user has the given role (primary or additional). Preferred over
 *  raw `user.role === X` so the Magacin module multi-role policy is honored. */
export function hasRole(user: Pick<UserDto, 'role' | 'additionalRoles'> | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  if (user.role === role) return true;
  return user.additionalRoles?.includes(role) ?? false;
}

export interface ShiftDto {
  id: string;
  tenantId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  /** Expected break duration during the shift, in minutes. */
  breakMinutes: number;
  /** Max overtime allowed past EndTime before auto-logout, in hours. */
  maxOvertimeHours: number;
  /** Cadence (hours) at which the auto-logout job ends a forgotten session. */
  autoLogoutAfterHours: number;
  /** How many minutes before auto-logout the tablet shows a warning. */
  alarmBeforeLogoutMinutes: number;
  /** Hard auto-logout for the REGULAR shift session, in minutes from check-in
   *  (Bojan 29.05.2026). Time between shift duration and this cap counts as
   *  overtime within the same session. 0 = legacy behaviour. */
  autoLogoutRegularMinutes: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface LoginResponseDto {
  token: string;
  refreshToken: string;
  user: UserDto;
}

/**
 * One row of role-change history rendered in the user-detail drawer.
 * Returned newest-first by GET /api/users/{id}/role-history.
 * `changedByUserName` is the actor's full name resolved server-side; it can
 * be null if the actor's user row was hard-deleted (rare — soft-delete is
 * the norm).
 */
export interface UserRoleChangeEntryDto {
  id: string;
  oldRole: UserRole;
  newRole: UserRole;
  changedByUserId: string;
  changedByUserName: string | null;
  changedAt: string;
  reason: string | null;
}

/**
 * One row of the login-attempt audit log. Returned newest-first by
 * GET /api/users/{id}/login-history. `failureReason` is null when
 * `succeeded` is true; otherwise it's the BE error code
 * (INVALID_CREDENTIALS, USER_INACTIVE, ACCOUNT_LOCKED, ...).
 */
export interface LoginAttemptDto {
  id: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  succeeded: boolean;
  failureReason: string | null;
  attemptedAt: string;
}

// ─── Orders ──────────────────────────────────────────────

export interface OrderDto {
  id: string;
  tenantId: string;
  orderNumber: string;
  deliveryDate: string;
  priority: number;
  orderType: string;
  status: OrderStatus;
  notes: string | null;
  customWarningDays: number | null;
  customCriticalDays: number | null;
  itemCount: number;
}

export interface OrderManualProcessDto {
  processId: string;
  sequenceOrder: number;
  defaultComplexity: ComplexityType | null;
}

export interface OrderManualDependencyDto {
  processId: string;
  dependsOnProcessId: string;
}

export interface OrderDetailDto {
  id: string;
  tenantId: string;
  orderNumber: string;
  deliveryDate: string;
  priority: number;
  orderType: string;
  status: OrderStatus;
  notes: string | null;
  customWarningDays: number | null;
  customCriticalDays: number | null;
  items: OrderItemDto[];
  attachments: OrderAttachmentDto[];
  completedAt: string | null;
  isInvoiced: boolean;
  manualProcesses: OrderManualProcessDto[];
  manualProcessDependencies: OrderManualDependencyDto[];
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productCategoryId: string;
  productName: string;
  quantity: number;
  notes: string | null;
  processes: OrderItemProcessDto[];
  specialRequests: OrderItemSpecialRequestDto[];
  attachments: OrderAttachmentDto[];
}

export interface OrderItemProcessDto {
  id: string;
  orderItemId: string;
  processId: string;
  complexity: ComplexityType | null;
  complexityOverridden: boolean;
  status: ProcessStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalDurationMinutes: number;
  pausedAt: string | null;
  resumedAt: string | null;
  isWithdrawn: boolean;
  subProcesses: OrderItemSubProcessDto[];
}

export interface OrderItemSubProcessDto {
  id: string;
  orderItemProcessId: string;
  subProcessId: string;
  status: SubProcessStatus;
  totalDurationMinutes: number;
  isWithdrawn: boolean;
  isTimerRunning: boolean;
  currentLogStartedAt: string | null;
}

export interface OrderItemSpecialRequestDto {
  id: string;
  specialRequestTypeId: string;
}

export interface OrderMasterViewDto {
  id: string;
  orderNumber: string;
  orderType: string;
  status: OrderStatus;
  deliveryDate: string;
  priority: number;
  customWarningDays: number | null;
  customCriticalDays: number | null;
  completedProcesses: number;
  totalProcesses: number;
  /** Map of processId → aggregated ProcessStatus string */
  processStatuses: Record<string, string>;
  /** Map of processId → total duration in seconds (live-calculated) */
  processDurations: Record<string, number>;
  /** Map of processId → whether any item's process is paused */
  processPaused: Record<string, boolean>;
  /**
   * Map of processId → true if at least one item has this process ready to start
   * (Pending + all of that item's dependencies Completed or Withdrawn). Computed
   * BE-side because the aggregated processStatuses can't capture per-item readiness
   * when sibling items are still mid-pipeline.
   */
  processReady: Record<string, boolean>;
  /**
   * Per-item readiness: itemId → (processId → ready). The FE per-item
   * ItemProcessBar uses this directly — it can't compute it locally because
   * the flat processDependencies map merges deps across categories and gives
   * wrong answers for multi-item orders with different categories.
   */
  itemProcessReady: Record<string, Record<string, boolean>>;
  /** Map of processId → list of processIds it depends on */
  processDependencies: Record<string, string[]>;
  attachmentCount: number;
  createdAt: string;
  completedAt: string | null;
  isInvoiced: boolean;
}

// ─── Block & Change Requests ─────────────────────────────

export interface BlockRequestDto {
  id: string;
  orderItemProcessId: string | null;
  orderItemSubProcessId: string | null;
  requestedByUserId: string;
  requestNote: string | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string | null;
  handledByUserId: string | null;
  handledAt: string | null;
  blockReason: string | null;
  rejectionNote: string | null;
  orderId: string | null;
  orderNumber: string | null;
  currentProcessStatus: ProcessStatus | null;
  processId: string | null;
  processName: string | null;
}

export interface ChangeRequestDto {
  id: string;
  orderId: string;
  orderNumber: string | null;
  requestedByUserId: string;
  requestType: ChangeRequestType;
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string | null;
  handledByUserId: string | null;
  handledAt: string | null;
  responseNote: string | null;
}

// ─── Notifications ───────────────────────────────────────

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
  /**
   * Optional JSON payload with structured params (e.g.
   * '{"code":"100","name":"Profil AL","onHand":2,"min":5,"unit":"kom"}').
   * FE renders via i18n template keyed on `type` using these params;
   * falls back to `title` / `message` when missing.
   */
  paramsJson: string | null;
}

// ─── Work Sessions ───────────────────────────────────────

export interface WorkSessionDto {
  id: string;
  userId: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  date: string;
  isActive: boolean;
}

export interface ActiveWorkSessionDto {
  session: WorkSessionDto;
  /** UTC ISO — when the tablet should start showing the auto-logout alarm. */
  alarmAtUtc: string | null;
  /** UTC ISO — when reports treat the session as auto-closed. */
  logoutAtUtc: string | null;
}

// ─── Production ──────────────────────────────────────────

export interface ProcessDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  sequenceOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  subProcesses: SubProcessDto[];
}

export interface SubProcessDto {
  id: string;
  processId: string;
  name: string;
  sequenceOrder: number;
  isActive: boolean;
}

export interface ProductCategoryDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  defaultWarningDays: number | null;
  defaultCriticalDays: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductCategoryDetailDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  defaultWarningDays: number | null;
  defaultCriticalDays: number | null;
  createdAt: string;
  updatedAt: string | null;
  processes: ProductCategoryProcessDto[];
  dependencies: ProductCategoryDependencyDto[];
}

export interface ProductCategoryProcessDto {
  id: string;
  processId: string;
  processCode: string | null;
  processName: string | null;
  defaultComplexity: ComplexityType | null;
  sequenceOrder: number;
}

export interface ProductCategoryDependencyDto {
  id: string;
  processId: string;
  processCode: string | null;
  dependsOnProcessId: string;
  dependsOnProcessCode: string | null;
}

export interface OrderTypeDto {
  id: string;
  code: string;
  name: string;
  allowsManualProcesses: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface DeleteOrderTypeResult {
  hardDeleted: boolean;
  deactivated: boolean;
}

export interface SpecialRequestTypeDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  addsProcesses: string[];
  removesProcesses: string[];
  onlyProcesses: string[];
  ignoresDependencies: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Dashboard ──────────────────────────────────────────

export interface DashboardStatisticsDto {
  today: {
    ordersCompleted: number;
    ordersActive: number;
    processesCompleted: number;
    averageProcessTimeMinutes: number;
  };
  warnings: {
    criticalCount: number;
    warningCount: number;
  };
  pendingBlockRequests: number;
}

export interface DeadlineWarningDto {
  orderId: string;
  orderNumber: string;
  deliveryDate: string;
  daysRemaining: number;
  level: 'Warning' | 'Critical';
  currentProcess: string | null;
}

export interface LiveViewProcessDto {
  processId: string;
  processCode: string;
  processName: string;
  queueCount: number;
  inProgressCount: number;
  activeOrders: LiveViewOrderDto[];
}

export interface LiveViewOrderDto {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  status: string;
  isBlocked: boolean;
  blockReason: string | null;
}

export interface WorkerStatusDto {
  userId: string;
  name: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  assignedProcessCodes: string[];
}

export interface PendingBlockRequestDto {
  id: string;
  orderNumber: string;
  processName: string;
  productName: string;
  requestNote: string | null;
  requestedBy: string;
  requestedAt: string;
}

// ─── Tenancy ─────────────────────────────────────────────

export interface TenantDto {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  /** Relative path to the uploaded client logo (e.g. "tenant-logos/{id}.png").
   *  Null when the tenant hasn't uploaded one; sidebar falls back to the
   *  default MPMS mark. Streamed via GET /api/tenants/me/logo. */
  logoUrl: string | null;
  /** Set when a SuperAdmin manually blocked the tenant (typically for
   *  unpaid subscription). Block flips isActive to false; null when the
   *  tenant has never been blocked (or has been unblocked). */
  blockedAt: string | null;
  blockedReason: string | null;
  /** Most recent payment.paidAt for this tenant, or null when no payments
   *  have been recorded. SA-only field — never exposed on /tenants/me. */
  lastPaidAt: string | null;
  /** Max payment.periodEnd — date through which subscription is paid up.
   *  Null when no payments yet. FE compares to today to flag overdue. */
  paidThrough: string | null;
  /** SA-controlled list of feature keys disabled for this tenant.
   *  Sidebar + routes filter out items whose featureKey appears here.
   *  Empty array = all features enabled. */
  disabledFeatures: string[];
}

/** Known feature keys. Kept in sync with Tenant.KnownFeatures on the BE. */
export const TenantFeature = {
  ProcessTimes: 'process-times',
  Magacin: 'magacin',
} as const;
export type TenantFeatureKey = typeof TenantFeature[keyof typeof TenantFeature];

export interface TenantPaymentDto {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  paidAt: string;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AllTenantPaymentDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  paidAt: string;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TenantSettingsDto {
  id: string;
  tenantId: string;
  defaultWarningDays: number;
  defaultCriticalDays: number;
  warningColor: string;
  criticalColor: string;
}

// ─── Order Attachments ──────────────────────────────────

export interface OrderAttachmentDto {
  id: string;
  orderId: string;
  orderItemId: string | null;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

// ─── Tablet ─────────────────────────────────────────────

export interface TabletQueueItemDto {
  orderItemProcessId: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  productCategoryName: string | null;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
  specialRequestNames: string[];
  completedProcessCount: number;
  totalProcessCount: number;
  totalDurationMinutes: number;
  orderNotes: string | null;
  itemNotes: string | null;
  attachmentCount: number;
}

export interface TabletActiveWorkDto {
  orderItemProcessId: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  productCategoryName: string | null;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
  specialRequestNames: string[];
  completedProcessCount: number;
  totalProcessCount: number;
  startedAt: string | null;
  totalDurationMinutes: number;
  isTimerRunning: boolean;
  currentLogStartedAt: string | null;
  subProcesses: TabletSubProcessDto[];
  orderNotes: string | null;
  itemNotes: string | null;
  attachmentCount: number;
}

export interface TabletSubProcessDto {
  id: string;
  subProcessId: string;
  status: SubProcessStatus;
  totalDurationMinutes: number;
  isWithdrawn: boolean;
  isTimerRunning: boolean;
  currentLogStartedAt: string | null;
}

export interface TabletIncomingDto {
  orderItemProcessId: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  productCategoryName: string | null;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
  specialRequestNames: string[];
  completedProcessCount: number;
  totalProcessCount: number;
  blockingProcesses: BlockingProcessDto[];
  orderNotes: string | null;
  itemNotes: string | null;
  attachmentCount: number;
}

export interface BlockingProcessDto {
  orderItemProcessId: string;
  processId: string;
  status: ProcessStatus;
}

export interface ProcessGroupDto<T> {
  processId: string;
  processCode: string;
  processName: string;
  sequenceOrder: number;
  items: T[];
}

// ─── Reports ───────────────────────────────────────────

/**
 * Per-complexity time stats. Values are decimal MINUTES (BE divides the raw
 * seconds-storing-as-minutes column by 60). Format for display as h:mm:ss
 * (multiply minutes × 60 → seconds → format).
 *
 * Trimmed metric uses a 1-sigma window per the Excel formulas (Tab 1):
 *   trimmedMeanMinutes = AVERAGE of samples within [μ - σ, μ + σ]   ("Realni prosek")
 * min/max are full-population, not window-clamped.
 */
export interface ComplexityStatsDto {
  count: number;
  avgMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  stdevMinutes: number;
  trimmedMeanMinutes: number;
}

export interface ProcessTimeItemDto {
  processId: string;
  processCode: string;
  processName: string;
  stats: Record<string, ComplexityStatsDto>;
}

export interface SubProcessTimeDto {
  subProcessId: string;
  name: string;
  /** SECONDS — same legacy column as TimeTrackingItemDto.durationSeconds (no ÷60). */
  durationSeconds: number;
}

export interface TimeTrackingItemDto {
  orderItemProcessId: string;
  orderNumber: string;
  productCategoryName: string;
  orderType: string;
  processId: string;
  processCode: string;
  processName: string;
  complexity: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  /** SECONDS. Format with h:mm:ss. */
  durationSeconds: number;
  /** Sale/Bojan's per-row exclusion toggle (persisted server-side). When
   * true, this row is filtered out of /reports/process-times aggregation
   * and from the Praćenje XLSX/CSV export. */
  isExcludedFromReports: boolean;
  subProcesses: SubProcessTimeDto[];
}

export interface TimeTrackingResponseDto {
  items: TimeTrackingItemDto[];
}

export interface ProcessTimeTrendBucketDto {
  /** ISO date (week → Monday, month → first day). */
  bucketStart: string;
  count: number;
  /** Realni prosek (trimmed mean) of this bucket's samples, in minutes. */
  trimmedMeanMinutes: number;
  /** Smallest sample inside μ±σ window, in minutes. */
  minMinutes: number;
  /** Largest sample inside μ±σ window, in minutes. */
  maxMinutes: number;
}

export interface ProcessTimeTrendDto {
  buckets: ProcessTimeTrendBucketDto[];
  /** 85% of trimmed mean across the whole filtered period (constant target
   *  line). Null when no samples. */
  normativMinutes: number | null;
}

export interface ActiveProcessFunnelBucketDto {
  processId: string;
  processCode: string;
  processName: string;
  sequenceOrder: number;
  inProgressCount: number;
  readyCount: number;
  blockedCount: number;
}

export interface ActiveProcessFunnelDto {
  processes: ActiveProcessFunnelBucketDto[];
}

export interface BlocksPerProcessBucketDto {
  processId: string;
  processCode: string;
  processName: string;
  sequenceOrder: number;
  totalSubmitted: number;
  approvedCount: number;
  resolvedCount: number;
  rejectedCount: number;
  /** Average duration in WORKING HOURS — only counts time in active shift windows. */
  averageDurationHours: number;
}

export interface BlocksPerProcessReportDto {
  processes: BlocksPerProcessBucketDto[];
}

export interface ProductManufacturingProcessDto {
  processId: string;
  processCode: string;
  processName: string;
  /** Canonical process sequence — used to order columns consistently. */
  sequenceOrder: number;
  startedAt: string | null;
  completedAt: string | null;
  /** Duration of THIS process slot, in seconds. */
  durationSeconds: number;
  /** Gap from this process's end to next process's start. Zero for last or overlapping. */
  gapToNextSeconds: number;
}

export interface ProductManufacturingTimeOrderDto {
  orderId: string;
  /** One row per order ITEM — this is the unique row key. */
  orderItemId: string;
  orderNumber: string;
  orderType: string;
  productCategoryName: string;
  /** "T" / "S" / "L" — null if the item had no processes with complexity set. */
  topComplexity: string | null;
  /** "Zastupljenost težina" — e.g. "60% / 20% / 20%". Null if no complexity set. */
  complexityShare: string | null;
  processes: ProductManufacturingProcessDto[];
  /** Sum of all durations + positive inter-process gaps. Seconds. */
  totalWithGapsSeconds: number;
  /** Sum of all durations only. Seconds. */
  totalWithoutGapsSeconds: number;
}

export interface ProductManufacturingTimeReportDto {
  orders: ProductManufacturingTimeOrderDto[];
}

export interface WorkEfficiencyRowDto {
  userId: string;
  fullName: string;
  /** Σ TotalWorked (Prijavljeno / ukupno). */
  loggedMinutes: number;
  /** Σ Effective (Efektivno). */
  effectiveMinutes: number;
  activeOnProcessesMinutes: number;
  uncoveredMinutes: number;
  /** 0–100, weighted (ΣActive / ΣEffective). */
  efficiencyPercent: number;
}

export interface WorkEfficiencyReportDto {
  rows: WorkEfficiencyRowDto[];
}

export interface DeliveryComplianceBucketDto {
  /** ISO date of bucket start (week → Monday, month → first day). */
  bucketStart: string;
  onTimeCount: number;
  lateCount: number;
  totalCount: number;
  onTimePercent: number;
  latePercent: number;
}

export interface DeliveryComplianceReportDto {
  buckets: DeliveryComplianceBucketDto[];
}

export type ReportGranularity = 'Week' | 'Month';

export interface WorkerDailyBreakdownDto {
  date: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  regularMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  effectiveMinutes: number;
  activeMinutes: number;
  uncoveredMinutes: number;
  /** 0–100 */
  efficiencyPercent: number;
  sessionCount: number;
  /** True when the day's total worked exceeded the shift's
   *  AutoLogoutRegularMinutes cap (Bojan Excel v2 column M). */
  autoLogoutApplied: boolean;
}

export interface WorkerHoursDto {
  userId: string;
  fullName: string;
  regularMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  effectiveMinutes: number;
  activeMinutes: number;
  uncoveredMinutes: number;
  /** 0–100, weighted (ΣActive / ΣEffective). */
  efficiencyPercent: number;
  dailyBreakdown: WorkerDailyBreakdownDto[];
}

// ─── Magacin (warehouse) — Saša 08.06.2026 ─────────────────────────────────

export interface MaterialDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  minQuantity: number;
  maxQuantity: number;
  dimensionX: number | null;
  dimensionY: number | null;
  dimensionZ: number | null;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface StockMovementDto {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  category: string;
  dimensionX: number | null;
  dimensionY: number | null;
  dimensionZ: number | null;
  type: 'Inflow' | 'Outflow';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  movementDate: string;
  documentReference: string;
  notes: string | null;
  createdAt: string;
  processId: string | null;
  processName: string | null;
}

export interface StockBalanceRowDto {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  dimensionX: number | null;
  dimensionY: number | null;
  dimensionZ: number | null;
  quantity: number;
  latestUnitPrice: number;
  totalValue: number;
  minQuantity: number;
  maxQuantity: number;
  status: 'Ok' | 'BelowMin' | 'AboveMax';
  location: string | null;
  notes: string | null;
}
