import { describe, it, expect } from 'vitest';
import { passwordRules } from './password';

// Stub `t` to echo the key back, so assertions can check which message fired.
const t = (key: string) => key;

/** Pull the async complexity validator (rule index 1) out of the rules array. */
function validate(value: string | undefined, opts?: { required?: boolean }) {
  const rule = passwordRules(t, opts)[1] as {
    validator: (r: unknown, v: unknown) => Promise<void>;
  };
  return rule.validator({}, value);
}

describe('passwordRules — complexity validator (BE PasswordRule parity)', () => {
  it('accepts a valid password (letter + digit, 8–100 chars)', async () => {
    await expect(validate('passw0rd')).resolves.toBeUndefined();
  });

  it('rejects too short (<8)', async () => {
    await expect(validate('pass1')).rejects.toThrow('common:validation.passwordTooShort');
  });

  it('rejects too long (>100)', async () => {
    await expect(validate('a1' + 'a'.repeat(100))).rejects.toThrow('common:validation.passwordTooLong');
  });

  it('rejects digit-only (no letter)', async () => {
    await expect(validate('12345678')).rejects.toThrow('common:validation.passwordNeedsLetter');
  });

  it('rejects letter-only (no digit)', async () => {
    await expect(validate('passwords')).rejects.toThrow('common:validation.passwordNeedsDigit');
  });

  it('treats empty as a no-op when the field is optional', async () => {
    await expect(validate('', { required: false })).resolves.toBeUndefined();
    await expect(validate(undefined, { required: false })).resolves.toBeUndefined();
  });

  it('marks the field required by default, optional when asked', () => {
    expect(passwordRules(t)[0]).toMatchObject({ required: true });
    expect(passwordRules(t, { required: false })[0]).toMatchObject({ required: false });
  });
});
