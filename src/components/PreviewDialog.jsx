import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, Check, Copy, Eye, Heart, ImageIcon, ImagePlus, LoaderCircle, RefreshCw, X
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
  const [genCost, setGenCost] = useState(0.09);
  const [referenceMode, setReferenceMode] = useState(false);
  const [referenceImages, setReferenceImages] = useState([]);
  const [refAutoHint, setRefAutoHint] = useState(false);
  const fileInputRef = useRef(null);
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
    if (!preview) return;
    if (preview.type !== 'case' && preview.type !== 'free') {
      setAvailModels([]);
      return;
    }
    fetch('/api/models')
      .then((r) => r.json())
      .then((p) => { if (p?.ok) setAvailModels(p.models || []); })
      .catch(() => {});
    fetch('/images20/api/features.php')
      .then(r => r.json())
      .then(f => {
        const cost = parseFloat(f.gen_cost_yuan);
        if (cost > 0) setGenCost(cost);
      })
      .catch(() => {});
  }, [preview?.type, preview?.item?.id]);

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
    if (!preview) return;

    setReferenceMode(false);
    setReferenceImages([]);

    if (preview.type === 'case') {
      const savedGeneration = getSavedGeneration(preview.item?.id);
      setEditablePrompt(preview.item?.prompt || '');
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
    } else if (preview.type === 'template') {
      const formatted = formatTemplatePrompt(preview.item, language, styleLibrary);
      setEditablePrompt(formatted.slice(0, 6000));
      setGenerationState({ status: 'idle', image: '', message: '', prompt: '', savedAt: '' });
    } else if (preview.type === 'free') {
      setEditablePrompt('');
      setGenerationState({ status: 'idle', image: '', message: '', prompt: '', savedAt: '' });
    }
  }, [preview]);

  if (!preview) return null;

  const { type, item } = preview;
  const isTemplate = type === 'template';
  const isFree = type === 'free';
  const title = isFree ? '' : (isTemplate ? textFor(item?.title, language) : item?.title || '');
  const description = isFree ? '' : (isTemplate ? textFor(item.description, language) : compactText(item?.promptPreview));
  const image = isFree ? '' : (isTemplate ? item.cover : item?.image || '');
  const imageAlt = isFree ? '' : (isTemplate ? title : item?.imageAlt || '');
  const promptText = editablePrompt;
  const copyId = isFree ? 'free' : (isTemplate ? `template-${item.id}` : `case-${item.id}`);
  const isCopied = copiedId === copyId;
  const primaryLink = isFree ? '' : (isTemplate ? `${repoDocsUrl}#${item.anchor}` : item?.githubUrl || '#');
  const primaryLabel = isTemplate ? t.openTemplate : t.openOnGithub;
  const meta = isFree ? [] : (isTemplate
    ? [t.templateKind, localizeLabel(item.category, language, styleLibrary)]
    : [
        `${language === 'zh' ? '案例' : 'Case'} ${item.id}`,
        localizeLabel(item.category, language, styleLibrary)
      ]);
  const tags = isFree ? [] : (isTemplate
    ? [...new Set([...(item.tags || []), ...(item.styles || []), ...(item.scenes || [])])].slice(0, 8)
    : [...new Set([...(item.styles || []), ...(item.scenes || [])])].slice(0, 8));
  const guidance = isFree ? [] : listFor(item.guidance, language);
  const pitfalls = isFree ? [] : listFor(item.pitfalls, language);
  const isGenerating = generationState.status === 'generating';
  const generatedImage = generationState.image;
  const isSignedIn = Boolean(session?.access_token || session?.phpSession);
  const creditBalance = Number(profile?.creditBalance || 0);
  const isOutOfCredits = isSignedIn
    && creditBalance <= 0
    && (profile?.isSuperAdmin || Boolean(profile?.freeUsed));
  const generationLocked = isGenerating;
  const quotaText = isSignedIn ? getGenerationQuotaText(profile, language) : t.authRequired;

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remaining = 4 - referenceImages.length;
    if (remaining <= 0) {
      event.target.value = '';
      return;
    }
    const toProcess = files.slice(0, remaining);
    let errorShown = false;
    toProcess.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        if (!errorShown) {
          errorShown = true;
          setGenerationState({ status: 'error', image: generatedImage, message: language === 'zh' ? '图片大小不能超过 10MB' : language === 'ko' ? '이미지 크기는 10MB를 초과할 수 없습니다' : 'Image must be under 10MB' });
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceImages((prev) => {
          if (prev.length >= 4) return prev;
          return [...prev, reader.result];
        });
      };
      reader.onerror = () => {
        setGenerationState({ status: 'error', image: generatedImage, message: language === 'zh' ? '文件读取失败' : language === 'ko' ? '파일 읽기 실패' : 'Failed to read file' });
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  function toggleReferenceMode() {
    if (!referenceMode) {
      setReferenceMode(true);
      if (!isTemplate && image && referenceImages.length === 0) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setReferenceImages([canvas.toDataURL('image/jpeg', 0.9)]);
          setRefAutoHint(true);
          setTimeout(() => setRefAutoHint(false), 3000);
        };
        img.onerror = () => {};
        img.src = image;
      }
    } else {
      setReferenceMode(false);
      setReferenceImages([]);
      setRefAutoHint(false);
    }
  }

  async function handleGenerate() {
    if (isGenerating) return;
    if (!isSignedIn) {
      onAuthRequired();
      setGenerationState({ status: 'idle', image: generatedImage, message: '' });
      return;
    }
    if (referenceMode && referenceImages.length === 0) {
      setGenerationState({ status: 'error', image: generatedImage, message: language === 'zh' ? '请至少上传一张参考图' : language === 'ko' ? '최소 1장의 참조 이미지를 업로드하세요' : 'Please upload at least one reference image' });
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
          caseId: (isTemplate || isFree) ? 0 : item.id,
          prompt,
          referenceImages: referenceMode ? referenceImages : []
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
        if (payload.error === 'CREDITS_REQUIRED') {
          onBillingRequired();
          setGenerationState({ status: 'idle', image: generatedImage, message: t.creditsRequired });
          return;
        }
        if (payload.error === 'INVALID_PROMPT' && (isTemplate || isFree)) {
          setGenerationState({ status: 'error', image: '', message: t.promptRequired });
          return;
        }
        const err = new Error(payload.error || 'GENERATION_FAILED');
        err.detail = payload.message || '';
        throw err;
      }

      if (isTemplate || isFree) {
        setGenerationState({ status: 'success', image: payload.image, message: '', prompt, savedAt: new Date().toISOString() });
      } else {
        const savedAt = new Date().toISOString();
        saveGeneratedTest(item.id, {
          image: payload.image,
          prompt,
          savedAt
        });
        if (payload.user) onProfileChange(payload.user);
        setGenerationState({ status: 'success', image: payload.image, message: '', prompt, savedAt });
      }
    } catch (error) {
      setGenerationState({
        status: 'error',
        image: generatedImage,
        message: error.detail || generationErrorMessage(error.message, language)
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
      <section className="previewDialog" role="dialog" aria-modal="true" aria-label={isFree ? (t.freeCreation) : undefined} aria-labelledby={isFree ? undefined : 'preview-title'}>
        <button className="previewClose" type="button" onClick={onClose} aria-label={t.closePreview}>
          <X size={20} />
        </button>
        <div className={cx('previewMedia', generatedImage && !isFree && 'hasComparison', isFree && !generatedImage && 'previewMediaEmpty')}>
          {isFree && !generatedImage ? (
            <div className="previewMediaPlaceholder">
              <ImageIcon size={48} />
              <span>{t.freeCreation}</span>
            </div>
          ) : isFree && generatedImage ? (
            <img src={generatedImage} alt={t.generatedResult} />
          ) : generatedImage ? (
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
          {!isFree ? (
            <div className="previewMeta">
              {meta.map((itemMeta) => (
                <span key={itemMeta}>{itemMeta}</span>
              ))}
            </div>
          ) : null}
          {!isFree ? <h2 id="preview-title">{title}</h2> : null}
          {!isFree ? <p>{description}</p> : null}
          {!isFree ? (
            <div className="tagRow previewTags">
              {tags.map((tag) => (
                <span key={`${type}-${item.id}-${tag}`}>
                  {isTemplate
                    ? localizeTemplateTag(tag, language, styleLibrary)
                    : localizeLabel(tag, language, styleLibrary)}
                </span>
              ))}
            </div>
          ) : null}
          {isTemplate && item.useWhen ? (
            <div className="previewSection compactSection">
              <h3>{t.useWhen}</h3>
              <p>{textFor(item.useWhen, language)}</p>
            </div>
          ) : null}
          {!isFree ? (
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
              <a href={primaryLink} target="_blank" rel="noreferrer">
                {primaryLabel}
                <ArrowUpRight size={17} />
              </a>
              {!isTemplate && item?.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {t.source}
                  <ArrowUpRight size={17} />
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="previewSection">
            <div className="sectionTitleRow">
              <h3>{isFree ? (t.enterPrompt) : (isTemplate ? t.templatePrompt : t.editablePrompt)}</h3>
              {!isFree ? (
              <button type="button" onClick={() => {
                if (isTemplate) {
                  setEditablePrompt(formatTemplatePrompt(item, language, styleLibrary));
                } else {
                  setEditablePrompt(preview.item.prompt || '');
                }
              }}>
                {t.resetPrompt}
              </button>
              ) : null}
            </div>
            <textarea
              className="promptEditor"
              value={editablePrompt}
              onChange={(event) => setEditablePrompt(event.target.value)}
              maxLength={6000}
            />
            <div className="generationPanel">
              <div className="referenceRow">
                <button
                  type="button"
                  className={cx('referenceToggle', referenceMode && 'active')}
                  onClick={toggleReferenceMode}
                  title={language === 'zh' ? '参考图模式' : language === 'ko' ? '참조 이미지 모드' : 'Reference image mode'}
                >
                  <ImagePlus size={15} />
                  {language === 'zh' ? '参考图' : 'Reference'}
                  {referenceMode && referenceImages.length > 0 ? (
                    <span className="referenceCount">{referenceImages.length}/4</span>
                  ) : null}
                </button>
                {refAutoHint ? (
                  <span className="refAutoHint">
                    {language === 'zh' ? '已自动加载案例原图作为参考' : language === 'ko' ? '케이스 이미지가 참조로 자동 추가됨' : 'Case image auto-added as reference'}
                  </span>
                ) : null}
                {referenceMode && referenceImages.length < 4 ? (
                  <button type="button" className="referenceUploadBtn" onClick={() => fileInputRef.current?.click()}>
                    {language === 'zh' ? '上传' : language === 'ko' ? '업로드' : 'Upload'}
                  </button>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
              {referenceMode && referenceImages.length > 0 ? (
                <div className="referencePreviews">
                  {referenceImages.map((ref, idx) => (
                    <div className="referencePreview" key={idx}>
                      <img src={ref} alt="" />
                      <button type="button" className="referenceRemove" onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={cx('generationQuota', (!isSignedIn || isOutOfCredits) && 'used')}>
                {quotaText}
                {isOutOfCredits ? (
                  <span className="quotaCostHint">
                    {language === 'zh' ? `（${genCost.toFixed(2)} 元/次）` : language === 'ko' ? `(${genCost.toFixed(2)} 위안/회)` : `($${genCost.toFixed(2)}/gen)`}
                  </span>
                ) : null}
              </div>
              {availModels.length > 0 ? (
                <div className="generationModels">
                  {language === 'zh' ? '模型：' : language === 'ko' ? '모델: ' : 'Models: '}
                  {availModels.map((m) => <code key={m}>{m}</code>)}
                </div>
              ) : null}
              {isGenerating ? (
                <div className="generationTimer">
                  <LoaderCircle className="spinIcon" size={16} />
                  {language === 'zh' ? `生成中... ${genElapsed}s` : language === 'ko' ? `생성 중... ${genElapsed}초` : `Generating... ${genElapsed}s`}
                </div>
              ) : null}
              <button type="button" onClick={handleGenerate} disabled={generationLocked}>
                {isGenerating ? <LoaderCircle className="spinIcon" size={17} /> : <ImageIcon size={17} />}
                {isGenerating ? t.generating : isOutOfCredits ? t.buyCredits : isSignedIn ? t.generateImage : t.signInToGenerate}
              </button>
              {generatedImage ? (
                <button type="button" className="continueGenBtn" onClick={() => {
                  setReferenceMode(true);
                  setReferenceImages([generatedImage]);
                  setGenerationState((prev) => ({ ...prev, status: 'idle', message: '', prompt: '', savedAt: '' }));
                }}>
                  <RefreshCw size={15} />
                  {language === 'zh' ? '基于此图继续生图' : language === 'ko' ? '이 이미지로 계속 생성' : 'Continue from this image'}
                </button>
              ) : null}
              {generationState.status === 'error' ? (
                <p className="generationMessage">{generationState.message}</p>
              ) : null}
            </div>
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
