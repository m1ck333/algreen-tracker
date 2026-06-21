import { Tooltip, theme } from 'antd';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import { ProcessStatus } from '@alblue/shared-types';
import type { OrderItemSubProcessDto, ProcessDto } from '@alblue/shared-types';
import {
  processStatusColors,
  READY_BORDER_COLOR,
  statusColor,
  formatDurationSec,
} from './orderListHelpers';

export function SubProcessTooltip({ subProcesses, processMap }: { subProcesses: OrderItemSubProcessDto[]; processMap: Map<string, ProcessDto> }) {
  const { tEnum } = useEnumTranslation();
  if (!subProcesses || subProcesses.length === 0) return null;
  const active = subProcesses.filter((sp) => !sp.isWithdrawn);
  if (active.length === 0) return null;
  return (
    <div style={{ marginTop: 4, paddingTop: 4, borderTop: '2px solid rgba(255,255,255,0.5)', fontSize: 11 }}>
      {active.map((sp) => {
        const spTime = sp.totalDurationMinutes + (sp.isTimerRunning && sp.currentLogStartedAt ? Math.floor((Date.now() - new Date(sp.currentLogStartedAt).getTime()) / 1000) : 0);
        // Find sub-process name from process definitions
        let spName = sp.subProcessId.slice(0, 6);
        for (const p of processMap.values()) {
          const found = p.subProcesses?.find((s) => s.id === sp.subProcessId);
          if (found) { spName = found.name; break; }
        }
        return (
          <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, opacity: sp.status === 'Completed' ? 0.7 : 1 }}>
            <span>↳ {spName}</span>
            <span style={{ color: statusColor(sp.status, false) }}>
              {tEnum('SubProcessStatus', sp.status)}
              {spTime > 0 ? ` ${formatDurationSec(spTime)}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProcessCell({
  status,
  processName,
  isReady,
  duration,
  paused,
  tEnum,
}: {
  status: ProcessStatus | null;
  processName: string;
  isReady?: boolean;
  duration?: number;
  paused?: boolean;
  tEnum: (enumName: string, value: string) => string;
}) {
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();
  if (status === null) {
    return (
      <div style={{
        width: 24,
        height: 24,
        margin: '0 auto',
        borderRadius: 4,
        border: `1px dashed ${token.colorBorderSecondary}`,
      }} />
    );
  }

  // Paused sub-process gap: show as orange with bold border instead of blue
  const showAsReady = paused && status === ProcessStatus.InProgress;
  const color = showAsReady ? '#FFAA00' : processStatusColors[status];
  const label = tEnum('ProcessStatus', status);

  const timeStr = duration ? formatDurationSec(duration) : '';

  const tooltipStatus = paused ? t('orders.paused') : (isReady ? t('orders.ready') : label);
  return (
    <Tooltip title={<div><div><b>{processName}</b></div><div style={{ color: isReady ? READY_BORDER_COLOR : statusColor(status, !!paused) }}>{tooltipStatus}</div>{timeStr && <div>{timeStr}</div>}</div>}>
      <div
        style={{
          width: 24,
          height: 24,
          margin: '0 auto',
          borderRadius: 4,
          backgroundColor: color,
          border: isReady ? `3px solid ${READY_BORDER_COLOR}` : `1px solid ${token.colorBorderSecondary}`,
          cursor: 'default',
        }}
      />
    </Tooltip>
  );
}
