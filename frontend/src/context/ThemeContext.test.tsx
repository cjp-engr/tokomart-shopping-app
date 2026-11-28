// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../test/dom';
import { ThemeProvider, useTheme } from './ThemeContext';

// Dark mode on the web (REQ-PAR-08, TC-038): the choice is stored and survives a reload.
function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme: {theme}</button>;
}
const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);
const prefersDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark'), media: query, addEventListener() {}, removeEventListener() {} }));

describe('the web theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    prefersDark(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts light when nothing is stored and the system is light', () => {
    mount();
    expect(screen.getByRole('button')).toHaveTextContent('theme: light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows the system when nothing is stored and the system is dark', () => {
    prefersDark(true);
    mount();
    expect(screen.getByRole('button')).toHaveTextContent('theme: dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('uses the stored choice before the system preference', () => {
    prefersDark(true);
    localStorage.setItem('theme', 'light');
    mount();
    expect(screen.getByRole('button')).toHaveTextContent('theme: light');
  });

  it('ignores a stored value that is neither light nor dark', () => {
    localStorage.setItem('theme', 'purple');
    mount();
    expect(screen.getByRole('button')).toHaveTextContent('theme: light');
  });

  it('toggles, marks the page and stores the choice', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme: dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await user.click(screen.getByRole('button'));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('keeps the choice after a reload (a new mount reads what the last one stored)', async () => {
    const user = userEvent.setup();
    const first = mount();
    await user.click(screen.getByRole('button'));
    first.unmount();
    mount();
    expect(screen.getByRole('button')).toHaveTextContent('theme: dark');
  });
});
