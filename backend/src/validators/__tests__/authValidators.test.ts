import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { loginRules, signupRules, updateProfileRules } from '../authValidators.js';
import { validate } from '../validate.js';

type Rules = typeof signupRules;

/** Runs the rules and then the shared `validate` middleware, the way the route does. */
async function check(rules: Rules, body: Record<string, unknown>) {
  const req = { body: { ...body } } as unknown as Request;
  for (const rule of rules) await rule.run(req); // in order, like the route
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  const next = vi.fn();
  validate(req, res, next);
  return {
    passed: next.mock.calls.length === 1,
    status: (res.status as any).mock.calls[0]?.[0] as number | undefined,
    body: (res.json as any).mock.calls[0]?.[0] as { success: boolean; message: string; errors: unknown[] } | undefined,
    normalised: req.body as Record<string, unknown>,
  };
}

const signup = () => ({ email: 'ann@example.com', password: 'secret1', firstName: 'Ann', lastName: 'Lee' });

describe('signupRules (REQ-AUTH-01, REQ-AUTH-02)', () => {
  it('accepts a valid signup', async () => {
    expect((await check(signupRules, signup())).passed).toBe(true);
  });

  it('accepts a password of exactly 6 characters (the lower boundary)', async () => {
    expect((await check(signupRules, { ...signup(), password: '123456' })).passed).toBe(true);
  });

  it('rejects a password of 5 characters (min - 1)', async () => {
    const result = await check(signupRules, { ...signup(), password: '12345' });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ success: false, message: 'Password must be at least 6 characters' });
  });

  it.each(['not-an-email', '', 'ann@', undefined])('rejects the email %s', async (email) => {
    const result = await check(signupRules, { ...signup(), email });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Valid email is required');
  });

  it.each([
    ['firstName', 'First name is required'],
    ['lastName', 'Last name is required'],
  ])('rejects an empty or blank %s', async (field, message) => {
    for (const value of ['', '   ', undefined]) {
      const result = await check(signupRules, { ...signup(), [field]: value });
      expect(result.status).toBe(400);
      expect(result.body!.message).toBe(message);
    }
  });

  it('reports the first problem as the message and lists every problem in errors', async () => {
    const result = await check(signupRules, { email: 'bad', password: '1', firstName: '', lastName: '' });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Valid email is required');
    expect(result.body!.errors).toHaveLength(4);
  });

  it('lower-cases the email before it is used', async () => {
    const result = await check(signupRules, { ...signup(), email: 'Ann.Lee@Example.COM' });
    expect(result.passed).toBe(true);
    expect(result.normalised.email).toBe('ann.lee@example.com');
  });

  it('trims the first and last name', async () => {
    const result = await check(signupRules, { ...signup(), firstName: '  Ann ', lastName: ' Lee  ' });
    expect(result.passed).toBe(true);
    expect(result.normalised).toMatchObject({ firstName: 'Ann', lastName: 'Lee' });
  });
});

describe('loginRules (REQ-AUTH-02)', () => {
  it('accepts an email and a password', async () => {
    expect((await check(loginRules, { email: 'ann@example.com', password: 'x' })).passed).toBe(true);
  });

  it('does not apply the 6-character rule to login, only that a password is present', async () => {
    expect((await check(loginRules, { email: 'ann@example.com', password: 'a' })).passed).toBe(true);
  });

  it('rejects a missing or empty password', async () => {
    for (const password of ['', undefined]) {
      const result = await check(loginRules, { email: 'ann@example.com', password });
      expect(result.status).toBe(400);
      expect(result.body!.message).toBe('Password is required');
    }
  });

  it('rejects an invalid email', async () => {
    const result = await check(loginRules, { email: 'nope', password: 'x' });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Valid email is required');
  });
});

describe('updateProfileRules (REQ-AUTH-09)', () => {
  it('accepts an empty update, because every field is optional', async () => {
    expect((await check(updateProfileRules, {})).passed).toBe(true);
  });

  it('accepts a valid phone number', async () => {
    expect((await check(updateProfileRules, { phone: '+639171234567' })).passed).toBe(true);
  });

  it('rejects a phone number that is not a phone number', async () => {
    const result = await check(updateProfileRules, { phone: 'abc' });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Invalid phone number');
  });

  it('rejects an invalid email when one is sent', async () => {
    const result = await check(updateProfileRules, { email: 'nope' });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Valid email is required');
  });

  it.each([
    ['firstName', 'First name cannot be empty'],
    ['lastName', 'Last name cannot be empty'],
  ])('rejects an empty %s when it is sent', async (field, message) => {
    const result = await check(updateProfileRules, { [field]: '   ' });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe(message);
  });
});
