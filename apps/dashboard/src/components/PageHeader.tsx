import { Typography, Space } from 'antd';
import type { ReactNode } from 'react';

const { Title } = Typography;

interface PageHeaderProps {
  title: ReactNode;
  /** Right-aligned action buttons. Wrapped in a <Space> when supplied. */
  actions?: ReactNode;
  /** Optional element rendered below the title (subtitle, intro paragraph, …). */
  subtitle?: ReactNode;
}

/**
 * The standardised page header used at the top of every list / form / detail
 * page. Owns the title row's vertical spacing (16px below) so the body
 * underneath sits at a consistent distance regardless of which page rendered
 * it. Replaces ~15 inline copies of
 *   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
 *     <Title level={4} style={{ margin: 0 }}>…</Title>
 *     <Space>…</Space>
 *   </div>
 * across the codebase.
 */
export function PageHeader({ title, actions, subtitle }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Title level={4}>{title}</Title>
        {actions && <Space wrap>{actions}</Space>}
      </div>
      {subtitle && <div style={{ marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
