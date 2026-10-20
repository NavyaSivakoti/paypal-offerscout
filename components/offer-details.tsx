'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronLeft, MessageCircle, X } from 'lucide-react';
import { offers, evaluate, money, offerHeadline, offerSummary, type Merchant, type Offer } from '../lib/offers';

interface OfferDetailsProps {
  merchant: Merchant | null; selected: Offer | null; newCustomer: boolean | null;
  paypalConfigured: boolean; paymentBusy: boolean; paymentError: string;
  onSelect: (offer: Offer) => void; onBack: () => void; onClose: () => void;
  onCheckout: () => void; onAsk: (merchant: Merchant) => void;
}

export function OfferDetails({ merchant, selected, newCustomer, paypalConfigured, paymentBusy, paymentError, onSelect, onBack, onClose, onCheckout, onAsk }: OfferDetailsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (merchant && element && !element.open) element.showModal(); if (!merchant && element?.open) element.close(); }, [merchant]);
  const merchantOffers = offers.filter(offer => offer.merchant === merchant);
  const first = merchantOffers[0];
  const estimate = selected ? evaluate(selected, newCustomer) : null;
  return <dialog className="offer-dialog" ref={dialog} aria-labelledby="offer-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {merchant && first && <div className="dialog-content"><button className="icon-button dialog-close" aria-label="Close offer" onClick={onClose}><X size={21} /></button>{selected && <button className="text-button" onClick={onBack}><ChevronLeft size={15} /> Merchant offer</button>}<div className="eyebrow">{selected ? 'SAMPLE PURCHASE · PAYPAL SANDBOX' : 'MERCHANT OFFER · SAMPLE DATA'}</div><h2 id="offer-title">{selected ? selected.product : merchant}</h2><p className="dialog-subtitle">{selected ? `${merchant} · Fictional purchase example` : 'Fictional footwear merchant'}</p>
      {selected && estimate ? <><dl>{[['Merchandise', money(selected.price)], ['Instant discount', `−${money(estimate.discount)}`], ['Shipping', money(selected.shipping)], ['Pay today, before tax', money(estimate.payable)], ['Estimated simulated reward', money(estimate.reward)], ['Estimated cost after rewards', money(estimate.effective)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="terms"><h3>Source: sample merchant offer terms</h3><p>{selected.terms}</p></div><p className={estimate.eligible ? 'eligibility' : 'warning'}>{estimate.reason}</p><button className="checkout" data-testid="start-checkout" disabled={!paypalConfigured || paymentBusy} onClick={onCheckout}>{paymentBusy ? 'Opening PayPal…' : paypalConfigured ? 'Continue to PayPal sandbox' : 'PayPal sandbox · setup needed'}</button>{paymentError && <p role="alert">{paymentError}</p>}<p className="checkout-note">{paypalConfigured ? 'Test money only. This pays our configured demo seller, not a real retailer. No product or cashback is issued.' : 'Sandbox credentials are not configured. No payment has been created.'}</p></> : <>
        <div className="cashback large"><strong>{offerHeadline(first).value}</strong><span>{offerHeadline(first).label}</span></div><div className="terms"><h3>What to know</h3><ul><li>{offerSummary(first)}</li><li>Rates, minimums, expiry, and exclusions can vary by sample purchase. Inspect the exact terms below.</li><li>Shipping and tax are excluded from benefit calculations.</li><li>Cashback is estimated after payment. Eligible discounts reduce the test payment immediately.</li><li>One offer per sample purchase; no stacking. Estimates use October 17, 2026.</li></ul></div><button className="secondary full-width" onClick={() => onAsk(merchant)}><MessageCircle size={17} /> Ask OfferScout about this merchant</button><details className="purchase-examples"><summary>Compare a sample purchase or try checkout</summary><p>These fictional purchase examples demonstrate the savings math and PayPal sandbox flow. They are not products for sale.</p><div className="purchase-list">{merchantOffers.map(offer => { const value = evaluate(offer, newCustomer); return <button key={offer.id} data-testid={`details-${offer.id}`} onClick={() => onSelect(offer)}><span><strong>{offer.product}</strong><small>{offerHeadline(offer).value} {offerHeadline(offer).label}</small><small>Pay {money(value.payable)} · Estimated reward {money(value.reward)}</small>{!value.eligible && <small className="warning-text">{value.reason}</small>}</span><ArrowRight size={16} /></button>; })}</div></details>
      </>}
    </div>}
  </dialog>;
}
