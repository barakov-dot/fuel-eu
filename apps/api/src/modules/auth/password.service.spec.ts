import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  const validPassword = 'secure-passphrase-1';

  it('hashes password differently from raw input', async () => {
    const hash = await service.hashPassword(validPassword);
    expect(hash).not.toBe(validPassword);
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('produces different salted hashes for the same password', async () => {
    const [hashA, hashB] = await Promise.all([
      service.hashPassword(validPassword),
      service.hashPassword(validPassword),
    ]);
    expect(hashA).not.toBe(hashB);
  });

  it('verifies correct password', async () => {
    const hash = await service.hashPassword(validPassword);
    await expect(service.verifyPassword(validPassword, hash)).resolves.toBe(
      true,
    );
  });

  it('rejects incorrect password', async () => {
    const hash = await service.hashPassword(validPassword);
    await expect(service.verifyPassword('wrong-password', hash)).resolves.toBe(
      false,
    );
  });

  it('rejects passwords below minimum length', () => {
    expect(() => service.assertPasswordPolicy('short')).toThrow();
  });
});
