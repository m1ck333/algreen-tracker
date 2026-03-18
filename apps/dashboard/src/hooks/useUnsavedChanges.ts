import { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { useTranslation } from '@algreen/i18n';

/**
 * Hook that guards drawer/modal close when a user has actually edited form fields.
 * Only shows warning on mask clicks (clicking outside). X button always closes directly.
 *
 * Usage:
 *   const { guardedClose, onValuesChange } = useUnsavedChanges(isOpen);
 *   <Drawer onClose={(e) => guardedClose(actualClose, e)} ... />
 *   <Form onValuesChange={onValuesChange} ... />
 */
export function useUnsavedChanges(isOpen: boolean) {
  const { t } = useTranslation();
  const [dirty, setDirty] = useState(false);

  // Reset dirty when drawer closes
  useEffect(() => {
    if (!isOpen) setDirty(false);
  }, [isOpen]);

  const onValuesChange = useCallback(() => {
    setDirty(true);
  }, []);

  // Browser refresh / tab close guard
  useEffect(() => {
    if (!isOpen || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isOpen, dirty]);

  const guardedClose = useCallback(
    (closeFn: () => void, e?: React.MouseEvent | React.KeyboardEvent) => {
      // Only guard mask clicks (clicking outside); X button / Escape always close directly
      const isMaskClick = e && (e.target as HTMLElement).classList.contains('ant-drawer-mask');
      if (dirty && isMaskClick) {
        Modal.confirm({
          title: t('common:messages.unsavedChanges'),
          content: t('common:messages.unsavedChangesDescription'),
          okText: t('common:actions.discardChanges'),
          okType: 'danger',
          cancelText: t('common:actions.keepEditing'),
          onOk: () => {
            setDirty(false);
            closeFn();
          },
        });
      } else {
        closeFn();
      }
    },
    [dirty, t],
  );

  return { guardedClose, onValuesChange };
}
