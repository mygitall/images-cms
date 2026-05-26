import React, { useState } from 'react';
import { copy } from '../i18n';
import { cx } from '../utils';
import WeChatIcon from './WeChatIcon';

const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="430" height="430"><rect fill="#1a1a2e" width="430" height="430"/><text fill="#334" font-size="16" text-anchor="middle" x="215" y="220">placeholder</text></svg>');

function CommunityNavItem({ language, onFreeCreate }) {
  const t = copy[language];
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cx('communityNavItem', open && 'open')}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.navCommunity}
        onClick={() => onFreeCreate?.()}
      >
        <WeChatIcon />
        {t.navCommunity}
      </button>
      <span className="communityPopover" role="dialog" aria-label={t.navCommunity}>
        <img src={PLACEHOLDER} alt="" />
      </span>
    </span>
  );
}

export default CommunityNavItem;
