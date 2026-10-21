'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleHelp, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';
import { z } from 'zod';

import { receiptSchema } from '../../lib/receipt';
import { PaymentReceiptDetails } from '../../components/payment-receipt';

export default function Checkout() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<z.infer<typeof receiptSchema> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('token'));
    setCancelled(params.get('cancelled') === '1');
    setReady(true);
  }, []);

  async function complete(): Promise<void> {
    if (!orderId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/paypal/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = z.object({ error: z.string() }).safeParse(data);
        throw new Error(message.success ? message.data.error : 'Payment could not be confirmed.');
      }
      const confirmed = receiptSchema.parse(data);
      if (confirmed.orderId !== orderId) throw new Error('The receipt belongs to a different checkout.');
      setReceipt(confirmed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment could not be confirmed.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const missingOrder = ready && !orderId && !cancelled;
  const heading = receipt ? 'All set. Test payment confirmed.' : cancelled ? 'Checkout cancelled.' : missingOrder ? 'Start with a sample offer.' : 'One last step.';

  return (
    <div className="checkout-page">
      <header className="site-header checkout-header">
        <a className="logo" href="/" aria-label="OfferScout home"><span className="logo-icon"><Sparkles size={20} aria-hidden="true" /></span>Offer<span>Scout</span></a>
        <span className="sample-pill"><LockKeyhole size={13} aria-hidden="true" /> Sandbox checkout</span>
      </header>
      <main className="checkout-shell">
        <a className="checkout-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to OfferScout</a>
        <ol className="checkout-steps" aria-label="Checkout progress">
          <li className="step-done"><span><Check size={14} aria-hidden="true" /></span>Choose an offer</li>
          <li className={orderId || receipt ? 'step-done' : ''}><span>{orderId || receipt ? <Check size={14} aria-hidden="true" /> : '2'}</span>PayPal checkout</li>
          <li className={receipt ? 'step-done' : 'step-current'} aria-current={!receipt ? 'step' : undefined}><span>{receipt ? <Check size={14} aria-hidden="true" /> : '3'}</span>Confirmation</li>
        </ol>

        <div className="checkout-layout">
          <section className="checkout-card" aria-labelledby="checkout-title" aria-busy={busy}>
            <div className={`checkout-state-icon${cancelled || missingOrder ? ' checkout-state-neutral' : ''}`}>
              {receipt ? <CircleCheck size={30} aria-hidden="true" /> : cancelled ? <X size={28} aria-hidden="true" /> : missingOrder ? <CircleHelp size={28} aria-hidden="true" /> : <ShieldCheck size={30} aria-hidden="true" />}
            </div>
            <div className="eyebrow">{receipt ? 'PAYMENT COMPLETE · SANDBOX' : 'PAYPAL SANDBOX · TEST MONEY ONLY'}</div>
            <h1 id="checkout-title">{heading}</h1>
            {receipt ? (
              <PaymentReceiptDetails receipt={receipt} />
            ) : cancelled ? (
              <p className="checkout-description">You’re back at OfferScout. No capture was requested by this cancellation page.</p>
            ) : missingOrder ? (
              <p className="checkout-description">Choose a sample purchase and continue through PayPal Sandbox to get started.</p>
            ) : (
              <>
                <p className="checkout-description">Back from PayPal? Complete your test payment to receive a confirmed sandbox receipt.</p>
                <div className="checkout-pending"><span className="dot" aria-hidden="true" /><span>{busy ? 'Confirming with PayPal…' : 'Payment confirmation pending'}</span></div>
                <button className="checkout confirm-checkout" data-testid="capture-payment" disabled={!ready || !orderId || busy} onClick={complete}>
                  {busy ? <><LoaderCircle className="checkout-spinner" size={18} aria-hidden="true" /> Confirming payment…</> : <>Complete sandbox payment <ArrowRight size={17} aria-hidden="true" /></>}
                </button>
                <p className="checkout-fineprint">This completes the payment you approved in PayPal Sandbox.</p>
              </>
            )}
            {error && <div className="checkout-error" role="alert"><strong>Payment isn’t confirmed yet.</strong><p>{error}</p></div>}
            <a className={receipt || cancelled || missingOrder ? 'primary checkout-return' : 'checkout-return-link'} href="/">{receipt ? 'Explore more sample offers' : 'Return to sample offers'}{(receipt || cancelled || missingOrder) && <ArrowRight size={16} aria-hidden="true" />}</a>
          </section>

          <aside className="checkout-context" aria-label="About this test payment">
            <div className="eyebrow">A CLEARER CHECKOUT</div>
            <h2>Know what you’re paying.</h2>
            <div className="checkout-context-item"><ShieldCheck size={20} aria-hidden="true" /><div><h3>Test money only</h3><p>This flow uses PayPal Sandbox and the configured OfferScout demo merchant.</p></div></div>
            <div className="checkout-context-item"><Sparkles size={20} aria-hidden="true" /><div><h3>Savings stay an estimate</h3><p>Estimated cashback doesn’t reduce the amount paid at checkout. No rewards are issued in this demo.</p></div></div>
            <div className="checkout-context-note"><CircleHelp size={17} aria-hidden="true" /><p>Sample offers use fictional merchants. No real retailer order is placed.</p></div>
          </aside>
        </div>
        <p className="checkout-bottom-note">OfferScout · Independent hackathon prototype</p>
      </main>
    </div>
  );
}
