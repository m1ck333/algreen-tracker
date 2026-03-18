import { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { useTranslation } from '@algreen/i18n';

/**
 * Hook that guards drawer/modal close when a user has actually edited form fields.
 * Uses onValuesChange to track real user interaction (ignores programmatic setFieldsValue).
 *
 * Usage:
 *   const { guardedClose, onValuesChange } = useUnsavedChanges(isOpen);
 *   <Drawer onClose={() => guardedClose(actualClose)} ... />
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
    (closeFn: () => void) => {
      if (dirty) {
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
