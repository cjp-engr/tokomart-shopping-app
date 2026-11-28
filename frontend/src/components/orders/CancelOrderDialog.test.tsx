import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CancelOrderDialog } from './CancelOrderDialog';

// The buyer's cancel confirmation on the order list (REQ-CAN-01).
const handlers = { onReasonChange: vi.fn(), onKeep: vi.fn(), onConfirm: vi.fn() };
const keepDisabled = (html: string) => /<button[^>]*\sdisabled=""[^>]*>Keep Order/.test(html);
const render = (props: Partial<React.ComponentProps<typeof CancelOrderDialog>> = {}) =>
  renderToStaticMarkup(<CancelOrderDialog open reason="" loading={false} error={null} {...handlers} {...props} />);

describe('the cancel dialog', () => {
  it('renders nothing while closed', () => {
    expect(render({ open: false })).toBe('');
  });

  it('warns that cancelling cannot be undone and offers to keep the order', () => {
    const html = render();
    expect(html).toContain('Cancel Order');
    expect(html).toContain('Are you sure you want to cancel this order? This action cannot be undone.');
    expect(html).toContain('Keep Order');
    expect(html).toContain('Yes, Cancel Order');
  });

  it('asks for a reason but marks it optional', () => {
    const html = render();
    expect(html).toContain('placeholder="Reason for cancellation (optional)"');
    expect(html).not.toMatch(/<textarea[^>]*required/);
  });

  it('shows the typed reason', () => {
    expect(render({ reason: 'Changed my mind' })).toContain('Changed my mind');
  });

  it('shows no error until there is one, then shows it as an alert', () => {
    expect(render()).not.toContain('role="alert"');
    const html = render({ error: 'Cancellation could not be completed. Please refresh and try again.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Cancellation could not be completed. Please refresh and try again.');
  });

  it('cannot be dismissed with Keep Order while the cancellation is being sent', () => {
    expect(keepDisabled(render({ loading: true }))).toBe(true);
    expect(keepDisabled(render())).toBe(false);
  });
});
