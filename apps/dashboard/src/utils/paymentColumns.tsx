import { Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { formatMonths } from './formatMonths';

/** Loose `t` typing — the dashboard's @alblue/i18n re-exports react-i18next's
 *  hook, but we don't want this util to pull the whole library type tree
 *  for one prop. Anything with a (key, options?) => string call signature
 *  satisfies it, including i18next's TFunction. */
type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Minimal payment shape the shared columns read. Both `TenantPaymentDto`
 * (per-tenant view) and `AllTenantPaymentDto` (cross-tenant view) satisfy
 * it, so the columns are usable on both lists.
 */
export interface PaymentRow {
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  notes: string | null;
}

interface BuildOptions {
  t: TFn;
  language: string;
  /** When true, the Datum uplate column carries a default-descending sort
   *  config (client-side). Sve uplate uses server-side sort, so it passes
   *  false and wires its own sorter via Table props. */
  clientSort?: boolean;
}

export function paidAtColumn<T extends PaymentRow>({ t, clientSort }: BuildOptions) {
  return {
    title: t('admin.tenants.billing.paidAtColumn'),
    dataIndex: 'paidAt' as const,
    width: 130,
    ...(clientSort
      ? {
          sorter: (a: T, b: T) => dayjs(a.paidAt).valueOf() - dayjs(b.paidAt).valueOf(),
          defaultSortOrder: 'descend' as const,
        }
      : {}),
    render: (d: string) => dayjs(d).format('DD.MM.YYYY.'),
  };
}

export function durationColumn<T extends PaymentRow>({ t, language, clientSort }: BuildOptions) {
  return {
    title: t('admin.tenants.billing.duration'),
    key: 'periodStart',
    width: 120,
    ...(clientSort
      ? { sorter: (a: T, b: T) => dayjs(a.periodStart).valueOf() - dayjs(b.periodStart).valueOf() }
      : {}),
    render: (_: unknown, row: T) => {
      const months = Math.max(1, Math.round(dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month', true)));
      return <span style={{ whiteSpace: 'nowrap' }}>{formatMonths(months, language)}</span>;
    },
  };
}

export function amountColumn<T extends PaymentRow>({ t, clientSort }: BuildOptions) {
  return {
    title: t('admin.tenants.billing.amount'),
    key: 'amount',
    width: 130,
    ...(clientSort
      ? { sorter: (a: T, b: T) => a.amount - b.amount }
      : {}),
    render: (_: unknown, row: T) =>
      `${row.amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row.currency}`,
  };
}

export function invoiceColumn<T extends PaymentRow>({ t, clientSort }: BuildOptions) {
  return {
    title: t('admin.tenants.billing.invoiceNumber'),
    dataIndex: 'invoiceNumber' as const,
    width: 130,
    ...(clientSort
      ? { sorter: (a: T, b: T) => (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '') }
      : {}),
    render: (v: string | null) => v || <Typography.Text type="secondary">—</Typography.Text>,
  };
}

export function notesColumn<T extends PaymentRow>({ t }: BuildOptions) {
  return {
    title: t('admin.tenants.billing.notes'),
    dataIndex: 'notes' as const,
    width: 200,
    render: (v: string | null) =>
      v
        ? (
            <Tooltip title={v}>
              <Typography.Text ellipsis style={{ maxWidth: 200, display: 'inline-block' }}>{v}</Typography.Text>
            </Tooltip>
          )
        : <Typography.Text type="secondary">—</Typography.Text>,
  };
}
