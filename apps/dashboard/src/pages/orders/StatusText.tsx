import { Typography } from 'antd';
import { useEnumTranslation } from '@alblue/i18n';
import type { OrderStatus } from '@alblue/shared-types';
import { orderStatusTextColors } from './orderListHelpers';

const { Text } = Typography;

export function StatusText({ status }: { status: OrderStatus }) {
  const { tEnum } = useEnumTranslation();
  return (
    <Text style={{ color: orderStatusTextColors[status], fontWeight: 500 }}>
      #{tEnum('OrderStatus', status)}
    </Text>
  );
}
