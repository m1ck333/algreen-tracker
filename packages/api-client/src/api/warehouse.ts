import { apiClient } from '../axios-instance';
import type { StockBalanceRowDto, StockMovementDto, PagedResult } from '@alblue/shared-types';
import type { StockMovementType } from '@alblue/shared-types';

export interface StockEntryLineRequest {
  materialId: string;
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
}

export interface CreateStockEntryRequest {
  type: StockMovementType;
  documentReference: string;
  movementDate: string; // ISO
  notes: string | null;
  lines: StockEntryLineRequest[];
  processId?: string | null;
}

export interface GetStockHistoryParams {
  type?: StockMovementType;
  materialId?: string;
  docRef?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  category?: string;
}

export const warehouseApi = {
  getStockBalances() {
    return apiClient.get<StockBalanceRowDto[]>('/warehouse/stock');
  },
  getStockHistory(params: GetStockHistoryParams = {}) {
    return apiClient.get<PagedResult<StockMovementDto>>('/warehouse/history', { params });
  },
  createEntry(data: CreateStockEntryRequest) {
    return apiClient.post<StockMovementDto[]>('/warehouse/entries', data);
  },
};
