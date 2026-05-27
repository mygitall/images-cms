import React from 'react';
import { copy } from '../i18n';
import WeChatIcon from './WeChatIcon';

function CommunityNavItem({ language, onFreeCreate }) {
  const t = copy[language];
  return (
    <button
      type="button"
      className="communityNavItem"
      aria-label={t.navCommunity}
      onClick={() => onFreeCreate?.()}
    >
      <WeChatIcon />
      {t.navCommunity}
    </button>
  );
}

export default CommunityNavItem;
