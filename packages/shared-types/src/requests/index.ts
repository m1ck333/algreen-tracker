import { ChangeRequestType, ComplexityType, UserRole } from '../enums';

// ─── Auth ────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  tenantCode: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ─── Users ───────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  processIds?: string[];
  /**
   * Override the tenant this user is created in. SuperAdmin only — BE
   * rejects this for non-SuperAdmin callers. Used by the tenant-creation
   * flow to seed the initial Admin in the freshly-created tenant.
   */
  tenantId?: string;
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  canIncludeWithdrawnInAnalysis: boolean;
  processIds?: string[];
  /** Extra roles beyond the primary. Null = leave existing; non-null
   *  array (incl. empty) = replace. Saša 08.06.2026. */
  additionalRoles?: UserRole[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Shifts ──────────────────────────────────────────────

export interface CreateShiftRequest {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  maxOvertimeHours: number;
  autoLogoutAfterHours: number;
  alarmBeforeLogoutMinutes: number;
  autoLogoutRegularMinutes: number;
}

export interface UpdateShiftRequest {
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  breakMinutes: number;
  maxOvertimeHours: number;
  autoLogoutAfterHours: number;
  alarmBeforeLogoutMinutes: number;
  autoLogoutRegularMinutes: number;
}

// ─── Orders ──────────────────────────────────────────────

export interface CreateOrderItemInput {
  productCategoryId: string;
  productName: string;
  quantity: number;
  notes?: string;
}

export interface ManualProcessInput {
  processId: string;
  sequenceOrder: number;
  defaultComplexity?: ComplexityType;
}

export interface ManualDependencyInput {
  processId: string;
  dependsOnProcessId: string;
}

export interface CreateOrderRequest {
  orderNumber: string;
  deliveryDate: string;
  priority: number;
  orderType: string;
  notes?: string;
  customWarningDays?: number;
  customCriticalDays?: number;
  items?: CreateOrderItemInput[];
  manualProcesses?: ManualProcessInput[];
  manualDependencies?: ManualDependencyInput[];
}

export interface UpdateOrderRequest {
  orderNumber?: string;
  deliveryDate?: string;
  notes?: string;
  customWarningDays?: number;
  customCriticalDays?: number;
  addItems?: CreateOrderItemInput[];
  removeItemIds?: string[];
  complexityOverrides?: { itemId: string; processId: string; complexity: ComplexityType }[];
  addSpecialRequests?: { itemId: string; specialRequestTypeId: string }[];
  removeSpecialRequests?: { itemId: string; specialRequestId: string }[];
}

export interface AddOrderItemRequest {
  productCategoryId: string;
  productName: string;
  quantity: number;
  notes?: string;
}

export interface AddSpecialRequestRequest {
  specialRequestTypeId: string;
}

export interface OverrideComplexityRequest {
  complexity: ComplexityType;
}

// ─── Block Requests ──────────────────────────────────────

export interface CreateBlockRequestRequest {
  orderItemProcessId?: string;
  orderItemSubProcessId?: string;
  requestedByUserId: string;
  requestNote?: string;
}

export interface HandleBlockRequestRequest {
  handledByUserId: string;
  note?: string;
}

// ─── Change Requests ─────────────────────────────────────

export interface CreateChangeRequestRequest {
  orderId: string;
  requestedByUserId: string;
  requestType: ChangeRequestType;
  description: string;
}

export interface HandleChangeRequestRequest {
  handledByUserId: string;
  responseNote?: string;
}

// ─── Work Sessions ───────────────────────────────────────

export interface CheckInRequest {
  userId: string;
}

export interface CheckOutRequest {
  userId: string;
}

// ─── Process Workflow ────────────────────────────────────

/**
 * Optional metadata the tablet attaches to workflow actions for offline
 * support. The server treats both as optional: `occurredAt` absent → "now";
 * `actionId` absent → no idempotency dedupe (today's behaviour).
 */
export interface OfflineActionMeta {
  /** ISO timestamp of when the worker tapped (for actions replayed later). */
  occurredAt?: string;
  /** Client idempotency key so a replayed/duplicate request applies once. */
  actionId?: string;
}

export interface StartProcessWorkRequest extends OfflineActionMeta {
  userId: string;
}

export interface StopProcessWorkRequest extends OfflineActionMeta {
  userId: string;
}

export interface ResumeProcessWorkRequest extends OfflineActionMeta {
  userId: string;
}

/** Body for the complete-process endpoint (historically body-less). */
export type CompleteProcessRequest = OfflineActionMeta;

export interface BlockProcessRequest {
  userId: string;
  reason: string;
}

export interface UnblockProcessRequest {
  userId: string;
  resetTime?: boolean;
}

// ─── Sub-Process Workflow ────────────────────────────────

export interface StartSubProcessRequest extends OfflineActionMeta {
  userId: string;
}

export interface CompleteSubProcessRequest extends OfflineActionMeta {
  userId: string;
}

// ─── Processes ───────────────────────────────────────────

export interface CreateProcessRequest {
  code: string;
  name: string;
  sequenceOrder: number;
  subProcesses?: { name: string; sequenceOrder: number }[];
}

export interface UpdateProcessRequest {
  code: string;
  name: string;
  sequenceOrder: number;
  addSubProcesses?: { name: string; sequenceOrder: number }[];
  deactivateSubProcessIds?: string[];
}

export interface AddSubProcessRequest {
  name: string;
  sequenceOrder: number;
}

export interface UpdateSubProcessRequest {
  name: string;
  sequenceOrder: number;
}

// ─── Product Categories ──────────────────────────────────

export interface CategoryProcessInput {
  processId: string;
  sequenceOrder: number;
  defaultComplexity?: ComplexityType;
}

export interface CategoryDependencyInput {
  processId: string;
  dependsOnProcessId: string;
}

export interface CreateProductCategoryRequest {
  name: string;
  description?: string;
  defaultWarningDays?: number;
  defaultCriticalDays?: number;
  processes?: CategoryProcessInput[];
  dependencies?: CategoryDependencyInput[];
}

export interface UpdateProductCategoryRequest {
  name: string;
  description?: string;
  defaultWarningDays?: number;
  defaultCriticalDays?: number;
  processes?: CategoryProcessInput[];
  dependencies?: CategoryDependencyInput[];
}

// Keep for backward compat with existing separate endpoints
export interface AddCategoryProcessRequest {
  processId: string;
  sequenceOrder: number;
  defaultComplexity?: ComplexityType;
}

export interface AddCategoryDependencyRequest {
  processId: string;
  dependsOnProcessId: string;
}

// ─── Order Types ─────────────────────────────────────────

export interface CreateOrderTypeRequest {
  // Optional — server auto-generates a slug from name when empty.
  code?: string;
  name: string;
  allowsManualProcesses: boolean;
}

export interface UpdateOrderTypeRequest {
  name: string;
  allowsManualProcesses: boolean;
  isActive: boolean;
}

// ─── Special Request Types ───────────────────────────────

export interface CreateSpecialRequestTypeRequest {
  code: string;
  name: string;
  description?: string;
  addsProcesses?: string[];
  removesProcesses?: string[];
  onlyProcesses?: string[];
}

export interface UpdateSpecialRequestTypeRequest {
  name: string;
  description?: string;
  addsProcesses?: string[];
  removesProcesses?: string[];
  onlyProcesses?: string[];
}

// ─── Tenants ─────────────────────────────────────────────

export interface CreateTenantRequest {
  name: string;
  code: string;
  defaultWarningDays?: number;
  defaultCriticalDays?: number;
  warningColor?: string;
  criticalColor?: string;
}

export interface UpdateTenantRequest {
  name: string;
  defaultWarningDays?: number;
  defaultCriticalDays?: number;
  warningColor?: string;
  criticalColor?: string;
}

export interface CreateTenantPaymentRequest {
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  paidAt: string;
  invoiceNumber?: string | null;
  notes?: string | null;
}

export interface BlockTenantRequest {
  reason?: string | null;
}

export interface UpdateTenantFeaturesRequest {
  disabledFeatures: string[];
}

export interface UpdateTenantSettingsRequest {
  defaultWarningDays: number;
  defaultCriticalDays: number;
  warningColor: string;
  criticalColor: string;
}
