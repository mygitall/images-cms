import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, Check, Copy, Eye, Heart, ImageIcon, LoaderCircle, X
} from 'lucide-react';
import { copy as i18nCopy } from '../i18n';
import {
  cx, compactText, textFor, listFor, formatTemplatePrompt,
  localizeLabel, localizeTemplateTag, fallbackRepoUrl,
  getSavedGeneration, saveGeneratedTest, getAuthHeaders,
  getGenerationQuotaText, generationErrorMessage
} from '../utils';
import { useBodyScrollLock } from '../hooks';
import './PreviewDialog.css';

function PreviewDialog({
  preview,
  language,
  styleLibrary,
  copiedId,
  session,
  profile,
  favorite,
  favoriteBusy,
  onClose,
  onCopyText,
  onToggleFavorite,
  onAuthRequired,
  onBillingRequired,
  onProfileChange
}) {
  const t = i18nCopy[language];
  const repoDocsUrl = `${styleLibrary.repository || fallbackRepoUrl}/blob/main/${styleLibrary.templateDocument}`;
  const [editablePrompt, setEditablePrompt] = useState('');
  const [generationState, setGenerationState] = useState({
    status: 'idle',
    image: '',
    message: ''
  });
  const [genElapsed, setGenElapsed] = useState(0);
  const genTimerRef = useRef(null);
  const [availModels, setAvailModels] = useState([]);
  useBodyScrollLock(Boolean(preview));

  useEffect(() => {
    if (generationState.status === 'generating') {
      setGenElapsed(0);
      genTimerRef.current = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    } else {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    }
    return () => { if (genTimerRef.current) clearInterval(genTimerRef.current); };
  }, [generationState.status]);

  useEffect(() => {
    if (!preview || preview.type !== 'case') return;
    fetch('/api/models')
      .then((r) => r.json())
      .then((p) => { if (p?.ok) setAvailModels(p.models || []); })
      .catch(() => {});
  }, [preview?.item?.id]);

  useEffect(() => {
    if (!preview) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [preview, onClose]);

  useEffect(() => {
    if (preview?.type !== 'case') return;
    const savedGeneration = getSavedGeneration(preview.item.id);
    setEditablePrompt(preview.item.prompt || '');
    setGenerationState(
      savedGeneration
        ? {
            status: 'saved',
            image: savedGeneration.image,
            message: '',
            prompt: savedGeneration.prompt || preview.item.prompt || '',
            savedAt: savedGeneration.savedAt || ''
          }
        : { status: 'idle', image: '', message: '', prompt: '', savedAt: '' }
    );
  }, [preview]);

  if (!preview) return null;

  const { type, item } = preview;
  const isTemplate = type === 'template';
  const title = isTemplate ? textFor(item.title, language) : item.title;
  const description = isTemplate ? textFor(item.description, language) : compactText(item.promptPreview);
  const image = isTemplate ? item.cover : item.image;
  const imageAlt = isTemplate ? title : item.imageAlt;
  const promptText = isTemplate ? formatTemplatePrompt(item, language, styleLibrary) : editablePrompt;
  const copyId = isTemplate ? `template-${item.id}` : `case-${item.id}`;
  const isCopied = copiedId === copyId;
  const primaryLink = isTemplate ? `${repoDocsUrl}#${item.anchor}` : item.githubUrl;
  const primaryLabel = isTemplate ? t.openTemplate : t.openOnGithub;
  const meta = isTemplate
    ? [t.templateKind, localizeLabel(item.category, language, styleLibrary)]
    : [
        `${language === 'zh' ? '案例' : 'Case'} ${item.id}`,
        localizeLabel(item.category, language, styleLibrary)
      ];
  const tags = isTemplate
    ? [...new Set([...(item.tags || []), ...(item.styles || []), ...(item.scenes || [])])].slice(0, 8)
    : [...new Set([...(item.styles || []), ...(item.scenes || [])])].slice(0, 8);
  const guidance = listFor(item.guidance, language);
  const pitfalls = listFor(item.pitfalls, language);
  const isGenerating = generationState.status === 'generating';
  const generatedImage = !isTemplate ? generationState.image : '';
  const isSignedIn = Boolean(session?.access_token || session?.phpSession);
  const creditBalance = Number(profile?.creditBalance || 0);
  const isOutOfCredits = isSignedIn
    && creditBalance <= 0
    && (profile?.isSuperAdmin || Boolean(profile?.freeUsed));
  const generationLocked = isGenerating;
  const quotaText = isSignedIn ? getGenerationQuotaText(profile, language) : t.authRequired;

  async function handleGenerate() {
    if (isTemplate || isGenerating) return;
    if (!isSignedIn) {
      onAuthRequired();
      setGenerationState({ status: 'idle', image: generatedImage, message: '' });
      return;
    }
    const prompt = editablePrompt.trim();
    if (!prompt || prompt.length > 6000) {
      setGenerationState({ status: 'error', image: '', message: t.promptRequired });
      return;
    }
    if (isOutOfCredits) {
      onBillingRequired();
      setGenerationState({ status: 'idle', image: generatedImage, message: t.creditsRequired });
      return;
    }

    setGenerationState({ status: 'generating', image: '', message: '' });

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session)
        },
        body: JSON.stringify({
          caseId: item.id,
          prompt
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok || !payload.image) {
        if (payload.user) onProfileChange(payload.user);
        if (payload.error === 'AUTH_REQUIRED' || payload.loginRequired) {
          onAuthRequired();
          setGenerationState({ status: 'idle', image: generatedImage, message: '' });
          return;
        }
        throw new Error(payload.error || 'GENERATION_FAILED');
      }

      const savedAt = new Date().toISOString();
      saveGeneratedTest(item.id, {
        image: payload.image,
        prompt,
        savedAt
      });
      if (payload.user) onProfileChange(payload.user);
      setGenerationState({ status: 'success', image: payload.image, message: '', prompt, savedAt });
    } catch (error) {
      setGenerationState({
        status: 'error',
        image: '',
        message: generationErrorMessage(error.message, language)
      });
    }
  }

  return (
    <div
      className="previewOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="previewDialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <button className="previewClose" type="button" onClick={onClose} aria-label={t.closePreview}>
          <X size={20} />
        </button>
        <div className={cx('previewMedia', generatedImage && 'hasComparison')}>
          {generatedImage ? (
            <div className="comparisonGrid">
              <figure className="comparisonFigure">
                <div className="comparisonLabel">{t.originalImage}</div>
                <img src={image} alt={imageAlt} />
              </figure>
              <figure className="comparisonFigure generatedFigure">
                <div className="comparisonLabel">
                  {t.generatedResult}
                  {generationState.status === 'saved' ? <span>{t.savedInBrowser}</span> : null}
                </div>
                <img src={generatedImage} alt={t.generatedResult} />
              </figure>
            </div>
          ) : (
            <img src={image} alt={imageAlt} />
          )}
        </div>
        <div className="previewContent">
          <div className="previewMeta">
            {meta.map((itemMeta) => (
              <span key={itemMeta}>{itemMeta}</span>
            ))}
          </div>
          <h2 id="preview-title">{title}</h2>
          <p>{description}</p>
          <div className="tagRow previewTags">
            {tags.map((tag) => (
              <span key={`${type}-${item.id}-${tag}`}>
                {isTemplate
                  ? localizeTemplateTag(tag, language, styleLibrary)
                  : localizeLabel(tag, language, styleLibrary)}
              </span>
            ))}
          </div>
          {isTemplate && item.useWhen ? (
            <div className="previewSection compactSection">
              <h3>{t.useWhen}</h3>
              <p>{textFor(item.useWhen, language)}</p>
            </div>
          ) : null}
          <div className="previewActions">
            {!isTemplate ? (
              <button
                className={cx('favoriteAction', favorite && 'active')}
                type="button"
                onClick={() => onToggleFavorite(item)}
                disabled={favoriteBusy}
                aria-pressed={Boolean(favorite)}
              >
                {favoriteBusy ? <LoaderCircle className="spinIcon" size={17} /> : <Heart size={17} />}
                {favorite ? t.unfavorite : t.favorite}
              </button>
            ) : null}
            <button type="button" onClick={() => onCopyText(promptText, copyId)}>
              {isCopied ? <Check size={17} /> : <Copy size={17} />}
              {isCopied ? t.copied : isTemplate ? t.copyTemplatePrompt : t.copyPrompt}
            </button>
            {!isTemplate ? (
              <button type="button" onClick={handleGenerate} disabled={generationLocked}>
                {isGenerating ? <LoaderCircle className="spinIcon" size={17} /> : <ImageIcon size={17} />}
                {isGenerating ? t.generating : isOutOfCredits ? t.buyCredits : isSignedIn ? t.generateTest : t.signInToGenerate}
              </button>
            ) : null}
            <a href={primaryLink} target="_blank" rel="noreferrer">
              {primaryLabel}
              <ArrowUpRight size={17} />
            </a>
            {!isTemplate && item.sourceUrl ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {t.source}
                <ArrowUpRight size={17} />
              </a>
            ) : null}
          </div>
          <div className="previewSection">
            <div className="sectionTitleRow">
              <h3>{isTemplate ? t.templatePrompt : t.editablePrompt}</h3>
              {!isTemplate ? (
                <button type="button" onClick={() => setEditablePrompt(item.prompt || '')}>
                  {t.resetPrompt}
                </button>
              ) : null}
            </div>
            {isTemplate ? (
              <pre className="promptBlock">{promptText}</pre>
            ) : (
              <textarea
                className="promptEditor"
                value={editablePrompt}
                onChange={(event) => setEditablePrompt(event.target.value)}
                maxLength={6000}
              />
            )}
            {!isTemplate ? (
              <div className="generationPanel">
                <div className={cx('generationQuota', (!isSignedIn || isOutOfCredits) && 'used')}>
                  {quotaText}
                </div>
                {availModels.length > 0 ? (
                  <div className="generationModels">
                    {language === 'zh' ? '模型：' : 'Models: '}
                    {availModels.map((m) => <code key={m}>{m}</code>)}
                  </div>
                ) : null}
                {isGenerating ? (
                  <div className="generationTimer">
                    <LoaderCircle className="spinIcon" size={16} />
                    {language === 'zh' ? `生成中... ${genElapsed}s` : `Generating... ${genElapsed}s`}
                  </div>
                ) : null}
                <button type="button" onClick={handleGenerate} disabled={generationLocked}>
                  {isGenerating ? <LoaderCircle className="spinIcon" size={17} /> : <ImageIcon size={17} />}
                  {isGenerating ? t.generating : isOutOfCredits ? t.buyCredits : isSignedIn ? t.generateImage : t.signInToGenerate}
                </button>
                {generationState.status === 'error' ? (
                  <p className="generationMessage">{generationState.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {isTemplate && (guidance.length || pitfalls.length || item.exampleCases?.length) ? (
            <div className="previewColumns">
              {guidance.length ? (
                <div className="previewSection compactSection">
                  <h3>{t.guidance}</h3>
                  <ul>
                    {guidance.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {pitfalls.length ? (
                <div className="previewSection compactSection">
                  <h3>{t.pitfalls}</h3>
                  <ul>
                    {pitfalls.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {item.exampleCases?.length ? (
                <div className="previewSection compactSection">
                  <h3>{t.examples}</h3>
                  <div className="exampleCaseRow">
                    {item.exampleCases.map((caseId) => (
                      <a
                        href={`${styleLibrary.repository || fallbackRepoUrl}/blob/main/docs/gallery.md#case-${caseId}`}
                        target="_blank"
                        rel="noreferrer"
                        key={caseId}
                      >
                        #{caseId}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default PreviewDialog;
