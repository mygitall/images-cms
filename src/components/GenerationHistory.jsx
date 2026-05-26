import React, { useEffect, useState } from 'react';
import { ImageIcon, LoaderCircle, X } from 'lucide-react';
import { copy } from '../i18n';
import { useBodyScrollLock } from '../hooks';
import './GenerationHistory.css';

function GenerationHistory({ open, language, onClose }) {
  const t = copy[language];
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [deleteBusy, setDeleteBusy] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  useBodyScrollLock(open);

  function loadHistory() {
    setStatus('loading');
    fetch('/api/generation-history')
      .then((r) => r.json())
      .then((payload) => {
        setItems(payload?.ok ? payload.history || [] : []);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }

  async function handleDelete(item) {
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
          <h2><ImageIcon size={20} /> {language === 'zh' ? '生图历史' : 'Generation History'}</h2>
          <span>{language === 'zh' ? `共 ${items.length} 张` : `${items.length} images`}</span>
        </div>
        {status === 'loading' ? (
          <div className="historyState"><LoaderCircle className="spinIcon" size={22} /><span>{t.loading}</span></div>
        ) : status === 'error' ? (
          <div className="historyState"><p>{language === 'zh' ? '加载失败' : 'Load failed'}</p></div>
        ) : items.length === 0 ? (
          <div className="historyState"><p>{language === 'zh' ? '暂无生图记录' : 'No generation history'}</p></div>
        ) : (
          <div className="historyGrid">
            {items.map((item) => (
              <div className="historyCard" key={item.id}>
                <div className="historyImageWrap">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      onClick={() => setLightboxImage(item.imageUrl)}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : (
                    <div className="historyPlaceholder"><ImageIcon size={32} /></div>
                  )}
                  <button
                    className="historyDeleteBtn"
                    type="button"
                    title={language === 'zh' ? '删除' : 'Delete'}
                    disabled={deleteBusy === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deleteBusy === item.id ? <LoaderCircle className="spinIcon" size={12} /> : <X size={12} />}
                  </button>
                </div>
                <div className="historyInfo">
                  <p>{item.prompt}</p>
                  <time>{item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : ''}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {lightboxImage ? (
        <div
          className="historyLightbox"
          role="presentation"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="historyLightboxClose"
            type="button"
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
