import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export type ExportCellStyle = {
  /** Hex without leading # — e.g. "92D050". */
  fillColor?: string;
  /** Hex without leading # — e.g. "FFFFFF". */
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
};

export type ExportColumn<T> = {
  header: string;
  /**
   * Returns the analytical value placed in the cell.
   * Strings/numbers/dates/booleans/null. Avoid React nodes — this is a flat data export.
   */
  value: (row: T) => string | number | boolean | Date | null | undefined;
  /** Optional per-row style (XLSX only). CSV ignores. */
  cell?: (row: T) => ExportCellStyle | undefined;
  /** Column width in characters (XLSX). Defaults to 18. */
  width?: number;
  /** Header alignment for XLSX. Defaults to 'left'. */
  align?: 'left' | 'center' | 'right';
};

export type ExportOptions = {
  /** File name without extension. */
  fileName: string;
  /** Title row at top of file (e.g. "Alblue MES — Orders"). */
  title?: string;
  /** Filter context lines shown under the title. */
  filters?: Array<{ label: string; value: string }>;
  /** XLSX sheet name. Defaults to "Sheet1". */
  sheetName?: string;
  /** Localized prefix for the timestamp row (e.g. "Generisano" / "Generated"). Defaults to "Generated". */
  generatedLabel?: string;
};

const TITLE_FILL = 'FF1F4E78';
const TITLE_FONT = 'FFFFFFFF';
const HEADER_FILL = 'FFD9E1F2';

function formatTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toExcelArgb(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace('#', '').toUpperCase();
  if (clean.length === 6) return `FF${clean}`;
  if (clean.length === 8) return clean;
  return undefined;
}

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function escapeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ─── XLSX ────────────────────────────────────────────────

/**
 * Extra sheet spec for multi-sheet XLSX exports. The first/main sheet still
 * carries title + filter context; extra sheets get only their own header row
 * and data (kept minimal so the second sheet reads as a clean reference table).
 */
export type ExtraSheet<S> = {
  name: string;
  rows: S[];
  columns: ExportColumn<S>[];
};

function writeSheetData<T>(
  sheet: ExcelJS.Worksheet,
  rows: T[],
  columns: ExportColumn<T>[],
  startRow: number,
): number {
  let currentRow = startRow;
  // Header row
  const headerRow = sheet.getRow(currentRow);
  let maxHeaderLines = 1;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF8EA9DB' } },
      bottom: { style: 'thin', color: { argb: 'FF8EA9DB' } },
      left: { style: 'thin', color: { argb: 'FF8EA9DB' } },
      right: { style: 'thin', color: { argb: 'FF8EA9DB' } },
    };
    const effectiveWidth = col.width ?? 18;
    const lines = Math.max(1, Math.ceil(col.header.length / effectiveWidth));
    if (lines > maxHeaderLines) maxHeaderLines = lines;
  });
  headerRow.height = Math.max(20, maxHeaderLines * 18);
  sheet.views = [{ state: 'frozen', ySplit: currentRow }];
  currentRow++;

  // Data rows
  for (const row of rows) {
    const r = sheet.getRow(currentRow);
    columns.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      const v = col.value(row);
      if (v instanceof Date) {
        cell.value = v;
        cell.numFmt = 'dd.mm.yyyy hh:mm';
      } else if (v === null || v === undefined) {
        cell.value = '';
      } else {
        cell.value = v as string | number | boolean;
      }
      const style = col.cell?.(row);
      if (style) {
        const fill = toExcelArgb(style.fillColor);
        if (fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        }
        const font: Partial<ExcelJS.Font> = {};
        const fontArgb = toExcelArgb(style.fontColor);
        if (fontArgb) font.color = { argb: fontArgb };
        if (style.bold) font.bold = true;
        if (style.italic) font.italic = true;
        if (Object.keys(font).length > 0) cell.font = font;
      }
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
    currentRow++;
  }

  // Column widths
  columns.forEach((col, i) => {
    const headerWidth = col.header.length + 2;
    sheet.getColumn(i + 1).width = Math.max(col.width ?? 18, headerWidth);
  });

  return currentRow;
}

export async function exportToXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions,
  extraSheets?: ExtraSheet<unknown>[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.creator = 'Algreen MES';
  const sheet = workbook.addWorksheet(options.sheetName ?? 'Sheet1');

  const colCount = columns.length;
  let currentRow = 1;

  // Title row
  if (options.title) {
    sheet.mergeCells(currentRow, 1, currentRow, colCount);
    const cell = sheet.getCell(currentRow, 1);
    cell.value = options.title;
    cell.font = { bold: true, size: 14, color: { argb: TITLE_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(currentRow).height = 22;
    currentRow++;
  }

  // Generated timestamp
  sheet.mergeCells(currentRow, 1, currentRow, colCount);
  const tsCell = sheet.getCell(currentRow, 1);
  tsCell.value = `${options.generatedLabel ?? 'Generated'}: ${formatTimestamp(new Date())}`;
  tsCell.font = { italic: true, color: { argb: 'FF595959' } };
  currentRow++;

  // Filter context
  if (options.filters?.length) {
    for (const filter of options.filters) {
      sheet.mergeCells(currentRow, 1, currentRow, colCount);
      const fCell = sheet.getCell(currentRow, 1);
      fCell.value = `${filter.label}: ${filter.value}`;
      fCell.font = { italic: true, color: { argb: 'FF595959' } };
      currentRow++;
    }
  }

  writeSheetData(sheet, rows, columns, currentRow);

  // Extra sheets (no title / filter context — just header + data)
  if (extraSheets?.length) {
    for (const extra of extraSheets) {
      const extraSheet = workbook.addWorksheet(extra.name);
      writeSheetData(extraSheet, extra.rows, extra.columns as ExportColumn<unknown>[], 1);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${options.fileName}.xlsx`);
}

// ─── CSV ────────────────────────────────────────────────

export function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions,
): void {
  const lines: string[] = [];
  const colCount = columns.length;
  // Metadata rows get padded with empty cells so spreadsheet viewers don't
  // size column A to fit the entire title (which made Numbers/Excel render
  // the rest of the columns as a tiny strip).
  const padToAllColumns = (text: string) => escapeCsv(text) + ','.repeat(Math.max(0, colCount - 1));

  if (options.title) lines.push(padToAllColumns(options.title));
  lines.push(padToAllColumns(`${options.generatedLabel ?? 'Generated'}: ${formatTimestamp(new Date())}`));
  if (options.filters?.length) {
    for (const filter of options.filters) {
      lines.push(padToAllColumns(`${filter.label}: ${filter.value}`));
    }
  }

  lines.push(columns.map((c) => escapeCsv(c.header)).join(','));

  for (const row of rows) {
    lines.push(
      columns
        .map((col) => {
          const v = col.value(row);
          return escapeCsv(valueToString(v));
        })
        .join(','),
    );
  }

  // BOM so Excel detects UTF-8 (preserves Serbian characters)
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${options.fileName}.csv`);
}
