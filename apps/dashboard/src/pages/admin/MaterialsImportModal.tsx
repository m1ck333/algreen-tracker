import { useState } from 'react';
import { Modal, Upload, Button, Table, Alert, Typography, Tag, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import ExcelJS from 'exceljs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { materialsApi } from '@alblue/api-client';
import type { ImportMaterialItem, ImportMaterialsResult } from '@alblue/api-client';
import { useTranslation } from '@alblue/i18n';
import { useFixedColumn } from '../../hooks/useFixedColumn';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

type ParsedRow = ImportMaterialItem & { __rowIndex: number; __error?: string };

const HEADER_ALIASES: Record<keyof ImportMaterialItem, string[]> = {
  code: ['kod', 'sifra', 'šifra', 'code'],
  name: ['naziv', 'name'],
  unit: ['jedinica mere', 'jm', 'unit'],
  category: ['kategorija', 'category'],
  minQuantity: ['min', 'min zaliha', 'min količina'],
  maxQuantity: ['max', 'max zaliha', 'max količina'],
  dimensionX: ['dimenzija x', 'dim x', 'x'],
  dimensionY: ['dimenzija y', 'dim y', 'y'],
  dimensionZ: ['dimenzija z', 'dim z', 'z'],
  location: ['pozicija', 'location'],
  notes: ['napomena', 'notes'],
};

function normaliseHeader(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

type ImportKey = keyof typeof HEADER_ALIASES;

function mapHeaderRow(headerCells: unknown[]): Partial<Record<ImportKey, number>> {
  const map: Partial<Record<ImportKey, number>> = {};
  const keys = Object.keys(HEADER_ALIASES) as ImportKey[];
  headerCells.forEach((cell, idx) => {
    const norm = normaliseHeader(cell);
    if (!norm) return;
    for (const key of keys) {
      if (HEADER_ALIASES[key].some((alias) => alias === norm)) {
        map[key] = idx;
        return;
      }
    }
  });
  return map;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

async function parseXlsx(file: File): Promise<{ rows: ParsedRow[]; missingRequired: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], missingRequired: [] };

  // Find header row: first row with a recognised "kod" / "code" cell.
  let headerRowIdx = -1;
  let headerMap: Partial<Record<keyof ImportMaterialItem, number>> = {};
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => { cells.push(cell.value); });
    const map = mapHeaderRow(cells);
    if (map.code != null) {
      headerRowIdx = r;
      headerMap = map;
      break;
    }
  }
  if (headerRowIdx < 0) return { rows: [], missingRequired: ['Kod'] };

  const required: (keyof ImportMaterialItem)[] = ['code', 'name', 'unit', 'category'];
  const missingRequired = required.filter((k) => headerMap[k] == null);
  if (missingRequired.length > 0) {
    const labels: Record<string, string> = { code: 'Kod', name: 'Naziv', unit: 'Jedinica mere', category: 'Kategorija' };
    return { rows: [], missingRequired: missingRequired.map((k) => labels[k] ?? k) };
  }

  const rows: ParsedRow[] = [];
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => { cells.push(cell.value); });

    const get = (key: keyof ImportMaterialItem): unknown => {
      const idx = headerMap[key];
      return idx == null ? undefined : cells[idx];
    };

    const code = toString(get('code'));
    if (!code) continue;
    const name = toString(get('name'));
    const unit = toString(get('unit'));
    const category = toString(get('category'));

    const minRaw = toNumber(get('minQuantity'));
    const maxRaw = toNumber(get('maxQuantity'));
    const minQuantity = Math.max(0, Math.round(minRaw ?? 0));
    const maxQuantity = Math.max(0, Math.round(maxRaw ?? 0));

    let error: string | undefined;
    if (!name) error = 'Naziv je prazan.';
    else if (!unit) error = 'JM je prazna.';
    else if (!category) error = 'Kategorija je prazna.';
    else if (maxQuantity > 0 && maxQuantity < minQuantity) error = 'Max je manji od Min.';

    rows.push({
      __rowIndex: r,
      __error: error,
      code,
      name,
      unit,
      category,
      minQuantity,
      maxQuantity,
      dimensionX: toNumber(get('dimensionX')),
      dimensionY: toNumber(get('dimensionY')),
      dimensionZ: toNumber(get('dimensionZ')),
      location: toString(get('location')) || null,
      notes: toString(get('notes')) || null,
    });
  }

  return { rows, missingRequired: [] };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MaterialsImportModal({ open, onClose }: Props) {
  const fixedCol = useFixedColumn();
  const { t } = useTranslation('dashboard');
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<UploadFile | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [result, setResult] = useState<ImportMaterialsResult | null>(null);

  const reset = () => { setFile(null); setParsedRows([]); setMissingRequired([]); setResult(null); };

  const mutation = useMutation({
    mutationFn: () => materialsApi.import({ items: parsedRows.filter((r) => !r.__error).map(({ __rowIndex: _i, __error: _e, ...rest }) => rest) }),
    onSuccess: (resp) => {
      setResult(resp.data);
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials-for-warehouse'] });
      if (resp.data.errors.length === 0) {
        message.success(t('materials.import.allOk'));
      }
    },
    onError: () => message.error(t('materials.import.failed')),
  });

  const handleFile = async (uploadFile: UploadFile) => {
    setResult(null);
    setFile(uploadFile);
    const f = (uploadFile.originFileObj ?? uploadFile) as unknown as File;
    try {
      const { rows, missingRequired: missing } = await parseXlsx(f);
      setMissingRequired(missing);
      setParsedRows(rows);
    } catch {
      setMissingRequired([]);
      setParsedRows([]);
      message.error(t('materials.import.parseFailed'));
    }
    return false;
  };

  const validCount = parsedRows.filter((r) => !r.__error).length;
  const errorCount = parsedRows.filter((r) => r.__error).length;

  return (
    <Modal
      title={t('materials.import.title')}
      open={open}
      onCancel={() => { onClose(); reset(); }}
      footer={
        result ? (
          <Button type="primary" onClick={() => { onClose(); reset(); }}>
            {t('common:actions.close')}
          </Button>
        ) : (
          <>
            <Button onClick={() => { onClose(); reset(); }}>{t('common:actions.cancel')}</Button>
            <Button
              type="primary"
              loading={mutation.isPending}
              disabled={validCount === 0}
              onClick={() => mutation.mutate()}
            >
              {t('materials.import.save', { n: validCount })}
            </Button>
          </>
        )
      }
      width={900}
      destroyOnHidden
    >
      {!file && (
        <Dragger
          accept=".xlsx"
          beforeUpload={handleFile}
          maxCount={1}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{t('materials.import.dropHint')}</p>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t('materials.import.formatHint')}
          </Paragraph>
        </Dragger>
      )}

      {file && missingRequired.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={t('materials.import.missingHeaders')}
          description={missingRequired.join(', ')}
          style={{ marginBottom: 12 }}
        />
      )}

      {file && !result && parsedRows.length > 0 && (
        <>
          <Paragraph style={{ marginBottom: 8 }}>
            <Text>{file.name}</Text>{' '}
            <Tag color="green">{t('materials.import.validCount', { n: validCount })}</Tag>
            {errorCount > 0 && <Tag color="red">{t('materials.import.errorCount', { n: errorCount })}</Tag>}
            <Button type="link" size="small" onClick={reset}>{t('materials.import.pickAnother')}</Button>
          </Paragraph>
          <Table
            size="small"
            dataSource={parsedRows}
            rowKey="__rowIndex"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content', y: 320 }}
            columns={[
              { title: '#', dataIndex: '__rowIndex', width: 50 },
              {
                title: t('materials.code'),
                dataIndex: 'code',
                width: 100,
                fixed: fixedCol('left'),
                render: (v: string, r: ParsedRow) => r.__error ? <Text type="danger">{v}</Text> : v,
              },
              { title: t('materials.name'), dataIndex: 'name', width: 220 },
              { title: t('materials.unit'), dataIndex: 'unit', width: 70, align: 'center' },
              { title: t('materials.category'), dataIndex: 'category', width: 140 },
              { title: t('materials.min'), dataIndex: 'minQuantity', width: 70, align: 'right' },
              { title: t('materials.max'), dataIndex: 'maxQuantity', width: 70, align: 'right' },
              { title: t('materials.dimX'), dataIndex: 'dimensionX', width: 70, align: 'right', render: (v: number | null) => v ?? '—' },
              { title: t('materials.dimY'), dataIndex: 'dimensionY', width: 70, align: 'right', render: (v: number | null) => v ?? '—' },
              { title: t('materials.dimZ'), dataIndex: 'dimensionZ', width: 70, align: 'right', render: (v: number | null) => v ?? '—' },
              { title: t('materials.location'), dataIndex: 'location', width: 100, render: (v: string | null) => v || '—' },
              { title: t('materials.import.parseError'), dataIndex: '__error', render: (v: string | undefined) => v ? <Tag color="red">{v}</Tag> : '—' },
            ]}
          />
        </>
      )}

      {result && (
        <>
          <Alert
            type={result.errors.length === 0 ? 'success' : 'warning'}
            showIcon
            message={t('materials.import.resultSummary', { c: result.created, e: result.errors.length })}
            style={{ marginBottom: 12 }}
          />
          {result.errors.length > 0 && (
            <Table
              size="small"
              dataSource={result.errors}
              rowKey="rowIndex"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '#', dataIndex: 'rowIndex', width: 60 },
                { title: t('materials.code'), dataIndex: 'code', width: 120 },
                { title: t('materials.import.parseError'), dataIndex: 'reason' },
              ]}
            />
          )}
        </>
      )}
    </Modal>
  );
}
