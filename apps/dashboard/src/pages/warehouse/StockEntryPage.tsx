import { useState } from 'react';
import { Typography, Form, Input, InputNumber, DatePicker, Button, Table, Select, Space, App, Popconfirm, Drawer } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseApi, materialsApi, processesApi } from '@alblue/api-client';
import type { CreateMaterialRequest } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { StockMovementType } from '@alblue/shared-types';
import dayjs from 'dayjs';
import { PageHeader } from '../../components/PageHeader';
import { getErrorMessage } from '../../utils/errors';

const { Text } = Typography;

interface LineFormShape {
  materialId?: string;
  quantity?: number;
  unitPrice?: number | null;
  notes?: string;
}

interface EntryFormShape {
  documentReference?: string;
  movementDate: dayjs.Dayjs;
  lines: LineFormShape[];
  processId?: string;
}

export function StockEntryPage({ type }: { type: StockMovementType }) {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const [form] = Form.useForm<EntryFormShape>();

  const isInflow = type === StockMovementType.Inflow;
  const docLabel = isInflow ? t('warehouse.documentReferenceInflow') : t('warehouse.documentReferenceOutflow');
  const docPlaceholder = isInflow ? t('warehouse.documentReferenceInflowPlaceholder') : t('warehouse.documentReferenceOutflowPlaceholder');
  const title = isInflow ? t('warehouse.inflowTitle') : t('warehouse.outflowTitle');
  const submitLabel = isInflow ? t('warehouse.saveInflow') : t('warehouse.saveOutflow');

  const { data: materials } = useQuery({
    queryKey: ['materials-for-warehouse', tenantId],
    queryFn: () => materialsApi.getAll({ isActive: true, pageSize: 500 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const [newMaterialOpen, setNewMaterialOpen] = useState(false);
  const [newMaterialForm] = Form.useForm<CreateMaterialRequest>();
  const [pendingLineForNewMaterial, setPendingLineForNewMaterial] = useState<number | null>(null);

  const createMaterialMutation = useMutation({
    mutationFn: (values: CreateMaterialRequest) => materialsApi.create(values),
    onSuccess: (resp) => {
      const created = resp.data;
      message.success(t('warehouse.newMaterialCreated'));
      queryClient.invalidateQueries({ queryKey: ['materials-for-warehouse', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      const lines = (form.getFieldValue('lines') as LineFormShape[]) ?? [];
      if (pendingLineForNewMaterial != null && lines[pendingLineForNewMaterial]) {
        const next = [...lines];
        next[pendingLineForNewMaterial] = { ...next[pendingLineForNewMaterial], materialId: created.id };
        form.setFieldsValue({ lines: next });
      } else {
        form.setFieldsValue({ lines: [...lines, { materialId: created.id }] });
      }
      setPendingLineForNewMaterial(null);
      setNewMaterialOpen(false);
      newMaterialForm.resetFields();
    },
    onError: (err) => message.error(getErrorMessage(err, t('warehouse.newMaterialFailed'))),
  });

  const { data: processes } = useQuery({
    queryKey: ['processes-for-outflow', tenantId],
    queryFn: () => processesApi.getAll({ isActive: true, pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId && !isInflow,
  });

  const processOptions = (processes ?? []).map((p) => ({
    label: `${p.code} — ${p.name}`,
    value: p.id,
  }));

  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.code} — ${m.name}`,
    value: m.id,
  }));

  const mutation = useMutation({
    mutationFn: (values: EntryFormShape) =>
      warehouseApi.createEntry({
        type,
        documentReference: values.documentReference!.trim(),
        movementDate: values.movementDate.toISOString(),
        // No document-level notes — Saša's Excel spec only has Napomena
        // as a per-stavka column. BE handler still accepts the field for
        // backwards compat but we don't send it from the form anymore.
        notes: null,
        processId: !isInflow ? (values.processId ?? null) : null,
        lines: (values.lines ?? []).map((l) => ({
          materialId: l.materialId!,
          quantity: l.quantity!,
          unitPrice: l.unitPrice ?? null,
          notes: l.notes ?? null,
        })),
      }),
    onSuccess: () => {
      message.success(isInflow ? t('warehouse.inflowSaved') : t('warehouse.outflowSaved'));
      form.resetFields();
      form.setFieldsValue({ movementDate: dayjs(), lines: [{}] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-history'] });
    },
    onError: (err) => message.error(getErrorMessage(err, t('warehouse.saveError'))),
  });

  return (
    <div style={{ padding: 0, maxWidth: 1200 }}>
      <PageHeader title={title} />

      <Form<EntryFormShape>
        form={form}
        layout="vertical"
        initialValues={{ movementDate: dayjs(), lines: [{}] }}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Form.Item label={docLabel} name="documentReference" required rules={[{ required: true, message: t('warehouse.documentReferenceRequired') }]}>
            <Input placeholder={docPlaceholder} style={{ width: 220 }} maxLength={50} />
          </Form.Item>
          <Form.Item label={t('warehouse.date')} name="movementDate" required>
            <DatePicker format="DD.MM.YYYY" style={{ width: 160 }} />
          </Form.Item>
          {!isInflow && (
            <Form.Item label={t('warehouse.process')} name="processId">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('warehouse.selectProcessOptional')}
                style={{ width: 260 }}
                options={processOptions}
              />
            </Form.Item>
          )}
        </Space>

        <div style={{ marginTop: 8 }}>
          <Text strong>{t('warehouse.lines')}</Text>
        </div>
        <Form.List name="lines">
          {(fields, { add, remove }) => (
            <>
              <Table
                size="small"
                pagination={false}
                style={{ marginTop: 8, marginBottom: 12 }}
                dataSource={fields.map((f) => ({ ...f, key: f.key }))}
                columns={[
                  {
                    title: t('warehouse.name'),
                    width: 280,
                    render: (_, field) => (
                      <Form.Item name={[field.name, 'materialId']} noStyle rules={[{ required: true, message: t('warehouse.lineMaterialRequired') }]}>
                        <Select showSearch optionFilterProp="label" options={materialOptions} placeholder={t('warehouse.selectMaterial')} style={{ width: '100%' }} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: t('warehouse.quantity'),
                    width: 110,
                    render: (_, field) => (
                      <Form.Item name={[field.name, 'quantity']} noStyle rules={[{ required: true, message: t('warehouse.lineQuantityRequired') }]}>
                        <InputNumber min={0.001} step={1} style={{ width: '100%' }} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: t('warehouse.unitPrice'),
                    width: 160,
                    render: (_, field) => (
                      <Form.Item name={[field.name, 'unitPrice']} noStyle rules={isInflow ? [{ required: true }] : undefined}>
                        <InputNumber
                          min={0}
                          step={1}
                          style={{ width: '100%' }}
                          placeholder={isInflow ? '' : t('warehouse.unitPriceFallbackHint')}
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    title: t('warehouse.notes'),
                    render: (_, field) => (
                      <Form.Item name={[field.name, 'notes']} noStyle>
                        <Input placeholder={t('warehouse.lineNotesPlaceholder')} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: '',
                    width: 50,
                    align: 'center' as const,
                    render: (_, field) =>
                      fields.length > 1 ? (
                        <Popconfirm title={t('warehouse.removeLine')} onConfirm={() => remove(field.name)}>
                          <Button danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ) : (
                        <Button danger size="small" icon={<DeleteOutlined />} disabled />
                      ),
                  },
                ]}
              />
              <Space>
                <Button onClick={() => add({})} icon={<PlusOutlined />}>{t('warehouse.addLine')}</Button>
                {/*
                  "Novi materijal" only on Ulaz — Saša 09.06.2026 confirmed
                  auto-add scoped to Ulaz form. On Izlaz, creating a fresh
                  material would land with 0 stock and the very next save
                  would fail STOCK_INSUFFICIENT, which is just a dead end.
                */}
                {isInflow && (
                  <Button
                    onClick={() => {
                      setPendingLineForNewMaterial(null);
                      newMaterialForm.resetFields();
                      newMaterialForm.setFieldsValue({ minQuantity: 0, maxQuantity: 0 });
                      setNewMaterialOpen(true);
                    }}
                    icon={<PlusOutlined />}
                  >
                    {t('warehouse.newMaterial')}
                  </Button>
                )}
              </Space>
            </>
          )}
        </Form.List>

        <div style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>{submitLabel}</Button>
        </div>
      </Form>

      <Drawer
        title={t('warehouse.newMaterial')}
        open={newMaterialOpen}
        onClose={() => { setNewMaterialOpen(false); setPendingLineForNewMaterial(null); }}
        destroyOnHidden
        width={Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 16 : 600)}
        extra={
          <Button type="primary" loading={createMaterialMutation.isPending} onClick={() => newMaterialForm.submit()}>
            {t('common:actions.save')}
          </Button>
        }
      >
        <Form<CreateMaterialRequest>
          form={newMaterialForm}
          layout="vertical"
          initialValues={{ minQuantity: 0, maxQuantity: 0 }}
          onFinish={(values) => createMaterialMutation.mutate({
            ...values,
            dimensionX: values.dimensionX ?? null,
            dimensionY: values.dimensionY ?? null,
            dimensionZ: values.dimensionZ ?? null,
            location: values.location ?? null,
            notes: values.notes ?? null,
          })}
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
    </div>
  );
}
