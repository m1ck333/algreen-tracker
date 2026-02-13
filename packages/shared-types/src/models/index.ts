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
  processId: string | null;
  canIncludeWithdrawnInAnalysis: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ShiftDto {
  id: string;
  tenantId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface LoginResponseDto {
  token: string;
  refreshToken: string;
  user: UserDto;
}

// ─── Orders ──────────────────────────────────────────────

export interface OrderDto {
  id: string;
  tenantId: string;
  orderNumber: string;
  deliveryDate: string;
  priority: number;
  orderType: OrderType;
  status: OrderStatus;
  notes: string | null;
  customWarningDays: number | null;
  customCriticalDays: number | null;
  itemCount: number;
}

export interface OrderDetailDto {
  id: string;
  tenantId: string;
  orderNumber: string;
  deliveryDate: string;
  priority: number;
  orderType: OrderType;
  status: OrderStatus;
  notes: string | null;
  customWarningDays: number | null;
  customCriticalDays: number | null;
  items: OrderItemDto[];
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
}

export interface OrderItemSpecialRequestDto {
  id: string;
  specialRequestTypeId: string;
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
  handledByUserId: string | null;
  handledAt: string | null;
  blockReason: string | null;
  rejectionNote: string | null;
}

export interface ChangeRequestDto {
  id: string;
  orderId: string;
  requestedByUserId: string;
  requestType: ChangeRequestType;
  description: string;
  status: RequestStatus;
  createdAt: string;
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
}

// ─── Work Sessions ───────────────────────────────────────

export interface WorkSessionDto {
  id: string;
  processId: string;
  userId: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  date: string;
  isActive: boolean;
}

// ─── Production ──────────────────────────────────────────

export interface ProcessDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  sequenceOrder: number;
  isActive: boolean;
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
}

export interface ProductCategoryDetailDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
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
}

// ─── Tenancy ─────────────────────────────────────────────

export interface TenantDto {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TenantSettingsDto {
  id: string;
  tenantId: string;
  defaultWarningDays: number;
  defaultCriticalDays: number;
  warningColor: string;
  criticalColor: string;
}

// ─── Tablet ─────────────────────────────────────────────

export interface TabletQueueItemDto {
  orderItemProcessId: string;
  orderId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
}

export interface TabletActiveWorkDto {
  orderItemProcessId: string;
  orderId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
  startedAt: string | null;
  totalDurationMinutes: number;
  subProcesses: TabletSubProcessDto[];
}

export interface TabletSubProcessDto {
  id: string;
  subProcessId: string;
  status: SubProcessStatus;
  totalDurationMinutes: number;
  isWithdrawn: boolean;
}

export interface TabletIncomingDto {
  orderItemProcessId: string;
  orderId: string;
  orderNumber: string;
  priority: number;
  deliveryDate: string;
  productName: string;
  quantity: number;
  complexity: ComplexityType | null;
  status: ProcessStatus;
  blockingProcesses: BlockingProcessDto[];
}

export interface BlockingProcessDto {
  orderItemProcessId: string;
  processId: string;
  status: ProcessStatus;
}
