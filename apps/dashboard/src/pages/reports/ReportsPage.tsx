import { Tabs } from 'antd';
import { useTranslation } from '@alblue/i18n';
import { PageHeader } from '../../components/PageHeader';
import { ProcessAveragesTab } from './ProcessAveragesTab';
import { TimeTrackingTab } from './TimeTrackingTab';
import { WorkerHoursTab } from './WorkerHoursTab';
import { BlocksPerProcessTab } from './BlocksPerProcessTab';
import { ProductManufacturingTimeTab } from './ProductManufacturingTimeTab';
import { WorkEfficiencyTab } from './WorkEfficiencyTab';

export function ReportsPage() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <PageHeader title={t('reports.title')} />
      <Tabs
        defaultActiveKey="averages"
        destroyOnHidden
        items={[
          {
            key: 'averages',
            label: t('reports.tabAverages'),
            children: <ProcessAveragesTab />,
          },
          {
            key: 'tracking',
            label: t('reports.tabTimeTracking'),
            children: <TimeTrackingTab />,
          },
          {
            key: 'workers',
            label: t('reports.tabWorkerHours'),
            children: <WorkerHoursTab />,
          },
          {
            key: 'blocks',
            label: t('reports.tabBlocksPerProcess'),
            children: <BlocksPerProcessTab />,
          },
          {
            key: 'manufacturing',
            label: t('reports.tabProductManufacturingTime'),
            children: <ProductManufacturingTimeTab />,
          },
          {
            key: 'efficiency',
            label: t('reports.tabWorkEfficiency'),
            children: <WorkEfficiencyTab />,
          },
        ]}
      />
    </div>
  );
}
