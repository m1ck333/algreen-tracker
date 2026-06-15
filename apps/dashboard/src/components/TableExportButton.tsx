import { useState } from 'react';
import { Dropdown, Button, App } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportOptions,
  type ExtraSheet,
} from '../utils/exportTable';
import { useTranslation } from '@alblue/i18n';

/** Optional second-sheet (XLSX) — built from the main rows. */
type XlsxExtraSheet<T> = {
  sheetName: string;
  /** Sub-rows derived from main rows (typically `flatMap`). */
  rowsFor: (mainRows: T[]) => unknown[];
  columns: ExportColumn<unknown>[];
};

/** Optional CSV override — produces a different (e.g. interleaved) row shape. */
type CsvOverride<T> = {
  rowsFor: (mainRows: T[]) => unknown[];
  columns: ExportColumn<unknown>[];
};

type Props<T> = {
  /** Fetch all rows (across all pages) for export. */
  onFetchAll: () => Promise<T[]>;
  columns: ExportColumn<T>[];
  options: ExportOptions;
  /** If true, render only an icon button (no label). */
  compact?: boolean;
  /**
   * XLSX-only: add one or more extra sheets after the main sheet. Used to
   * include drill-down data (e.g. sub-processes) as a normalized second sheet
   * linkable back to the main rows.
   */
  xlsxExtraSheets?: XlsxExtraSheet<T>[];
  /**
   * CSV-only: replace the main rows + columns with an alternate shape (e.g.
   * inline-flattened parent + sub rows with a leading "Tip reda" column). CSV
   * can't represent multi-sheet, so this is how we surface drill-down data.
   */
  csvOverride?: CsvOverride<T>;
};

export function TableExportButton<T>({
  onFetchAll,
  columns,
  options,
  compact,
  xlsxExtraSheets,
  csvOverride,
}: Props<T>) {
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    try {
      const rows = await onFetchAll();
      const localizedOptions = { ...options, generatedLabel: options.generatedLabel ?? t('export.generated') };
      let rowCount = rows.length;
      if (format === 'xlsx') {
        const extras: ExtraSheet<unknown>[] | undefined = xlsxExtraSheets?.map((es) => ({
          name: es.sheetName,
          rows: es.rowsFor(rows),
          columns: es.columns,
        }));
        await exportToXlsx(rows, columns, localizedOptions, extras);
      } else if (csvOverride) {
        const csvRows = csvOverride.rowsFor(rows);
        rowCount = csvRows.length;
        exportToCsv(csvRows, csvOverride.columns, localizedOptions);
      } else {
        exportToCsv(rows, columns, localizedOptions);
      }
      message.success(t('export.success', { count: rowCount }));
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
