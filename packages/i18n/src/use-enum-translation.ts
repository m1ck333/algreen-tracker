import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

export function useEnumTranslation() {
  const { t } = useTranslation('common');

  const tEnum = useCallback(
    (enumName: string, value: string): string => {
      const key = `enums.${enumName}.${value}`;
      const translated = t(key);
      // If no translation found, return original value
      return translated === key ? value : translated;
    },
    [t],
  );

  return { tEnum };
}
