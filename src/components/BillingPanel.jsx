import React, { useEffect, useState } from 'react';
import {
  Coins, CreditCard, Crown, LoaderCircle, LogIn,
  ReceiptText, X
} from 'lucide-react';
import { copy } from '../i18n';
import { cx, getAuthHeaders, generationErrorMessage, productText, formatMembershipStatus } from '../utils';
import { useBodyScrollLock } from '../hooks';
import TransactionItem from './TransactionItem';
import './BillingPanel.css';

function BillingPanel({
  open,
  language,
  session,
  profile,
  notice,
  casesById,
  onClose,
  onAuthRequired,
  onProfileChange,
  onOpenCase
}) {
  const t = copy[language];
  const [plans, setPlans] = useState([]);
  const [packs, setPacks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [busyProduct, setBusyProduct] = useState('');
  useBodyScrollLock(open);

  async function loadBilling() {
    setStatus('loading');
    setMessage(notice || '');

    try {
      const headers = getAuthHeaders(session);
      const [plansResponse, historyResponse] = await Promise.all([
        fetch('/api/billing/plans', { headers }),
        session?.access_token
          ? fetch('/api/billing/history', { headers })
          : Promise.resolve(null)
      ]);
      const plansPayload = await plansResponse.json().catch(() => ({}));
      if (!plansResponse.ok || !plansPayload.ok) {
        throw new Error(plansPayload.error || 'SERVER_NOT_CONFIGURED');
      }

      setPlans(plansPayload.plans || []);
      setPacks(plansPayload.packs || []);
      setCheckoutAvailable(Boolean(plansPayload.checkoutAvailable));
      if (plansPayload.user) onProfileChange(plansPayload.user);

      if (historyResponse) {
        const historyPayload = await historyResponse.json().catch(() => ({}));
        if (historyResponse.ok && historyPayload.ok) {
          setTransactions(historyPayload.transactions || []);
        }
      } else {
        setTransactions([]);
      }

      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(generationErrorMessage(error.message, language));
    }
  }

  useEffect(() => {
    if (open) loadBilling();
  }, [open, session?.access_token, session?.phpSession]);

  async function handleCheckout(product) {
    if (!session?.access_token && !session?.phpSession) {
      onAuthRequired();
      return;
    }
    if (!checkoutAvailable) {
      setMessage(t.checkoutUnavailable);
      return;
    }

    setBusyProduct(`${product.type}:${product.id}`);
    setMessage('');

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session)
        },
        body: JSON.stringify({
          productType: product.type,
          productId: product.id
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.error || 'CHECKOUT_FAILED');
      }
      if (payload.user) onProfileChange(payload.user);
      window.location.href = payload.url;
    } catch (error) {
      setBusyProduct('');
      setMessage(generationErrorMessage(error.message, language));
    }
  }

  async function handlePortal() {
    if (!session?.access_token && !session?.phpSession) {
      onAuthRequired();
      return;
    }
    setBusyProduct('portal');
    setMessage('');

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: getAuthHeaders(session)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.error || 'BILLING_PORTAL_FAILED');
      }
      window.location.href = payload.url;
    } catch (error) {
      setBusyProduct('');
      setMessage(generationErrorMessage(error.message, language));
    }
  }

  if (!open) return null;

  const activePlanId = profile?.membership?.isActive ? profile.membership.planId : '';
  const activePlan = plans.find((plan) => plan.id === activePlanId);
  const activePlanName = activePlan ? productText(activePlan.name, language) : activePlanId || t.noPlan;

  return (
    <div
      className="previewOverlay billingOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="billingDialog" role="dialog" aria-modal="true" aria-labelledby="billing-title">
        <button className="previewClose" type="button" onClick={onClose} aria-label={t.closePreview}>
          <X size={20} />
        </button>
        <div className="billingHero">
          <span className="eyebrow">
            <CreditCard size={16} />
            {t.membershipCenter}
          </span>
          <h2 id="billing-title">{t.billingTitle}</h2>
          <p>{t.billingSubtitle}</p>
        </div>

        <div className="billingSummary">
          <div>
            <span>{t.balanceTitle}</span>
            <strong>{profile?.creditBalance || 0}</strong>
            <em>{t.credits}</em>
          </div>
          <div>
            <span>{t.currentPlan}</span>
            <strong>{activePlanName}</strong>
            <em>{formatMembershipStatus(profile?.membership, language)}</em>
          </div>
          <div>
            <span>{t.freeGeneration}</span>
            <strong>{profile?.freeUsed ? t.freeUsedShort : t.freeReady}</strong>
            <em>{checkoutAvailable ? t.paymentReady : t.billingNotReady}</em>
          </div>
        </div>

        {!session?.access_token && !session?.phpSession ? (
          <div className="billingState">
            <p>{t.authRequired}</p>
            <button type="button" onClick={onAuthRequired}>
              <LogIn size={17} />
              {t.signIn}
            </button>
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="billingState">
            <LoaderCircle className="spinIcon" size={20} />
            {t.loadBilling}
          </div>
        ) : null}

        {message ? (
          <p className={cx('authMessage', status === 'error' && 'error')}>{message}</p>
        ) : null}

        <div className="billingSections">
          <section>
            <h3>
              <Crown size={18} />
              {t.membershipPlans}
            </h3>
            <div className="billingCards">
              {plans.map((plan) => {
                const isCurrent = activePlanId === plan.id;
                const busy = busyProduct === `${plan.type}:${plan.id}`;
                return (
                  <article className={cx('billingCard', isCurrent && 'current')} key={plan.id}>
                    <span>{productText(plan.name, language)}</span>
                    <strong>{plan.priceLabel}<small>/{plan.interval}</small></strong>
                    <p>{productText(plan.description, language)}</p>
                    <div className="billingCredits">{t.monthlyCredits(plan.monthlyCredits)}</div>
                    <button type="button" disabled={busy || isCurrent} onClick={() => handleCheckout(plan)}>
                      {busy ? <LoaderCircle className="spinIcon" size={16} /> : <Crown size={16} />}
                      {isCurrent ? t.currentPlan : t.subscribe}
                    </button>
                  </article>
                );
              })}
            </div>
            {profile?.membership?.isActive ? (
              <button className="portalButton" type="button" onClick={handlePortal} disabled={busyProduct === 'portal'}>
                {busyProduct === 'portal' ? <LoaderCircle className="spinIcon" size={16} /> : <CreditCard size={16} />}
                {t.manageSubscription}
              </button>
            ) : null}
          </section>

          <section>
            <h3>
              <Coins size={18} />
              {t.creditPacks}
            </h3>
            <div className="billingCards">
              {packs.map((pack) => {
                const busy = busyProduct === `${pack.type}:${pack.id}`;
                return (
                  <article className="billingCard" key={pack.id}>
                    <span>{productText(pack.name, language)}</span>
                    <strong>{pack.priceLabel}</strong>
                    <p>{productText(pack.description, language)}</p>
                    <div className="billingCredits">{t.packCredits(pack.credits)}</div>
                    <button type="button" disabled={busy} onClick={() => handleCheckout(pack)}>
                      {busy ? <LoaderCircle className="spinIcon" size={16} /> : <Coins size={16} />}
                      {t.buyCredits}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <section className="transactionSection">
          <h3>
            <ReceiptText size={18} />
            {t.transactionHistory}
          </h3>
          {transactions.length ? (
            <div className="transactionList">
              {transactions.map((transaction) => (
                <TransactionItem
                  transaction={transaction}
                  language={language}
                  casesById={casesById}
                  onOpenCase={onOpenCase}
                  key={transaction.id}
                />
              ))}
            </div>
          ) : (
            <p className="emptyTransactions">{t.noTransactions}</p>
          )}
        </section>
      </section>
    </div>
  );
}

export default BillingPanel;
