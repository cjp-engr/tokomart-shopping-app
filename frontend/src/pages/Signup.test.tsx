// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../test/dom';
import { Signup } from './Signup';

// The web signup form (REQ-AUTH-01, REQ-AUTH-10): its own rules run before any call to the API.
const signup = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ signup }) }));

async function fillAndSubmit(overrides: Partial<Record<'first' | 'last' | 'email' | 'password' | 'confirm', string>> = {}, terms = true) {
  const user = userEvent.setup();
  const v = { first: 'Ana', last: 'Cruz', email: 'ana@example.com', password: 'Abcdef12', confirm: 'Abcdef12', ...overrides };
  await user.type(screen.getByLabelText(/first name/i), v.first);
  await user.type(screen.getByLabelText(/last name/i), v.last);
  await user.type(screen.getByLabelText(/email/i), v.email);
  await user.type(screen.getByLabelText(/^password/i), v.password);
  await user.type(screen.getByLabelText(/confirm password/i), v.confirm);
  if (terms) await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /create account|sign up/i }));
}
const renderForm = () => render(<MemoryRouter><Signup /></MemoryRouter>);

describe('the signup form', () => {
  beforeEach(() => {
    signup.mockReset();
    signup.mockResolvedValue(undefined);
  });

  it('sends the account to the API when every rule is met', async () => {
    renderForm();
    await fillAndSubmit();
    expect(signup).toHaveBeenCalledWith({ firstName: 'Ana', lastName: 'Cruz', email: 'ana@example.com', password: 'Abcdef12', confirmPassword: 'Abcdef12' });
  });

  it.each([
    ['a password without an upper case letter', 'abcdef12', 'Password must contain uppercase, lowercase, and number'],
    ['a password without a digit', 'Abcdefgh', 'Password must contain uppercase, lowercase, and number'],
    ['a password of 7 characters', 'Abcde12', 'Password must be at least 8 characters'],
  ])('stops %s and does not call the API', async (_label, password, message) => {
    renderForm();
    await fillAndSubmit({ password, confirm: password });
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it('stops a confirmation that does not match', async () => {
    renderForm();
    await fillAndSubmit({ confirm: 'Abcdef13' });
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it('stops the form when the terms are not accepted', async () => {
    renderForm();
    await fillAndSubmit({}, false);
    expect(await screen.findByText('You must accept the terms and conditions')).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it('shows the API error when the account cannot be created', async () => {
    signup.mockRejectedValue(new Error('email already exists'));
    renderForm();
    await fillAndSubmit();
    expect(await screen.findByText('email already exists')).toBeInTheDocument();
  });
});
