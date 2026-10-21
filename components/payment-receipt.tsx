import { Check, Sparkles } from 'lucide-react';
import { money } from '../lib/offers';
import type { PaymentReceipt } from '../lib/receipt';
export function PaymentReceiptDetails({ receipt }: { receipt: PaymentReceipt }) {
  return <div role="status">
    <p className="checkout-description" data-testid="payment-success">PayPal confirmed a completed sandbox capture of {money(receipt.paidCents)}.</p>
    <div className="receipt-total"><span>Test amount paid</span><strong>{money(receipt.paidCents)} <small>USD</small></strong></div>
    <section className="receipt-savings" aria-labelledby="receipt-estimate-title" data-testid="receipt-savings">
      <div className="receipt-savings-label"><Sparkles size={17} aria-hidden="true" /><h2 id="receipt-estimate-title">Estimated cashback</h2><span>Simulated</span></div>
      <strong className="receipt-estimate-amount" data-testid="estimated-cashback">{money(receipt.estimatedCashbackCents)}</strong>
      <p>{receipt.merchant} · {receipt.product}</p>
      {!receipt.eligibilityMet && <p data-testid="receipt-eligibility">{receipt.eligibilityReason}. No offer benefit is included.</p>}
      {receipt.customerStatus === 'self-declared-new' && <p>New-customer status was self-declared at checkout; it is not verified by PayPal.</p>}
      <p>This is a sample-offer estimate, not cashback confirmed or paid by PayPal. Activation is assumed; the estimate uses October 17, 2026.</p>
    </section>
    <dl className="receipt-details">
      <div><dt>Sample merchandise</dt><dd>{money(receipt.merchandiseCents)}</dd></div>
      <div><dt>Instant discount applied</dt><dd data-testid="receipt-discount">{receipt.instantDiscountCents ? `−${money(receipt.instantDiscountCents)}` : money(0)}</dd></div>
      <div><dt>Shipping</dt><dd>{money(receipt.shippingCents)}</dd></div>
      <div><dt>Estimated cost after cashback</dt><dd data-testid="receipt-effective-cost">{money(receipt.estimatedEffectiveCents)}</dd></div>
      <div><dt>Payment status</dt><dd className="receipt-status"><Check size={14} aria-hidden="true" /> Completed</dd></div>
      <div><dt>Order ID</dt><dd>{receipt.orderId}</dd></div>
      <div><dt>Capture ID</dt><dd>{receipt.captureId}</dd></div>
    </dl>
    <p className="checkout-fineprint">Tax excluded. No real purchase or cashback was issued.</p>
  </div>;
}
