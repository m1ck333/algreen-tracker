import type { Rule } from 'antd/es/form';

/**
 * Password complexity policy — must stay in lockstep with the BE
 * `PasswordRule` validator (Identity.Application/Validators/PasswordRule.cs).
 *
 * Rules:
 *   - 8 — 100 characters
 *   - at least one letter (so digit-only "12345678" fails)
 *   - at least one digit (so letter-only "passwords" fails)
 *
 * Returns antd Form rules, so the field error UX matches every other
 * validated field in the dashboard.
 *
 * Pass `required: false` for fields where the password is optional (e.g.
 * an admin reset form that only submits when the field is non-empty).
 */
export function passwordRules(t: (key: string) => string, opts: { required?: boolean } = {}): Rule[] {
  const required = opts.required ?? true;
  return [
    { required, message: t('common:validation.passwordRequired') },
    {
      validator: async (_rule, value: string | undefined) => {
        // Empty + not-required is a valid no-op (don't change the password)
        if (!value) return;
        if (value.length < 8) throw new Error(t('common:validation.passwordTooShort'));
        if (value.length > 100) throw new Error(t('common:validation.passwordTooLong'));
        if (!/[A-Za-z]/.test(value)) throw new Error(t('common:validation.passwordNeedsLetter'));
        if (!/[0-9]/.test(value)) throw new Error(t('common:validation.passwordNeedsDigit'));
      },
    },
  ];
}
