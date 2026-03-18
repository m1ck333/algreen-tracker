import { useEffect, useCallback } from 'react';
import type { FormInstance } from 'antd';
import { Modal } from 'antd';
import { useTranslation } from '@algreen/i18n';

/**
 * Hook that guards drawer/modal close when an antd Form has unsaved changes.
 * Also adds a `beforeunload` listener so the browser warns on refresh/tab close.
 *
 * Usage:
 *   const { guardedClose } = useUnsavedChanges(form, isOpen);
 *   <Drawer onClose={() => guardedClose(actualClose)} ... />
 */
export function useUnsavedChanges(form: FormInstance, isOpen: boolean) {
  const { t } = useTranslation();

  // Browser refresh / tab close guard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (form.isFieldsTouched()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isOpen, form]);

  const guardedClose = useCallback(
    (closeFn: () => void) => {
      if (form.isFieldsTouched()) {
        Modal.confirm({
          title: t('common:messages.unsavedChanges'),
          content: t('common:messages.unsavedChangesDescription'),
          okText: t('common:actions.discard'),
          okType: 'danger',
          cancelText: t('common:actions.cancel'),
          onOk: closeFn,
        });
      } else {
        closeFn();
      }
    },
    [form, t],
  );

  return { guardedClose };
}
