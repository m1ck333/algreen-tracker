import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  description: ReactNode;
  /** Optional CTA button — shown beneath the description. */
  action?: { label: ReactNode; onClick: () => void; icon?: ReactNode };
}

/**
 * Wraps antd `Empty` with a contextual call-to-action so empty tables
 * don't leave the user staring at a dead end. Use the existing
 * `Empty.PRESENTED_IMAGE_SIMPLE` look + a single primary button.
 */
export function EmptyState({ description, action }: EmptyStateProps) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
    >
      {action && (
        <Button type="primary" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Empty>
  );
}
