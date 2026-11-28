import { describe, expect, it } from 'vitest';
import { validatePassword } from './validators';

// The web signup rule (REQ-AUTH-10): stricter than the API, which only asks for 6 characters.
describe('validatePassword', () => {
  it('accepts 8 characters with a lower case letter, an upper case letter and a digit (the lower boundary)', () => {
    expect(validatePassword('Abcdef12')).toEqual({ valid: true });
  });

  it('accepts a long password and symbols', () => {
    expect(validatePassword('Correct-Horse-Battery-Staple-9!')).toEqual({ valid: true });
  });

  it('refuses 7 characters, even with every kind of character', () => {
    expect(validatePassword('Abcde12')).toEqual({ valid: false, message: 'Password must be at least 8 characters' });
  });

  it('refuses the empty password with the length message', () => {
    expect(validatePassword('')).toEqual({ valid: false, message: 'Password must be at least 8 characters' });
  });

  it.each([
    ['no upper case letter', 'abcdef12'],
    ['no lower case letter', 'ABCDEF12'],
    ['no digit', 'Abcdefgh'],
    ['only digits', '12345678'],
  ])('refuses 8 characters with %s', (_label, password) => {
    expect(validatePassword(password)).toEqual({ valid: false, message: 'Password must contain uppercase, lowercase, and number' });
  });

  it('counts spaces as characters', () => {
    expect(validatePassword('Ab1 ')).toMatchObject({ valid: false });
    expect(validatePassword('Ab1     ')).toEqual({ valid: true });
  });

  it('reports the length problem before the missing character kinds', () => {
    expect(validatePassword('abc')).toMatchObject({ message: 'Password must be at least 8 characters' });
  });
});
