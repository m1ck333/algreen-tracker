import { useState } from 'react';
import { Dropdown, Button, App } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import { exportToCsv, exportToXlsx, type ExportColumn, type ExportOptions } from '../utils/exportTable';
import { useTranslation } from '@algreen/i18n';

type Props<T> = {
  /** Fetch all rows (across all pages) for export. */
  onFetchAll: () => Promise<T[]>;
  columns: ExportColumn<T>[];
  options: ExportOptions;
  /** If true, render only an icon button (no label). */
  compact?: boolean;
};

export function TableExportButton<T>({ onFetchAll, columns, options, compact }: Props<T>) {
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    try {
      const rows = await onFetchAll();
      const localizedOptions = { ...options, generatedLabel: options.generatedLabel ?? t('export.generated') };
      if (format === 'xlsx') {
        await exportToXlsx(rows, columns, localizedOptions);
      } else {
        exportToCsv(rows, columns, localizedOptions);
      }
      message.success(t('export.success', { count: rows.length }));
    } catch (err) {
      console.error('[Export] failed:', err);
      message.error(t('export.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dropdown
      disabled={busy !== null}
      menu={{
        items: [
          {
            key: 'xlsx',
            icon: busy === 'xlsx' ? <LoadingOutlined /> : <FileExcelOutlined />,
            label: t('export.xlsx'),
            onClick: () => run('xlsx'),
          },
          {
            key: 'csv',
            icon: busy === 'csv' ? <LoadingOutlined /> : <FileTextOutlined />,
            label: t('export.csv'),
            onClick: () => run('csv'),
          },
        ],
      }}
    >
      <Button icon={busy ? <LoadingOutlined /> : <DownloadOutlined />}>
        {compact ? null : t('export.button')}
      </Button>
    </Dropdown>
  );
}
