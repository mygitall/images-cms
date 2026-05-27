import React from 'react';
import { ImageIcon } from 'lucide-react';
import { copy } from '../i18n';
import { cx, compactText, transactionLabel, transactionCaseId } from '../utils';

function TransactionItem({ transaction, language, casesById, onOpenCase }) {
  const t = copy[language];
  const caseId = transactionCaseId(transaction);
  const caseItem = caseId ? casesById?.get(caseId) : null;
  const caseLabel = caseItem
    ? `${t.openCase} #${caseId} · ${compactText(caseItem.title, 28)}`
    : `${t.sourceCase} #${caseId}`;

  return (
    <div className={cx('transactionItem', caseId && 'hasCase')}>
      <div className="transactionInfo">
        <span>{transactionLabel(transaction, language)}</span>
        {caseId ? (
          <button
            className="transactionCaseLink"
            type="button"
            onClick={() => caseItem && onOpenCase?.(caseItem)}
            disabled={!caseItem}
          >
            <ImageIcon size={14} />
            {caseLabel}
          </button>
        ) : null}
      </div>
      <strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>
        {transaction.amount >= 0 ? '+' : ''}¥{Number(transaction.amount || 0).toFixed(2)}
      </strong>
      <em>
        {transaction.createdAt
          ? new Date(transaction.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US')
          : '-'}
      </em>
    </div>
  );
}

export default TransactionItem;
