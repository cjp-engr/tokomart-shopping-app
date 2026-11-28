import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RefundDecision } from './RefundDecision';
import type { RefundRequest } from '../../types/refund';

// The decision buttons of one request on the seller's Return/Refund tab (REQ-REF-05).
function request(overrides: Partial<RefundRequest> = {}): RefundRequest {
  return { id: 'r1', orderId: 'o1', units: [], amountMinor: 1080, currency: 'usd', state: 'requested', canDecide: true, ...overrides } as unknown as RefundRequest;
}
const handlers = { onReasonChange: vi.fn(), onReject: vi.fn(), onApprove: vi.fn() };
// Tailwind classes such as `disabled:opacity-50` contain the word, so look for the attribute itself.
const disabledButtons = (html: string) => (html.match(/<button[^>]*\sdisabled=""/g) ?? []).length;
const isDisabled = (html: string, label: string) => new RegExp(`<button[^>]*\\sdisabled=""[^>]*>\\s*${label}`).test(html);
const render = (props: Partial<React.ComponentProps<typeof RefundDecision>> = {}) =>
  renderToStaticMarkup(<RefundDecision request={request()} rejecting={false} reason="" disabled={false} {...handlers} {...props} />);

describe('a request waiting for the seller', () => {
  it('offers Reject request and Approve with the exact amount, and says approval starts the refund', () => {
    const html = render();
    expect(html).toContain('Reject request');
    expect(html).toContain('Approve $10.80');
    expect(html).toContain('Approval starts the refund immediately. The buyer keeps the item.');
    expect(html).not.toContain('Reason for rejecting');
  });

  it('shows the amount of this request', () => {
    expect(render({ request: request({ amountMinor: 2660, currency: 'usd' }) })).toContain('Approve $26.60');
  });

  it('disables both buttons while a decision is being saved or the list is loading', () => {
    const html = render({ disabled: true });
    expect(disabledButtons(html)).toBe(2);
  });

  it('leaves both buttons enabled otherwise', () => {
    expect(disabledButtons(render())).toBe(0);
  });
});

describe('rejecting', () => {
  it('asks for a reason and renames the button to Confirm rejection', () => {
    const html = render({ rejecting: true });
    expect(html).toContain('Reason for rejecting');
    expect(html).toContain('aria-label="Rejection reason for r1"');
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain('Confirm rejection');
    expect(html).not.toContain('Reject request');
  });

  it.each(['', '   '])('will not confirm a rejection whose reason is %j', (reason) => {
    const html = render({ rejecting: true, reason });
    expect(isDisabled(html, 'Confirm rejection')).toBe(true);
  });

  it('confirms once a reason is typed', () => {
    const html = render({ rejecting: true, reason: 'Item was used' });
    expect(html).toContain('Confirm rejection');
    expect(isDisabled(html, 'Confirm rejection')).toBe(false);
    expect(html).toContain('Item was used');
  });

  it('still lets the seller approve while the rejection reason is empty', () => {
    expect(isDisabled(render({ rejecting: true }), 'Approve')).toBe(false);
  });
});

describe('a request the seller cannot decide', () => {
  it('says decisions are unavailable instead of showing buttons (new requests switched off)', () => {
    const html = render({ request: request({ canDecide: false }) });
    expect(html).toContain('Refund decisions are currently unavailable.');
    expect(html).not.toContain('<button');
  });
});

describe('a request that is already decided', () => {
  it.each(['rejected', 'processing', 'refunded', 'needs_review'] as const)('shows nothing for a %s request', (state) => {
    expect(render({ request: request({ state }) })).toBe('');
  });
});
