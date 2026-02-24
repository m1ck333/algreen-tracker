import type {
  ProductCategoryDto,
  ProductCategoryDetailDto,
  PagedResult,
} from '@algreen/shared-types';
import type {
  CreateProductCategoryRequest,
  UpdateProductCategoryRequest,
  AddCategoryProcessRequest,
  AddCategoryDependencyRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const productCategoriesApi = {
  getAll(tenantId: string) {
    return apiClient.get<PagedResult<ProductCategoryDto>>('/product-categories', { params: { tenantId } });
  },

  getById(id: string) {
    return apiClient.get<ProductCategoryDetailDto>(`/product-categories/${id}`);
  },

  create(data: CreateProductCategoryRequest) {
    return apiClient.post<ProductCategoryDetailDto>('/product-categories', data);
  },

  update(id: string, data: UpdateProductCategoryRequest) {
    return apiClient.put<ProductCategoryDetailDto>(`/product-categories/${id}`, data);
  },

  deactivate(id: string) {
    return apiClient.delete(`/product-categories/${id}`);
  },

  addProcess(categoryId: string, data: AddCategoryProcessRequest) {
    return apiClient.post<ProductCategoryDetailDto>(
      `/product-categories/${categoryId}/processes`,
      data,
    );
  },

  removeProcess(categoryId: string, processId: string) {
    return apiClient.delete<ProductCategoryDetailDto>(
      `/product-categories/${categoryId}/processes/${processId}`,
    );
  },

  addDependency(categoryId: string, data: AddCategoryDependencyRequest) {
    return apiClient.post<ProductCategoryDetailDto>(
      `/product-categories/${categoryId}/dependencies`,
      data,
    );
  },

  removeDependency(categoryId: string, dependencyId: string) {
    return apiClient.delete<ProductCategoryDetailDto>(
      `/product-categories/${categoryId}/dependencies/${dependencyId}`,
    );
  },
};
