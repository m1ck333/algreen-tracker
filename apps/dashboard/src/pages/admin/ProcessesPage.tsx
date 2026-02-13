import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, InputNumber, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { ProcessDto, SubProcessDto } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function ProcessesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (values: { code: string; name: string; sequenceOrder: number }) =>
      processesApi.create({ tenantId: tenantId!, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.processes.created'));
    },
  });

  const columns = [
    { title: t('common:labels.code'), dataIndex: 'code' },
    { title: t('common:labels.name'), dataIndex: 'name' },
    { title: t('common:labels.order'), dataIndex: 'sequenceOrder', sorter: (a: ProcessDto, b: ProcessDto) => a.sequenceOrder - b.sequenceOrder },
    {
      title: t('admin.processes.subProcesses'),
      dataIndex: 'subProcesses',
      render: (subs: SubProcessDto[]) => subs.filter((s) => s.isActive).length,
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.processes.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.processes.addProcess')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (record: ProcessDto) => (
            <Table
              dataSource={record.subProcesses}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: t('common:labels.name'), dataIndex: 'name' },
                { title: t('common:labels.order'), dataIndex: 'sequenceOrder' },
                {
                  title: t('common:labels.status'),
                  dataIndex: 'isActive',
                  render: (active: boolean) => (
                    <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
                  ),
                },
              ]}
            />
          ),
        }}
      />

      <Drawer
        title={t('admin.processes.createProcess')}
        open={drawerOpen}
        onClose={() => { form.resetFields(); setDrawerOpen(false); }}
        width={400}
        extra={
          <Space>
            <Button onClick={() => { form.resetFields(); setDrawerOpen(false); }}>{t('common:actions.cancel')}</Button>
            <Button type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sequenceOrder" label={t('admin.processes.sequenceOrder')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
