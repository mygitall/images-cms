import React, { useEffect, useState } from 'react';
import {
  ChevronDown, Coins, CreditCard, Crown, Heart, ImageIcon, LogIn,
  LogOut, ReceiptText, Settings, ShieldCheck, UserCircle
} from 'lucide-react';
import { copy } from '../i18n';
import { cx, formatMembershipStatus } from '../utils';
import { useDropdownDismiss } from '../hooks';
import './UserMenu.css';

function UserMenu({ language, session, profile, onSignIn, onSignOut, onAdmin, onBilling, onAccount, onFavorites, onHistory }) {
  const t = copy[language];
  const [open, setOpen] = useState(false);
  const [genCost, setGenCost] = useState(0.09);
  const ref = useDropdownDismiss(open, setOpen);

  useEffect(() => {
    fetch('/images20/api/features.php')
      .then(r => r.json())
      .then(f => {
        const cost = parseFloat(f.gen_cost_yuan);
        if (cost > 0) setGenCost(cost);
      })
      .catch(() => {});
  }, []);

  const balance = Number(profile?.creditBalance || 0);
  const canGenerate = genCost > 0 ? Math.floor(balance / genCost) : 0;

  if (!session) {
    return (
      <button className="accountButton" type="button" onClick={onSignIn}>
        <LogIn size={17} />
        <span>{t.signIn}</span>
      </button>
    );
  }

  const email = profile?.email || session.user?.email || t.account;
  const displayName = profile?.fullName || session.user?.user_metadata?.name || email;
  const avatarUrl = profile?.avatarUrl || session.user?.user_metadata?.avatar_url || session.user?.user_metadata?.picture || '';
  const totalSpent = Number(profile?.usage?.totalGenerationCredits || 0);

  return (
    <div className="dropdownControl userMenu" ref={ref}>
      <button
        className={cx('userTrigger', open && 'open')}
        type="button"
        aria-label={t.account}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="avatarBadge">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserCircle size={18} />}
        </span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="dropdownMenu userDropdown" role="menu">
          <div className="userSummary">
            {avatarUrl ? <img className="userSummaryAvatar" src={avatarUrl} alt="" /> : <UserCircle size={32} />}
            <div>
              <strong>{displayName}</strong>
              <span>{email}</span>
            </div>
          </div>
          <div className="userStats">
            {profile?.isSuperAdmin ? (
              <span className="userStat admin">
                <ShieldCheck size={15} />
                {t.superAdmin}
              </span>
            ) : null}
            <span className="userStat">
              <Coins size={15} />
              ¥{balance.toFixed(2)}
            </span>
            <span className="userStat">
              <ImageIcon size={15} />
              {language === 'zh' ? `可生图 ${canGenerate} 张` : language === 'ko' ? `${canGenerate}장 생성 가능` : `${canGenerate} images`}
            </span>
            <span className="userStat">
              <Crown size={15} />
              {formatMembershipStatus(profile?.membership, language)}
            </span>
            <span className="userStat">
              <ReceiptText size={15} />
              {t.totalGenerationCredits}: {totalSpent}
            </span>
          </div>
          <div className="dropdownDivider" />
          <button
            className="dropdownAction"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAccount();
            }}
          >
            <Settings size={17} />
            {t.accountSettings}
          </button>
          <button
            className="dropdownAction"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onFavorites();
            }}
          >
            <Heart size={17} />
            {t.myFavorites}
          </button>
          <button
            className="dropdownAction"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onHistory();
            }}
          >
            <ImageIcon size={17} />
            {t.history}
          </button>
          <button
            className="dropdownAction"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onBilling();
            }}
          >
            <CreditCard size={17} />
            {t.membershipCenter}
          </button>
          {profile?.isSuperAdmin ? (
            <button
              className="dropdownAction"
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAdmin();
              }}
            >
              <ShieldCheck size={17} />
              {t.adminPanel}
            </button>
          ) : null}
          <button
            className="dropdownAction danger"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={17} />
            {t.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;
