import React, { useState } from 'react';
import { copy } from '../i18n';
import { cx } from '../utils';
import WeChatIcon from './WeChatIcon';
import wechatCommunityImage from '../assets/wechat-community.jpg';

function CommunityNavItem({ language }) {
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
        onClick={() => setOpen((current) => !current)}
      >
        <WeChatIcon />
        {t.navCommunity}
      </button>
      <span className="communityPopover" role="dialog" aria-label={t.navCommunity}>
        <img src={wechatCommunityImage} alt={t.communityQrAlt} loading="lazy" />
      </span>
    </span>
  );
}

export default CommunityNavItem;
