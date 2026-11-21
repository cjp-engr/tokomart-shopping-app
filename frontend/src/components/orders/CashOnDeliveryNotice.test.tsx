import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CashOnDeliveryNotice } from './CashOnDeliveryNotice';
import { cashOnDeliveryNoRefundNotice, cashOnDeliveryNoticeTitle } from '../../utils/refund';

describe('Cash on Delivery note at checkout', () => {
  it('tells the buyer to inspect the items before they accept and pay', () => {
    const html = renderToStaticMarkup(<CashOnDeliveryNotice />);
    expect(html).toContain('data-testid="cod-inspect-notice"');
    expect(html).toContain('inspect your items');
    expect(html).toContain('right items');
    expect(html).toContain('damaged or missing');
    expect(html).toContain('cannot be refunded in the app');
  });
  it('has a short bold title above the sentence', () => {
    const html = renderToStaticMarkup(<CashOnDeliveryNotice />);
    expect(html).toContain('Inspect before you pay');
    expect(html).toContain(cashOnDeliveryNoticeTitle);
  });
  it('shows the same wording as the refund section of a delivered order', () => {
    expect(renderToStaticMarkup(<CashOnDeliveryNotice />)).toContain(cashOnDeliveryNoRefundNotice);
  });
});
