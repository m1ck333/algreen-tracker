import { Tooltip, Typography, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useTranslation } from '@alblue/i18n';
import { ProcessStatus } from '@alblue/shared-types';
import type { OrderDetailDto, ProcessDto } from '@alblue/shared-types';
import {
  processStatusColors,
  READY_BORDER_COLOR,
  statusColor,
  formatDurationSec,
  calcLiveSeconds,
  getAggregateProcessState,
  type MasterRowFields,
} from './orderListHelpers';

const { Text } = Typography;

export function ProcessTimeline({
  order,
  processes,
  tEnum,
  masterRow,
}: {
  order: OrderDetailDto;
  processes: ProcessDto[];
  tEnum: (enumName: string, value: string) => string;
  masterRow?: MasterRowFields;
}) {
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();
  const STEP = 48; // px per process step
  const CIRCLE = 24;
  const totalWidth = processes.length * STEP;

  // Pre-compute aggregate states from BE-supplied per-process fields.
  const states = processes.map((proc) => getAggregateProcessState(masterRow, proc.id));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ position: 'relative', width: totalWidth, height: 44, marginLeft: 4, marginRight: 4 }}>
        {/* Connector lines layer */}
        {processes.map((proc, i) => {
          if (i === 0) return null;
          const prevCompleted = states[i - 1]?.status === ProcessStatus.Completed;
          // Line goes from center of previous circle to center of current circle
          const x1 = (i - 1) * STEP + STEP / 2;
          const x2 = i * STEP + STEP / 2;
          return (
            <div
              key={`line-${proc.id}`}
              style={{
                position: 'absolute',
                left: x1,
                top: CIRCLE / 2 - 1,
                width: x2 - x1,
                height: 2,
                backgroundColor: prevCompleted ? '#92D050' : '#D9D9D9', // palette-ok: connector (done / not-done)
              }}
            />
          );
        })}
        {/* Circles + labels layer */}
        {processes.map((proc, i) => {
          const state = states[i];
          const { status, isReady, isPaused: aggPaused } = state;
          const isCompleted = status === ProcessStatus.Completed;
          const x = i * STEP;

          const totalSec = order.items.reduce((sum, item) => {
            const p = item.processes.find((ip) => ip.processId === proc.id);
            return sum + (p ? calcLiveSeconds(p) : 0);
          }, 0);
          const timeStr = formatDurationSec(totalSec);
          // Bold "ready" border suppressed when any item is paused — paused
          // dominates aggregate (orange color) and overlaying bold = ready
          // contradicts the paused signal. Matches drawer→master-table behavior.
          const showBold = isReady && !aggPaused;
          const color = aggPaused ? '#FFAA00' : isReady ? '#BFBFBF' : (status ? processStatusColors[status] : '#F0F0F0');
          const tooltipStatus = aggPaused
            ? t('orders.paused')
            : isReady
              ? t('orders.ready')
              : (status ? tEnum('ProcessStatus', status) : t('orders.processNotApplicable'));

          return (
            <Tooltip key={proc.id} title={<div><div><b>{proc.name}</b></div><div style={{ color: isReady ? READY_BORDER_COLOR : statusColor(status, aggPaused) }}>{tooltipStatus}</div>{timeStr && <div>{timeStr}</div>}</div>}>
              <div style={{ position: 'absolute', left: x, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: STEP }}>
                <div style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: showBold ? `3px solid ${READY_BORDER_COLOR}` : ('2px solid ' + (status ? color : token.colorBorderSecondary)),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {isCompleted && <CheckOutlined style={{ fontSize: 12, color: '#fff' }} />}
                </div>
                <Text style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: token.colorTextSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: STEP - 4,
                  textAlign: 'center',
                  display: 'block',
                }}>{proc.code}</Text>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
