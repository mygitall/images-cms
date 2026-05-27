import React, { useEffect, useState } from 'react';
import { ImageIcon, LoaderCircle, X } from 'lucide-react';
import { copy } from '../i18n';
import { useBodyScrollLock } from '../hooks';
import './GenerationHistory.css';

function GenerationHistory({ open, language, onClose }) {
  const t = copy[language];
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  useBodyScrollLock(open);

  function loadHistory() {
    setStatus('loading');
    fetch('/api/generation-history')
      .then((r) => r.json())
      .then((payload) => {
        setItems(payload?.ok ? payload.history || [] : []);
        setHasMore(payload?.hasMore || false);
        setTotalCount(payload?.total || 0);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }

  function loadMore() {
    setLoadingMore(true);
    fetch(`/api/generation-history?offset=${items.length}`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok) {
          setItems((prev) => [...prev, ...(payload.history || [])]);
          setHasMore(payload?.hasMore || false);
        }
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }

  async function handleDelete(item) {
    if (!window.confirm(t.confirmDelete)) return;
    setDeleteBusy(item.id);
    try {
      const res = await fetch('/api/generation-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      const payload = await res.json().catch(() => ({}));
      if (payload?.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {}
    setDeleteBusy(null);
  }

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  useEffect(() => {
    if (!lightboxImage) return;
    function onKey(e) { if (e.key === 'Escape') setLightboxImage(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxImage]);

  if (!open) return null;

  return (
    <div
      className="previewOverlay historyOverlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section className="historyDialog" role="dialog" aria-modal="true">
        <button className="previewClose" type="button" onClick={onClose}><X size={20} /></button>
        <div className="historyHeader">
          <h2><ImageIcon size={20} /> {t.history}</h2>
          <span>{language === 'zh' ? `共 ${totalCount} 张` : language === 'ko' ? `총 ${totalCount}장` : `${totalCount} images`}</span>
        </div>
        {status === 'loading' ? (
          <div className="historyState"><LoaderCircle className="spinIcon" size={22} /><span>{t.loading}</span></div>
        ) : status === 'error' ? (
          <div className="historyState">
            <p>{t.loadFailed}</p>
            <button type="button" onClick={loadHistory}>
              {t.retry}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="historyState"><p>{t.noGenerationHistory}</p></div>
        ) : (
          <div className="historyGrid">
            {items.map((item) => {
              const d = item.createdAt ? new Date(item.createdAt) : null;
              const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleString(language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US') : '';
              return (
              <div className="historyCard" key={item.id}>
                <div className="historyImageWrap">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      onClick={() => setLightboxImage(item.imageUrl)}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : (
                    <div className="historyPlaceholder"><ImageIcon size={32} /></div>
                  )}
                  <button
                    className="historyDeleteBtn"
                    type="button"
                    title={language === 'zh' ? '删除' : language === 'ko' ? '삭제' : 'Delete'}
                    disabled={deleteBusy === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deleteBusy === item.id ? <LoaderCircle className="spinIcon" size={12} /> : <X size={12} />}
                  </button>
                </div>
                <div className="historyInfo">
                  <p>{item.prompt}</p>
                  <time>{dateStr}</time>
                </div>
              </div>
            )})}
          </div>
        )}
        {hasMore && status === 'ready' ? (
          <div className="loadMoreBar">
            <button type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <LoaderCircle className="spinIcon" size={16} /> : null}
              {t.loadMoreBtn}
            </button>
          </div>
        ) : null}
      </section>
      {lightboxImage ? (
        <div
          className="historyLightbox"
          role="dialog"
          aria-label={language === 'zh' ? '查看原图' : language === 'ko' ? '원본 보기' : 'View full image'}
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="historyLightboxClose"
            type="button"
            aria-label={language === 'zh' ? '关闭' : language === 'ko' ? '닫기' : 'Close'}
            onClick={() => setLightboxImage(null)}
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImage}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default GenerationHistory;
