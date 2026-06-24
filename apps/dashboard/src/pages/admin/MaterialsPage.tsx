import { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Drawer, Form, Input, InputNumber, Select, Tag, Space, App, Popconfirm,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialsApi } from '@alblue/api-client';
import type { CreateMaterialRequest } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import type { MaterialDto } from '@alblue/shared-types';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { TableExportButton } from '../../components/TableExportButton';
import { MaterialsImportModal } from './MaterialsImportModal';
import { EmptyState } from '../../components/EmptyState';
import { ImportOutlined, PlusOutlined, CopyOutlined } from '@ant-design/icons';
import type { ExportColumn } from '../../utils/exportTable';
import dayjs from 'dayjs';
import { PageHeader } from '../../components/PageHeader';
import { getErrorMessage } from '../../utils/errors';
import { useFixedColumn } from '../../hooks/useFixedColumn';
import { useFilterWidth } from '../../hooks/useFilterWidth';

export function MaterialsPage() {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialDto | null>(null);
  const [createForm] = Form.useForm<CreateMaterialRequest>();
  const [editForm] = Form.useForm<Omit<CreateMaterialRequest, 'code'>>();

  const { guardedClose: guardedCreateClose, onValuesChange: onCreateValuesChange, markClean: markCreateClean } =
    useUnsavedChanges(createOpen);
  const { guardedClose: guardedEditClose, onValuesChange: onEditValuesChange, markClean: markEditClean } =
    useUnsavedChanges(!!editing);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { setPage(1); }, [debouncedSearch, categoryFilter, isActiveFilter]);

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['materials', tenantId, debouncedSearch, categoryFilter, isActiveFilter, page, pageSize, sortBy, sortDirection],
    queryFn: () =>
      materialsApi
        .getAll({
          search: debouncedSearch || undefined,
          category: categoryFilter,
          isActive: isActiveFilter,
          page,
          pageSize,
          sortBy,
          isDescending: sortDirection === 'desc',
        })
        .then((r) => r.data),
    enabled: !!tenantId,
  });

  const data = pagedResult?.items;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((m) => set.add(m.category));
    return Array.from(set).sort().map((k) => ({ label: k, value: k }));
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['materials'] });

  const createMutation = useMutation({
    mutationFn: (values: CreateMaterialRequest) => materialsApi.create(values).then((r) => r.data),
    onSuccess: () => {
      message.success(t('materials.created'));
      markCreateClean();
      setCreateOpen(false);
      createForm.resetFields();
      invalidate();
    },
    onError: (err) => message.error(getErrorMessage(err, t('materials.createError'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Omit<CreateMaterialRequest, 'code'> }) =>
      materialsApi.update(id, values).then((r) => r.data),
    onSuccess: () => {
      message.success(t('materials.saved'));
      markEditClean();
      setEditing(null);
      invalidate();
    },
    onError: (err) => message.error(getErrorMessage(err, t('materials.saveError'))),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      (isActive ? materialsApi.activate(id) : materialsApi.deactivate(id)),
    onSuccess: invalidate,
    onError: (err) => message.error(getErrorMessage(err, t('materials.saveError'))),
  });

  const exportColumns: ExportColumn<MaterialDto>[] = [
    { header: t('materials.code'), value: (m) => m.code, width: 12 },
    { header: t('materials.name'), value: (m) => m.name, width: 24 },
    { header: t('materials.unit'), value: (m) => m.unit, width: 8 },
    { header: t('materials.category'), value: (m) => m.category, width: 18 },
    { header: t('materials.dimX'), value: (m) => m.dimensionX ?? '', align: 'right', width: 10 },
    { header: t('materials.dimY'), value: (m) => m.dimensionY ?? '', align: 'right', width: 10 },
    { header: t('materials.dimZ'), value: (m) => m.dimensionZ ?? '', align: 'right', width: 10 },
    { header: t('materials.min'), value: (m) => m.minQuantity, align: 'right', width: 8 },
    { header: t('materials.max'), value: (m) => m.maxQuantity, align: 'right', width: 8 },
    { header: t('materials.location'), value: (m) => m.location ?? '', width: 14 },
    { header: t('materials.notes'), value: (m) => m.notes ?? '', width: 30 },
    { header: t('materials.status'), value: (m) => m.isActive ? t('materials.statusActive') : t('materials.statusInactive'), width: 12 },
  ];

  const fetchAllForExport = async () => {
    const { data } = await materialsApi.getAll({
      search: debouncedSearch || undefined,
      category: categoryFilter,
      isActive: isActiveFilter,
      page: 1,
      pageSize: 10000,
    });
    return data.items;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={t('materials.title')}
        actions={<><TableExportButton
            onFetchAll={fetchAllForExport}
            columns={exportColumns}
            options={{
              fileName: `materials-${dayjs().format('YYYY-MM-DD')}`,
              title: t('materials.title'),
              sheetName: t('materials.title'),
            }}
          />
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
            {t('materials.import.button')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
            {t('materials.newMaterial')}
          </Button></>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 , flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('materials.searchPlaceholder')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: filterW(260) }}
        />
        <Select
          allowClear
          placeholder={t('materials.allCategories')}
          style={{ width: filterW(200) }}
          options={categoryOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />
        <Select
          placeholder={t('materials.status')}
          allowClear
          style={{ width: filterW(150) }}
          value={isActiveFilter}
          onChange={setIsActiveFilter}
          options={[
            { label: t('materials.active'), value: true },
            { label: t('materials.inactive'), value: false },
          ]}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table<MaterialDto>
          loading={isLoading}
          dataSource={data}
          rowKey="id"
          size="middle"
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          pagination={{
            current: page,
            pageSize,
            total: pagedResult?.totalCount,
            showSizeChanger: true,
          }}
          locale={{
            emptyText: (
              <EmptyState
                description={t('materials.empty')}
                action={
                  !debouncedSearch && !categoryFilter && isActiveFilter !== false
                    ? {
                        label: t('materials.newMaterial'),
                        icon: <PlusOutlined />,
                        onClick: () => { createForm.resetFields(); setCreateOpen(true); },
                      }
                    : undefined
                }
              />
            ),
          }}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize ?? 20);
              setPage(1);
              return;
            }
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const newField = (s?.order ? (s.field as string) : undefined) ?? 'code';
            const newDir: 'asc' | 'desc' = s?.order === 'descend' ? 'desc' : 'asc';
            if (newField !== sortBy || newDir !== sortDirection) {
              setSortBy(newField);
              setSortDirection(newDir);
              setPage(1);
              return;
            }
            if (pagination.current !== page) setPage(pagination.current ?? 1);
          }}
          columns={[
            { title: t('materials.code'), dataIndex: 'code', width: 110, sorter: true, fixed: fixedCol('left') },
            { title: t('materials.name'), dataIndex: 'name', width: 260, sorter: true, fixed: fixedCol('left') },
            { title: t('materials.unit'), dataIndex: 'unit', width: 70, align: 'center' as const },
            { title: t('materials.category'), dataIndex: 'category', width: 160, sorter: true },
            {
              title: t('materials.dimensions'),
              width: 200,
              render: (_, m) => {
                const xs = [m.dimensionX, m.dimensionY, m.dimensionZ].filter((v) => v != null);
                return xs.length === 0 ? '—' : xs.join(' × ');
              },
            },
            { title: t('materials.min'), dataIndex: 'minQuantity', width: 80, align: 'right' as const },
            { title: t('materials.max'), dataIndex: 'maxQuantity', width: 80, align: 'right' as const },
            { title: t('materials.location'), dataIndex: 'location', width: 130, render: (v: string | null) => v || '—' },
            { title: t('materials.notes'), dataIndex: 'notes', width: 200, ellipsis: true, render: (v: string | null) => v || '—' },
            {
              title: t('materials.status'),
              dataIndex: 'isActive',
              width: 110,
              align: 'center' as const,
              render: (v: boolean) => v ? <Tag color="green">{t('materials.statusActive')}</Tag> : <Tag>{t('materials.statusInactive')}</Tag>,
            },
          ]}
          onRow={(record) => ({
            onClick: () => {
              setEditing(record);
              editForm.setFieldsValue({
                name: record.name,
                unit: record.unit,
                category: record.category,
                minQuantity: record.minQuantity,
                maxQuantity: record.maxQuantity,
                dimensionX: record.dimensionX,
                dimensionY: record.dimensionY,
                dimensionZ: record.dimensionZ,
                location: record.location,
                notes: record.notes,
              });
            },
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      <Drawer
        title={t('materials.newMaterial')}
        open={createOpen}
        onClose={() => guardedCreateClose(() => { setCreateOpen(false); createForm.resetFields(); })}
        width={540}
        destroyOnHidden
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>
            {t('common:actions.save')}
          </Button>
        }
      >
        <Form<CreateMaterialRequest>
          form={createForm}
          layout="vertical"
          onValuesChange={onCreateValuesChange}
          onFinish={(values) => createMutation.mutate(values)}
          initialValues={{ minQuantity: 0, maxQuantity: 0 }}
        >
          <Form.Item label={t('materials.code')} name="code" rules={[{ required: true, message: t('materials.validation.codeRequired') }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item label={t('materials.name')} name="name" rules={[{ required: true, message: t('materials.validation.nameRequired') }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label={t('materials.unit')} name="unit" rules={[{ required: true, message: t('materials.validation.unitRequired') }]}>
            <Input maxLength={20} placeholder={t('materials.unitPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('materials.category')} name="category" rules={[{ required: true, message: t('materials.validation.categoryRequired') }]}>
            <Input maxLength={100} placeholder={t('materials.categoryPlaceholder')} />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item label={t('materials.min')} name="minQuantity" style={{ flex: 1 }} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('materials.max')}
              name="maxQuantity"
              style={{ flex: 1 }}
              dependencies={['minQuantity']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const min = getFieldValue('minQuantity');
                    if (value == null || min == null || value >= min) return Promise.resolve();
                    return Promise.reject(new Error(t('materials.validation.maxLtMin')));
                  },
                }),
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item label={t('materials.dimX')} name="dimensionX" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="mm" />
            </Form.Item>
            <Form.Item label={t('materials.dimY')} name="dimensionY" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="mm" />
            </Form.Item>
            <Form.Item label={t('materials.dimZ')} name="dimensionZ" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="mm" />
            </Form.Item>
          </Space.Compact>
          <Form.Item label={t('materials.location')} name="location">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label={t('materials.notes')} name="notes">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editing ? `${t('materials.editMaterial')}: ${editing.code}` : ''}
        open={!!editing}
        onClose={() => guardedEditClose(() => setEditing(null))}
        width={540}
        destroyOnHidden
        extra={
          editing ? (
            <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>
              {t('common:actions.save')}
            </Button>
          ) : null
        }
      >
        <Form<Omit<CreateMaterialRequest, 'code'>>
          form={editForm}
          layout="vertical"
          onValuesChange={onEditValuesChange}
          onFinish={(values) => editing && updateMutation.mutate({ id: editing.id, values })}
        >
          {editing && (
            <Space style={{ marginBottom: 16 }}>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  const src = editing;
                  setEditing(null);
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    name: src.name,
                    unit: src.unit,
                    category: src.category,
                    minQuantity: src.minQuantity,
                    maxQuantity: src.maxQuantity,
                    dimensionX: src.dimensionX ?? undefined,
                    dimensionY: src.dimensionY ?? undefined,
                    dimensionZ: src.dimensionZ ?? undefined,
                    location: src.location ?? undefined,
                    notes: src.notes ?? undefined,
                  });
                  setCreateOpen(true);
                }}
              >
                {t('materials.duplicate')}
              </Button>
              {editing.isActive ? (
                <Popconfirm
                  title={t('materials.deactivateConfirm')}
                  onConfirm={() => setActiveMutation.mutate({ id: editing.id, isActive: false }, { onSuccess: () => setEditing(null) })}
                  okText={t('common:actions.confirm')}
                  cancelText={t('common:actions.no')}
                >
                  <Button size="small" danger loading={setActiveMutation.isPending}>{t('materials.deactivate')}</Button>
                </Popconfirm>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  loading={setActiveMutation.isPending}
                  onClick={() => setActiveMutation.mutate({ id: editing.id, isActive: true }, { onSuccess: () => setEditing(null) })}
                >
                  {t('materials.activate')}
                </Button>
              )}
            </Space>
          )}
          <Form.Item label={t('materials.name')} name="name" rules={[{ required: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label={t('materials.unit')} name="unit" rules={[{ required: true }]}>
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item label={t('materials.category')} name="category" rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item label={t('materials.min')} name="minQuantity" style={{ flex: 1 }} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={t('materials.max')}
              name="maxQuantity"
              style={{ flex: 1 }}
              dependencies={['minQuantity']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const min = getFieldValue('minQuantity');
                    if (value == null || min == null || value >= min) return Promise.resolve();
                    return Promise.reject(new Error(t('materials.validation.maxLtMin')));
                  },
                }),
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item label={t('materials.dimX')} name="dimensionX" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('materials.dimY')} name="dimensionY" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('materials.dimZ')} name="dimensionZ" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label={t('materials.location')} name="location">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label={t('materials.notes')} name="notes">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Drawer>

      <MaterialsImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
