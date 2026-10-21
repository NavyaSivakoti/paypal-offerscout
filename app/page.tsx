'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bookmark, Home, Info, MessageCircle, Search, Send, ShieldCheck, Sparkles, Tag, X } from 'lucide-react';
import { z } from 'zod';
import { intentSchema, type ShoppingIntent } from '../lib/intent';
import { isMerchantView, type ChatContext } from '../lib/chat';
import { matchingOffers } from '../lib/recommend';
import { offers, evaluate, money, offerHeadline, offerSummary, type OfferFilter, type Merchant, type Offer } from '../lib/offers';
import { OfferDetails } from '../components/offer-details';
import { createRequestId } from '../lib/request-id';
import { merchantNames, merchantInitials } from '../lib/merchants';

type Screen = 'home' | 'savings' | 'saved';
type Category = NonNullable<ShoppingIntent['category']> | 'All';
interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; source?: string; offerIds?: string[]; merchantOnly?: boolean; }
const categories: readonly Category[] = ['All', 'Road', 'Trail', 'Walking'];
const categoryLabels: Record<Category, string> = { All: 'All offers', Road: 'Running', Trail: 'Trail & outdoors', Walking: 'Everyday footwear' };
const suggestions = ['Which merchants have the highest cashback?', 'Running shoes under $120', 'Why isn’t 15% always better?'];
const answerSchema = z.object({ answer: z.string(), offerIds: z.array(z.string()), intent: intentSchema, newCustomer: z.boolean().nullable(), mode: z.enum(['demo', 'live']), model: z.string().nullable(), promptVersion: z.string() });

export default function OfferScout() {
  const [screen, setScreen] = useState<Screen>('home');
  const [query, setQuery] = useState('');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [category, setCategory] = useState<Category>('All');
  const [offerType, setOfferType] = useState<OfferFilter | null>(null);
  const [benefitAmount, setBenefitAmount] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ key: '', count: 24 });
  const [sort, setSort] = useState<ShoppingIntent['sort']>('effective-cost');
  const [budgetBasis, setBudgetBasis] = useState<'payable' | 'effective'>('payable');
  const [ratePercent, setRatePercent] = useState<number | null>(null);
  const [newCustomerOffersOnly, setNewCustomerOffersOnly] = useState(false);
  const context = useRef<ChatContext | undefined>(undefined);
  const [budget, setBudget] = useState<number | null>(null);
  const [newCustomer, setNewCustomer] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<Merchant[]>([]);
  const [detailMerchant, setDetailMerchant] = useState<Merchant | null>(null);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [status, setStatus] = useState({ aiConfigured: false, paypalConfigured: false });
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [chatOpen, setChatOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const requestInFlight = useRef(false);
  const messageCounter = useRef(0);
  const checkoutAttempt = useRef<{ offerId: string; requestId: string } | null>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const chatButton = useRef<HTMLButtonElement>(null);
  const chatBody = useRef<HTMLDivElement>(null);

  const results = useMemo(() => matchingOffers({ intent: 'search', merchant, category: category === 'All' ? null : category, searchText: query || null, maximumPayableCents: budget, sort, newCustomer, offerType, benefitAmountCents: benefitAmount, budgetBasis, ratePercent, newCustomerOffersOnly }, newCustomer), [query, merchant, category, budget, sort, newCustomer, offerType, benefitAmount, budgetBasis, ratePercent, newCustomerOffersOnly]);
  const merchants = useMemo(() => [...new Set(results.map(offer => offer.merchant))].filter(name => screen !== 'saved' || saved.includes(name)), [results, screen, saved]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/status', { signal: controller.signal }).then(response => response.json()).then((data: unknown) => {
      const parsed = z.object({ aiConfigured: z.boolean(), paypalConfigured: z.boolean() }).safeParse(data);
      if (parsed.success) { setStatus(parsed.data); setMode(parsed.data.aiConfigured ? 'live' : 'demo'); }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const paginationKey = JSON.stringify([query, merchant, category, budget, sort, newCustomer, offerType, benefitAmount, screen, budgetBasis, ratePercent, newCustomerOffersOnly]);
  const visibleCount = pagination.key === paginationKey ? pagination.count : 24;
  useEffect(() => { if (chatOpen) chatInput.current?.focus(); }, [chatOpen]);
  useEffect(() => { const element = chatBody.current; if (element) element.scrollTop = element.scrollHeight; }, [messages, busy]);

  function closeChat() { setChatOpen(false); chatButton.current?.focus(); }
  function resetFilters() { setQuery(''); setMerchant(null); setCategory('All'); setSort('effective-cost'); setOfferType(null); setBenefitAmount(null); setBudget(null); setBudgetBasis('payable'); setRatePercent(null); setNewCustomerOffersOnly(false); context.current = undefined; }
  function openOffer(offer: Offer) { context.current = { intent: intentSchema.parse({ intent: 'search', merchant: offer.merchant, category: offer.category, searchText: offer.product, maximumPayableCents: null, sort: 'effective-cost', newCustomer, view: 'purchases' }), offerIds: [offer.id] }; setDetailMerchant(offer.merchant); setSelected(offer); setPaymentError(''); }
  function openMerchant(name: Merchant) { setDetailMerchant(name); setSelected(null); setPaymentError(''); }
  function appendMessage(message: Omit<ChatMessage, 'id'>) {
    const id = String(++messageCounter.current);
    setMessages(previous => [...previous, { ...message, id }]);
  }

  async function sendQuestion(question: string) {
    const text = question.trim();
    if (!text || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true); setPrompt('');
    appendMessage({ role: 'user', text });
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, newCustomer, mode, context: context.current }) });
      const data: unknown = await response.json();
      if (!response.ok) { const error = z.object({ error: z.string() }).safeParse(data); throw new Error(error.success ? error.data.error : 'Could not compare offers. Please try again.'); }
      const result = answerSchema.parse(data);
      appendMessage({ role: 'assistant', text: result.answer, source: result.model ? `AI: ${result.model} · ${result.promptVersion}` : (result.mode === 'live' ? 'OfferScout guide · verified app behavior' : 'Rule-based demo · no AI call'), offerIds: result.offerIds, merchantOnly: result.intent.intent === 'search' && isMerchantView(result.intent) });
      setNewCustomer(result.newCustomer);
      if (result.intent.intent === 'search') {
        context.current = { intent: result.intent, offerIds: result.offerIds };
        setBudgetBasis(result.intent.budgetBasis ?? 'payable'); setRatePercent(result.intent.ratePercent ?? null); setNewCustomerOffersOnly(result.intent.newCustomerOffersOnly ?? false);
        setCategory(result.intent.category ?? 'All'); setMerchant(result.intent.merchant); setQuery(result.intent.searchText ?? '');
        setBudget(result.intent.maximumPayableCents); setNewCustomer(result.newCustomer); setSort(result.intent.sort); setOfferType(result.intent.offerType); setBenefitAmount(result.intent.benefitAmountCents); setScreen('savings');
      }
    } catch (error) {
      appendMessage({ role: 'assistant', text: error instanceof Error ? error.message : 'Could not compare offers.', source: 'Request failed · your filters are unchanged' });
    } finally { setBusy(false); requestInFlight.current = false; }
  }
  function ask(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendQuestion(prompt); }

  async function checkout() {
    if (!selected || paymentBusy) return;
    setPaymentBusy(true); setPaymentError('');
    try {
      if (checkoutAttempt.current?.offerId !== selected.id) checkoutAttempt.current = { offerId: selected.id, requestId: createRequestId() };
      const response = await fetch('/api/paypal/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...checkoutAttempt.current,newCustomer}) });
      const data: unknown = await response.json();
      if (!response.ok) { const error = z.object({ error: z.string() }).safeParse(data); throw new Error(error.success ? error.data.error : 'Checkout unavailable.'); }
      const result = z.object({ approvalUrl: z.string().url() }).parse(data);
      const url = new URL(result.approvalUrl);
      if (url.origin !== 'https://www.sandbox.paypal.com') throw new Error('Invalid sandbox destination.');
      window.location.assign(url.href);
    } catch (error) { setPaymentError(error instanceof Error ? error.message : 'Checkout unavailable.'); }
    finally { setPaymentBusy(false); }
  }

  return <>
    <header className="site-header"><button className="logo" onClick={() => setScreen('home')} aria-label="OfferScout home"><span className="logo-icon"><Search size={21} /></span>Offer<span>Scout</span></button><span className="prototype-label">Independent PayPal hackathon prototype</span><span className="sample-pill"><span className="dot" /> Sample offers</span></header>
    <main className="app-main">
      {screen === 'home' ? <>
        <section className="home-hero"><div className="hero-copy"><div className="eyebrow">YOUR AI GUIDE TO CASHBACK & DISCOUNTS</div><h1>Find the offer.<br /><em>See the savings.</em></h1><p>Discover cashback and instant discounts, understand the conditions, and ask OfferScout to help you compare.</p><div className="hero-actions"><button className="primary" data-testid="open-savings" onClick={() => setScreen('savings')}>Explore savings <ArrowRight size={17} /></button><button className="secondary" onClick={() => setChatOpen(true)}><MessageCircle size={17} /> Ask OfferScout</button></div><p className="small-note">Fictional offers for a working demo. No real cashback is issued.</p></div>
          <div className="hero-example" aria-label="Example of cashback caps"><span className="eyebrow">THERE’S MORE TO AN OFFER THAN ITS RATE</span><h2>15% back.<br />But how much saved?</h2><div className="comparison-line"><span>On a $110 sample purchase</span><strong>$16.50</strong></div><div className="comparison-line"><span>After a $5 cashback cap</span><strong>$5.00</strong></div><div className="example-answer"><Sparkles size={19} /><p>OfferScout helps you spot the conditions before you decide.</p></div><button className="text-button" onClick={() => { setChatOpen(true); void sendQuestion('Why isn’t 15% always better?'); }}>Ask about this example <ArrowRight size={15} /></button></div>
        </section>
        <section className="home-paths" aria-label="Ways to use OfferScout"><article><Tag size={22} /><h2>Browse merchant offers</h2><p>Cashback, dollar discounts, and key conditions in one Savings screen.</p></article><article><MessageCircle size={22} /><h2>Ask in your own words</h2><p>Search by merchant or shopping need. Get a comparison with the math explained.</p></article><article><ShieldCheck size={22} /><h2>Check before checkout</h2><p>See the terms and estimated rewards. Try a clearly labeled sandbox purchase.</p></article></section>
      </> : <>
        <section className="savings-intro"><div><div className="eyebrow">OFFERS, WITH THE CONDITIONS IN VIEW</div><h1>{screen === 'saved' ? 'Saved merchants' : 'Savings'}</h1><p>{screen === 'saved' ? 'Your saved offers for this visit.' : 'Find a merchant, compare offers, or ask OfferScout where to start.'}</p></div><button className="secondary" onClick={() => setChatOpen(true)}><Sparkles size={16} /> Help me find an offer</button></section>
        <div className="notice"><Info size={17} /><span>This demo contains {merchantNames.length} fictional footwear merchants and {offers.length} sample purchase offers. These are sample offers, not a live PayPal offer feed.</span></div>
        <section className="directory" aria-label="Merchant offers"><div className="search-row"><label className="search"><Search size={19} /><input aria-label="Search offers" data-testid="offer-search" placeholder="Search merchants or offers" value={query} onChange={event => { setQuery(event.target.value); setMerchant(null); }} /></label><label className="sort">Sort by<select aria-label="Sort offers" value={sort} onChange={event => setSort(event.target.value as ShoppingIntent['sort'])}><option value="headline-rate">Highest cashback % (cashback only)</option><option value="effective-cost">Best sample purchase value</option><option value="payable">Lowest sample purchase price</option></select></label></div>
          <div className="offer-type-filter"><label htmlFor="offer-type">Offer type</label><select id="offer-type" data-testid="offer-type-filter" value={offerType ?? "all"} onChange={event => { setBenefitAmount(null); setRatePercent(null); setOfferType(event.target.value === "all" ? null : event.target.value as OfferFilter); if (sort === "headline-rate") setSort("effective-cost"); }}><option value="all">All offer types</option><option value="cashback">All cashback offers</option><option value="discount">All instant discounts</option><option value="cashback-percent">Percentage cashback</option><option value="cashback-fixed">Dollar cashback · get $5 back</option><option value="discount-fixed">Dollar discount · save $5 now</option><option value="discount-percent">Percentage discount</option></select></div><div className="filters">{categories.map(value => <button className={`chip ${category === value ? 'selected' : ''}`} aria-pressed={category === value} key={value} onClick={() => setCategory(value)}>{categoryLabels[value]}</button>)}{merchant && <button className="chip selected" data-testid="merchant-filter" onClick={() => setMerchant(null)} aria-label={`Clear merchant filter ${merchant}`}>{merchant} <X size={12} /></button>}{benefitAmount !== null && <button className="chip selected" onClick={() => setBenefitAmount(null)}>{money(benefitAmount)} benefit <X size={12} /></button>}{budget !== null && <button className="chip selected" onClick={() => setBudget(null)}>{budgetBasis === 'effective' ? 'After estimated cashback' : 'Pay today'} ≤ {money(budget)} <X size={12} /></button>}{ratePercent !== null && <button className="chip selected" onClick={() => setRatePercent(null)}>{ratePercent}% rate <X size={12} /></button>}{newCustomerOffersOnly && <button className="chip selected" onClick={() => setNewCustomerOffersOnly(false)}>New customers only <X size={12} /></button>}<button className="text-button reset" onClick={resetFilters}>Reset filters</button></div>
          <div className="result-heading"><h2>{merchants.length} {merchants.length === 1 ? 'merchant' : 'merchants'} {screen === 'saved' ? 'saved' : 'with matching offers'}</h2><span>Rates & expiry vary · Showing eligible offers · Sample date Oct 17, 2026</span></div>
          <div className="merchant-grid">{merchants.slice(0, visibleCount).map(name => {
            const matching = results.filter(offer => offer.merchant === name);
            const first = matching[0];
            const headline = offerHeadline(first);
            const estimate = evaluate(first, newCustomer);
            const isSaved = saved.includes(name);
            return <article className="merchant-card" key={name} data-testid={`merchant-${merchantNames.indexOf(name)}`}><div className="merchant-top"><div className="merchant-mark" style={{ background: first.color }} aria-hidden="true">{merchantInitials(name)}</div><button className={`icon-button ${isSaved ? 'is-saved' : ''}`} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${name}`} onClick={() => setSaved(previous => isSaved ? previous.filter(value => value !== name) : [...previous, name])}><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} /></button></div><h3>{name}</h3><p className="merchant-category">Footwear · Fictional merchant</p><div className="cashback"><strong>{headline.value}</strong><span>{headline.label}</span></div><div className="condition"><Info size={14} /><span>{first.cap !== null ? `Benefit capped at ${money(first.cap)} per order` : first.minimum ? `Minimum merchandise spend ${money(first.minimum)}` : 'See purchase-specific conditions'}</span></div><p className="merchant-terms">{offerSummary(first)}</p>{!estimate.eligible && <p className="warning" data-testid={`eligibility-${first.id}`}>{estimate.reason}</p>}{sort !== 'headline-rate' && <div className="sample-value"><span>First matching sample purchase</span><strong>{money(estimate.effective)} <small>after estimated rewards</small></strong><span>{first.product} · Pay {money(estimate.payable)} before tax</span></div>}<button className="view" data-testid={`view-merchant-${merchantNames.indexOf(name)}`} onClick={() => openMerchant(name)}>View offer & terms <ArrowRight size={16} /></button></article>;
          })}</div>
          {visibleCount < merchants.length && <div className="load-more"><p>Showing {Math.min(visibleCount, merchants.length)} of {merchants.length} matching merchants</p><button className="secondary" data-testid="load-more-merchants" onClick={() => setPagination({ key: paginationKey, count: visibleCount + 24 })}>Show more merchants <ArrowRight size={16} /></button></div>}
          {merchants.length === 0 && <div className="empty"><Search size={28} /><h3>{screen === 'saved' && saved.length === 0 ? 'No saved merchants yet' : 'No matching offers'}</h3><p>{screen === 'saved' && saved.length === 0 ? 'Use the bookmark on a merchant to save it for this visit.' : 'Try another merchant, category, or budget.'}</p><button className="secondary" onClick={() => { resetFilters(); setScreen('savings'); }}>Browse all offers</button></div>}
          <div className="directory-help"><MessageCircle size={20} /><div><strong>Not sure which offer fits?</strong><p>Ask “Running shoes under $120” or “Show me Trail & Field offers.”</p></div><button className="text-button" onClick={() => setChatOpen(true)}>Ask OfferScout <ArrowRight size={15} /></button></div>
        </section>
      </>}
      <footer><span>OfferScout · Independent prototype</span><span>Estimates assume activation · Tax excluded · Demo date Oct 17, 2026</span><a href="/data/offerscout-catalog.json" download>Download sample catalog</a><a href="/data/offerscout-mixed-offer-cases.json" download>Mixed-offer test cases</a></footer>
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{([{ value: 'home', label: 'Home', icon: Home }, { value: 'savings', label: 'Savings', icon: Tag }, { value: 'saved', label: 'Saved', icon: Bookmark }] as const).map(item => <button key={item.value} data-testid={`nav-${item.value}`} aria-current={screen === item.value ? 'page' : undefined} className={screen === item.value ? 'active' : ''} onClick={() => setScreen(item.value)}><item.icon size={20} /><span>{item.label}{item.value === 'saved' && saved.length > 0 ? ` (${saved.length})` : ''}</span></button>)}</nav>
    <button ref={chatButton} className="chat-launcher" data-testid="chat-launcher" aria-expanded={chatOpen} aria-controls="offerscout-chat" onClick={() => chatOpen ? closeChat() : setChatOpen(true)}>{chatOpen ? <X size={20} /> : <Sparkles size={20} />}<span>{chatOpen ? 'Close chat' : 'Ask OfferScout'}</span></button>
    {chatOpen && <section className="chat-panel" id="offerscout-chat" role="region" aria-label="OfferScout chatbot" onKeyDown={event => { if (event.key === 'Escape') closeChat(); }}><div className="chat-header"><span className="chat-avatar"><Sparkles size={21} /></span><div><h2>OfferScout</h2><p>Your savings assistant</p></div><button className="icon-button" aria-label="Close chatbot" onClick={closeChat}><X size={19} /></button></div><div className="chat-status"><span className="dot" />{mode === 'live' ? 'Live AI · sample offers' : 'Demo mode · AI not connected'}</div>
      <div className="chat-body" ref={chatBody}><div className="chat-welcome"><h3>What are you shopping for?</h3><p>I can help you find merchant offers, compare sample purchases, and understand cashback conditions.</p><div className="suggestions">{suggestions.map(text => <button key={text} disabled={busy} onClick={() => void sendQuestion(text)}>{text}<ArrowRight size={14} /></button>)}</div></div><div className="conversation" role="log" aria-label="Chat messages" aria-live="polite">{messages.map(message => <div className={`message ${message.role}`} key={message.id}><span className="message-author">{message.role === 'user' ? 'You' : 'OfferScout'}</span><p>{message.text}</p>{message.source && <small>{message.source}</small>}{message.offerIds && message.offerIds.length > 0 && <div className="chat-results">{message.offerIds.slice(0, 3).map(id => { const offer = offers.find(candidate => candidate.id === id); if (!offer) return null; return <button key={id} data-testid={`chat-details-${id}`} onClick={() => message.merchantOnly ? openMerchant(offer.merchant) : openOffer(offer)}><span><strong>{offer.merchant}</strong><small>{message.merchantOnly ? 'View offer & terms' : `${offer.product} · Sample purchase`}</small></span><ArrowRight size={15} /></button>; })}</div>}</div>)}</div>{busy && <p className="thinking" role="status">Comparing the sample offers…</p>}</div>
      <details className="chat-settings"><summary>Demo settings & eligibility</summary><label>Assistant mode<select aria-label="Interpreter mode" disabled={busy} value={mode} onChange={event => setMode(event.target.value as 'demo' | 'live')}><option value="demo">Rule-based sample demo</option><option value="live" disabled={!status.aiConfigured}>Live AI{!status.aiConfigured ? ' · setup needed' : ''}</option></select></label><label>For sample new-customer offers<select aria-label="New customer status" value={newCustomer === null ? 'unknown' : String(newCustomer)} onChange={event => setNewCustomer(event.target.value === 'unknown' ? null : event.target.value === 'true')}><option value="unknown">Eligibility unknown</option><option value="true">I am a new customer</option><option value="false">I am a returning customer</option></select></label><p>Status is self-declared. Past chat answers reflect the settings used when asked.</p></details>
      <form className="chat-composer" onSubmit={ask}><label className="sr-only" htmlFor="prompt">Ask about sample offers</label><textarea ref={chatInput} id="prompt" data-testid="assistant-input" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendQuestion(prompt); } }} placeholder="Ask about a merchant or cashback…" rows={2} maxLength={1000} /><button type="submit" aria-label="Send message" disabled={!prompt.trim() || busy}><Send size={18} /></button></form><p className="chat-footnote">Fictional offers · Estimated rewards, never cashback earned</p>
    </section>}
    <OfferDetails merchant={detailMerchant} selected={selected} newCustomer={newCustomer} paypalConfigured={status.paypalConfigured} paymentBusy={paymentBusy} paymentError={paymentError} onSelect={openOffer} onBack={() => setSelected(null)} onClose={() => { setDetailMerchant(null); setSelected(null); }} onCheckout={() => void checkout()} onAsk={name => { setDetailMerchant(null); setSelected(null); setChatOpen(true); void sendQuestion(`Show me ${name} offers`); }} />
  </>;
}
