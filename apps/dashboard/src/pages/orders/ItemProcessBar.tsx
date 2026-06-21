import { Tooltip, Dropdown, theme } from 'antd';
import { useTranslation } from '@alblue/i18n';
import { ProcessStatus } from '@alblue/shared-types';
import type { OrderItemDto, ProcessDto } from '@alblue/shared-types';
import {
  processStatusColors,
  READY_BORDER_COLOR,
  statusColor,
  formatDurationSec,
  calcLiveSeconds,
  isPaused,
} from './orderListHelpers';
import { SubProcessTooltip } from './ProcessCell';

export function ItemProcessBar({
  item,
  processMap,
  tEnum,
  onRestart,
  canRestart,
  itemProcessReady,
}: {
  item: OrderItemDto;
  processMap: Map<string, ProcessDto>;
  tEnum: (enumName: string, value: string) => string;
  onRestart?: (orderItemProcessId: string, resetTime: boolean) => void;
  canRestart?: boolean;
  /** Per-item readiness map keyed by processId. Source of truth from BE. */
  itemProcessReady?: Record<string, boolean>;
}) {
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();
  const sorted = [...item.processes]
    .filter((p) => p.status !== ProcessStatus.Withdrawn)
    .sort((a, b) => {
      const pa = processMap.get(a.processId);
      const pb = processMap.get(b.processId);
      return (pa?.sequenceOrder ?? 0) - (pb?.sequenceOrder ?? 0);
    });

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {sorted.map((proc) => {
        const process = processMap.get(proc.processId);
        const procPaused = isPaused(proc);
        // Trust BE's per-item readiness. Was previously recomputed from a flat
        // processDependencies dict which unioned deps across categories and
        // gave wrong answers for multi-item orders.
        const isReady = !!itemProcessReady?.[proc.processId];
        const color = procPaused ? '#FFAA00' : processStatusColors[proc.status];
        const statusLabel = tEnum('ProcessStatus', proc.status);
        return (
          canRestart && proc.status === ProcessStatus.Completed && onRestart ? (
            <Dropdown
              key={proc.id}
              trigger={['click']}
              menu={{
                items: [
                  { key: 'keep', label: t('orders.restartKeepTime'), onClick: () => onRestart(proc.id, false) },
                  { key: 'reset', label: t('orders.restartResetTime'), onClick: () => onRestart(proc.id, true) },
                ],
              }}
            >
              <Tooltip title={<div><div><b>{process?.name ?? proc.processId}</b></div><div style={{ color: isReady ? READY_BORDER_COLOR : statusColor(proc.status, procPaused) }}>{procPaused ? t('orders.paused') : isReady ? t('orders.ready') : statusLabel}</div>{calcLiveSeconds(proc) > 0 && <div>{formatDurationSec(calcLiveSeconds(proc))}</div>}{proc.subProcesses && <SubProcessTooltip subProcesses={proc.subProcesses} processMap={processMap} />}</div>}>
                <div style={{
                  padding: '2px 6px', borderRadius: 4, backgroundColor: color,
                  border: isReady ? `3px solid ${READY_BORDER_COLOR}` : `1px solid ${token.colorBorderSecondary}`, fontSize: 11, fontWeight: 500,
                  color: (procPaused || isReady) ? '#666' : '#fff', cursor: 'pointer', lineHeight: '16px',
                }}>
                  {process?.code ?? '?'}{proc.complexity ? <span style={{ opacity: 0.85 }}> {proc.complexity}</span> : null}
                </div>
              </Tooltip>
            </Dropdown>
          ) : (
            <Tooltip
              key={proc.id}
              title={
                <div>
                  <div><b>{process?.name ?? proc.processId}</b></div>
                  <div style={{ color: isReady ? READY_BORDER_COLOR : statusColor(proc.status, procPaused) }}>{procPaused ? t('orders.paused') : isReady ? t('orders.ready') : statusLabel}</div>
                  {(proc.complexity || calcLiveSeconds(proc) > 0) && (
                    <div>{proc.complexity ?? ''}{calcLiveSeconds(proc) > 0 ? `${proc.complexity ? ' · ' : ''}${formatDurationSec(calcLiveSeconds(proc))}` : ''}</div>
                  )}
                  {proc.subProcesses && <SubProcessTooltip subProcesses={proc.subProcesses} processMap={processMap} />}
                </div>
              }
            >
              <div style={{
                padding: '2px 6px', borderRadius: 4, backgroundColor: color,
                border: isReady ? `3px solid ${READY_BORDER_COLOR}` : `1px solid ${token.colorBorderSecondary}`, fontSize: 11, fontWeight: 500,
                color: proc.status === ProcessStatus.Pending || proc.status === ProcessStatus.Withdrawn || procPaused ? '#666' : '#fff',
                cursor: 'default', lineHeight: '16px',
              }}>
                {process?.code ?? '?'}{proc.complexity ? <span style={{ opacity: 0.85 }}> {proc.complexity}</span> : null}
              </div>
            </Tooltip>
          )
        );
      })}
    </div>
  );
}
