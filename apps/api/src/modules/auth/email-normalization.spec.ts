import { normalizeEmail, isValidEmailFormat } from './email-normalization';

describe('email normalization', () => {
  it('trims and lowercases the full address', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('does not apply provider-specific transforms', () => {
    expect(normalizeEmail('user.name+tag@gmail.com')).toBe(
      'user.name+tag@gmail.com',
    );
  });

  it('validates basic email format', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
    expect(isValidEmailFormat('not-an-email')).toBe(false);
    expect(isValidEmailFormat('')).toBe(false);
  });
});
