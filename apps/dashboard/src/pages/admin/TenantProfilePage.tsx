import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Form, InputNumber, Button, App, ColorPicker, Divider, Typography, Upload, Popconfirm, Modal, Table, Tabs, Select, Card, Statistic, Row, Col, theme } from 'antd';
import { formatDays } from '../../utils/formatMonths';
import { ClearOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@alblue/api-client';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { PageHeader } from '../../components/PageHeader';
import { getTranslatedError } from '../../utils/errors';
import { useTenantLogo } from '../../hooks/useTenantLogo';
import { useFilterWidth } from '../../hooks/useFilterWidth';
import { compressFile } from '../../utils/compressImage';
import { paidAtColumn, durationColumn, amountColumn, invoiceColumn, notesColumn } from '../../utils/paymentColumns';
import { EmptyState } from '../../components/EmptyState';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

function resolveColor(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toHexString' in value) {
    return (value as { toHexString: () => string }).toHexString();
  }
  return fallback;
}

/**
 * "Profil firme" — the tenant's own configuration page. Admin role of the
 * tenant manages the per-tenant settings here (warning / critical days,
 * theme colors, later: logo upload). SuperAdmins are intentionally NOT
 * involved in these — they only create the tenant + initial Admin from
 * TenantsPage, then the tenant runs its own brand/threshold tuning.
 *
 * Backed by GET/PUT /api/tenants/me/settings — both resolve the current
 * tenant from the JWT so this page doesn't need to know its own tenant id.
 */
interface TenantProfilePageProps {
  /** When true, suppress the top PageHeader — used when embedding this
   *  component as a tab panel inside FirmaPage. */
  hideHeader?: boolean;
}

export function TenantProfilePage({ hideHeader = false }: TenantProfilePageProps = {}) {
  const { t, i18n } = useTranslation('dashboard');
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const filterW = useFilterWidth();

  const { data: tenant } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy().then((r) => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['my-tenant-settings'],
    queryFn: () => tenantsApi.getMySettings().then((r) => r.data),
  });

  // Saša 18.06.2026: Admin gets a read-only view of their own company's
  // billing history so they can confirm "did our last payment register".
  // Mutations stay SuperAdmin-only on the {id} routes.
  const { data: myPayments = [] } = useQuery({
    queryKey: ['my-tenant-payments'],
    queryFn: () => tenantsApi.listMyPayments().then((r) => r.data),
  });

  // Days until paidThrough — drives the Statistic card coloring in the
  // Naplata tab. Negative = past, null = no current coverage.
  const daysToExpiry = tenant?.paidThrough
    ? dayjs(tenant.paidThrough).endOf('day').diff(dayjs().startOf('day'), 'day')
    : null;

  // Tab state — read from ?tab=billing so notifications can deep-link
  // straight to the Naplata tab. Writes back to the URL on switch so
  // refresh keeps you on the same tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') === 'billing' ? 'billing' : 'settings';
  const [activeTab, setActiveTabState] = useState<string>(tabFromUrl);
  useEffect(() => { setActiveTabState(tabFromUrl); }, [tabFromUrl]);
  const setActiveTab = (key: string) => {
    setActiveTabState(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'billing') next.set('tab', 'billing'); else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        defaultWarningDays: settings.defaultWarningDays,
        defaultCriticalDays: settings.defaultCriticalDays,
        warningColor: settings.warningColor,
        criticalColor: settings.criticalColor,
      });
    }
  }, [settings, form]);

  const logoObjectUrl = useTenantLogo();
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [paymentsYearFilter, setPaymentsYearFilter] = useState<number | undefined>(undefined);

  // Compress (raster only — SVG passes through compressFile unchanged) before
  // upload. Same util OrderAttachments uses, so PNG/JPG logos get capped at
  // ~1MB / 2048px regardless of what the user picks.
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressFile(file);
      return tenantsApi.uploadMyLogo(compressed).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tenant'] });
      message.success(t('admin.tenantProfile.logoUploaded'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.tenantProfile.logoUploadFailed'))),
  });

  const deleteLogoMutation = useMutation({
    mutationFn: () => tenantsApi.deleteMyLogo().then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tenant'] });
      message.success(t('admin.tenantProfile.logoRemoved'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.tenantProfile.logoUploadFailed'))),
  });

  // beforeUpload validates client-side, then kicks off our mutation (which
  // goes through the axios instance with JWT). We return false to suppress
  // antd's default upload — Upload.LIST_IGNORE for rejected files keeps the
  // failed entry out of the list.
  const uploadProps: UploadProps = {
    accept: ALLOWED_LOGO_TYPES.join(','),
    showUploadList: false,
    multiple: false,
    beforeUpload: (file) => {
      if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        message.error(t('admin.tenantProfile.logoBadType'));
        return Upload.LIST_IGNORE;
      }
      if (file.size > MAX_LOGO_BYTES) {
        message.error(t('admin.tenantProfile.logoTooLarge'));
        return Upload.LIST_IGNORE;
      }
      uploadMutation.mutate(file);
      return false;
    },
  };

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      tenantsApi.updateMySettings({
        defaultWarningDays: values.defaultWarningDays as number,
        defaultCriticalDays: values.defaultCriticalDays as number,
        warningColor: resolveColor(values.warningColor, '#faad14'),
        criticalColor: resolveColor(values.criticalColor, '#cf1322'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tenant-settings'] });
      message.success(t('admin.tenantProfile.saved'));
    },
    onError: (err) =>
      message.error(getTranslatedError(err, t, t('admin.tenantProfile.saveFailed'))),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {!hideHeader && (
        <PageHeader
          title={t('admin.tenantProfile.title')}
          subtitle={tenant ? <Typography.Text type="secondary">{tenant.name} · {tenant.code}</Typography.Text> : undefined}
        />
      )}

      {/* Two-panel split (Saša 18.06.2026): settings + billing live on
          separate tabs so neither buries the other. Subscription-expiry
          warnings live in the notification bell now (daily nudge from
          BillingReminderService) — no in-page banner. */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'settings',
            label: t('admin.tenantProfile.tabSettings'),
            children: renderSettingsTab(),
          },
          {
            key: 'billing',
            label: t('admin.tenantProfile.tabBilling'),
            children: renderBillingTab(),
          },
        ]}
      />

      {/* Click-to-enlarge — same modal pattern OrderAttachments uses for
          its image previews. Kept outside the Tabs since it's overlay UI. */}
      <Modal
        open={logoPreviewOpen}
        onCancel={() => setLogoPreviewOpen(false)}
        footer={null}
        width="80vw"
        style={{ top: 20 }}
        destroyOnHidden
      >
        {logoObjectUrl && (
          <img
            src={logoObjectUrl}
            style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            alt="Logo"
          />
        )}
      </Modal>
    </div>
  );

  function renderSettingsTab() {
    return (
      <Form
          form={form}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate(values)}
          initialValues={{
            defaultWarningDays: 7,
            defaultCriticalDays: 3,
            warningColor: '#FFA500',
            criticalColor: '#FF0000',
          }}
          style={{ maxWidth: 520 }}
        >
          <Divider orientation="left">{t('admin.tenantProfile.logoSection')}</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('admin.tenantProfile.logoHelp')}
          </Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 120,
                height: 80,
                border: '1px dashed #d9d9d9',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa',
                overflow: 'hidden',
                padding: 8,
              }}
            >
              {logoObjectUrl ? (
                <img
                  src={logoObjectUrl}
                  alt="Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }}
                  onClick={() => setLogoPreviewOpen(true)}
                />
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('admin.tenantProfile.noLogo')}
                </Typography.Text>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                  {tenant?.logoUrl
                    ? t('admin.tenantProfile.replaceLogo')
                    : t('admin.tenantProfile.uploadLogo')}
                </Button>
              </Upload>
              {tenant?.logoUrl && (
                <Popconfirm
                  title={t('admin.tenantProfile.removeLogoConfirm')}
                  onConfirm={() => deleteLogoMutation.mutate()}
                  okText={t('common:actions.confirm')}
                  cancelText={t('common:actions.cancel')}
                >
                  <Button danger icon={<DeleteOutlined />} loading={deleteLogoMutation.isPending}>
                    {t('admin.tenantProfile.removeLogo')}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>

          <Divider orientation="left">{t('admin.tenantProfile.deadlineSection')}</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('admin.tenantProfile.deadlineHelp')}
          </Typography.Text>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="defaultWarningDays"
              label={t('admin.tenants.defaultWarningDays')}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="defaultCriticalDays"
              label={t('admin.tenants.defaultCriticalDays')}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Divider orientation="left">{t('admin.tenantProfile.colorsSection')}</Divider>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="warningColor" label={t('admin.tenants.warningColor')}>
              <ColorPicker />
            </Form.Item>
            <Form.Item name="criticalColor" label={t('admin.tenants.criticalColor')}>
              <ColorPicker />
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
              {t('common:actions.save')}
            </Button>
          </Form.Item>
        </Form>
    );
  }

  function renderBillingTab() {
    // Client-side sort + Year filter mirror the SA per-tenant Naplata
    // table; an Admin reading their own history wants the same affordances.
    const columnOpts = { t, language: i18n.language, clientSort: true };
    const years = Array.from(new Set(myPayments.map((p) => dayjs(p.paidAt).year()))).sort((a, b) => b - a);
    const filtered = paymentsYearFilter
      ? myPayments.filter((p) => dayjs(p.paidAt).year() === paymentsYearFilter)
      : myPayments;
    return (
      <div style={{ maxWidth: 720 }}>
        <SubscriptionSummaryCard
          tenant={tenant}
          daysToExpiry={daysToExpiry}
          t={t}
          language={i18n.language}
        />
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder={t('admin.tenants.billing.filterByYear')}
            allowClear
            value={paymentsYearFilter}
            onChange={(v) => setPaymentsYearFilter(v)}
            style={{ width: filterW(140) }}
            disabled={years.length === 0}
            options={years.map((y) => ({ label: String(y), value: y }))}
          />
        </div>
        <Table
          size="small"
          dataSource={filtered}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: (
              <EmptyState
                description={paymentsYearFilter
                  ? t('admin.tenants.billing.noPaymentsForYear')
                  : t('admin.tenantProfile.noPayments')}
                action={paymentsYearFilter ? {
                  label: t('admin.tenants.clearFilters'),
                  icon: <ClearOutlined />,
                  onClick: () => setPaymentsYearFilter(undefined),
                } : undefined}
              />
            ),
          }}
          columns={[
            paidAtColumn(columnOpts),
            durationColumn(columnOpts),
            amountColumn(columnOpts),
            invoiceColumn(columnOpts),
            notesColumn(columnOpts),
          ]}
        />
      </div>
    );
  }
}

interface SubscriptionSummaryCardProps {
  tenant: { paidThrough: string | null; blockedAt: string | null } | undefined;
  daysToExpiry: number | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  language: string;
}

/**
 * At-a-glance subscription summary so the Admin doesn't have to mentally
 * add (paidAt + months) across stacked payments. Three visual states:
 *   - Active: green Statistic with date + days remaining.
 *   - Lapsed: red Statistic showing how many days ago it expired.
 *   - Never paid: neutral placeholder.
 * Blocked tenants get nothing here — the page-level Alert at the top
 * already covers that case with a clear "contact support" message.
 */
function SubscriptionSummaryCard({ tenant, daysToExpiry, t, language }: SubscriptionSummaryCardProps) {
  const { token } = theme.useToken();
  if (!tenant || tenant.blockedAt) return null;

  if (!tenant.paidThrough) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          {t('admin.tenantProfile.subscription.noneYet')}
        </Typography.Text>
      </Card>
    );
  }

  const dateLabel = dayjs(tenant.paidThrough).format('DD.MM.YYYY.');
  if (daysToExpiry !== null && daysToExpiry < 0) {
    const daysAgo = Math.abs(daysToExpiry);
    return (
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title={t('admin.tenantProfile.subscription.expiredOn')}
              value={dateLabel}
              valueStyle={{ color: token.colorError }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={t('admin.tenantProfile.subscription.lapsedBy')}
              value={formatDays(daysAgo, language)}
              valueStyle={{ color: token.colorError }}
            />
          </Col>
        </Row>
      </Card>
    );
  }

  const daysRemainingColor = daysToExpiry !== null && daysToExpiry <= 14
    ? token.colorWarning
    : token.colorSuccess;
  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Statistic
            title={t('admin.tenantProfile.subscription.activeUntil')}
            value={dateLabel}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={t('admin.tenantProfile.subscription.remaining')}
            value={formatDays(daysToExpiry ?? 0, language)}
            valueStyle={{ color: daysRemainingColor }}
          />
        </Col>
      </Row>
    </Card>
  );
}
