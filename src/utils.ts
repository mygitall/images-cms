import { copy, labelMap } from './i18n';
import type {
  CaseItem, StyleLibrary, UserProfile, Session, TemplateItem,
  Transaction, FavoriteRow, Language
} from './types';

const fallbackRepoUrl = 'https://github.com/freestylefly/awesome-gpt-image-2';
const gaMeasurementId = (import.meta as any).env?.VITE_GA_MEASUREMENT_ID as string | undefined;
const GENERATED_TESTS_STORAGE_KEY = 'gpt-image-2-generated-tests:v1';
const MAX_SAVED_GENERATIONS = 12;
const HERO_CASE_COUNT = 5;
const HOT_STRIP_CASE_COUNT = 8;

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function textFor(value: string | Record<string, string> | undefined | null, language: Language): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.en || value.zh || '';
}

function listFor(value: Record<string, string[]> | undefined | null, language: Language): string[] {
  const localized = (value as any)?.[language] || (value as any)?.en || (value as any)?.zh || [];
  return Array.isArray(localized) ? localized : [];
}

function compactText(value: string | undefined | null, maxLength = 180): string {
  if (!value || value.length <= maxLength) return value || '';
  return `${value.slice(0, maxLength)}...`;
}

function pagePathWithHash(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function sendGaPageView(): void {
  if (!gaMeasurementId || typeof (window as any).gtag !== 'function') return;
  (window as any).gtag('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: pagePathWithHash()
  });
}

function formatNumber(value: number | undefined | null): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function formatShortDate(value: string | number | undefined | null, language: Language): string {
  if (!value) return '-';
  const normalized = /^\d{8}$/.test(String(value))
    ? `${String(value).slice(0, 4)}-${String(value).slice(4, 6)}-${String(value).slice(6, 8)}T00:00:00Z`
    : value;
  return new Date(normalized as string).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
    { month: 'short', day: 'numeric' }
  );
}

function formatRangeDate(value: string | undefined | null, language: Language): string {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  );
}

function dateInputValue(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstNumber(...values: (number | undefined | null)[]): number {
  const value = values.find((item) => item !== undefined && item !== null);
  return Number(value || 0);
}

function percentOf(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(4, Math.round((Number(value || 0) / max) * 100));
}

function readSavedGenerations(): Record<string, { image?: string; prompt?: string; savedAt?: string }> {
  try {
    return JSON.parse(localStorage.getItem(GENERATED_TESTS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function getSavedGeneration(caseId: number | string): { image: string; prompt?: string; savedAt?: string } | null {
  const saved = readSavedGenerations()[String(caseId)];
  return saved?.image ? saved : null;
}

function saveGeneratedTest(caseId: number | string, entry: { image: string; prompt: string; savedAt: string }): void {
  const key = String(caseId);
  const saved = readSavedGenerations();
  saved[key] = entry;

  const latestEntries = Object.entries(saved)
    .filter(([, value]) => value?.image)
    .sort(([, a], [, b]) => new Date((b as any).savedAt || 0).getTime() - new Date((a as any).savedAt || 0).getTime())
    .slice(0, MAX_SAVED_GENERATIONS);

  try {
    localStorage.setItem(GENERATED_TESTS_STORAGE_KEY, JSON.stringify(Object.fromEntries(latestEntries)));
  } catch {
    const compactEntries = latestEntries.slice(0, Math.max(1, Math.floor(MAX_SAVED_GENERATIONS / 2)));
    try {
      localStorage.setItem(GENERATED_TESTS_STORAGE_KEY, JSON.stringify(Object.fromEntries(compactEntries)));
    } catch {
      // Browser storage can be full or blocked
    }
  }
}

function normalizeFavoriteRows(favorites: any[] = []): FavoriteRow[] {
  const rows = Array.isArray(favorites) ? favorites : [];
  return rows
    .map((favorite) => ({
      caseId: Number(favorite.caseId || favorite.case_id),
      createdAt: favorite.createdAt || favorite.created_at || ''
    }))
    .filter((favorite) => Number.isInteger(favorite.caseId) && favorite.caseId > 0);
}

function takeDistinctCases(cases: CaseItem[], count: number, excludedIds: Set<number> = new Set()): CaseItem[] {
  const picked: CaseItem[] = [];
  const seenIds = new Set(excludedIds);

  for (const caseItem of cases) {
    if (seenIds.has(caseItem.id)) continue;
    picked.push(caseItem);
    seenIds.add(caseItem.id);
    if (picked.length === count) break;
  }

  return picked;
}

function localizeLabel(value: string, language: Language, styleLibrary: StyleLibrary | null): string {
  const libraryItems = [
    ...(styleLibrary?.categories || []),
    ...(styleLibrary?.styles || []),
    ...(styleLibrary?.scenes || [])
  ];
  const match = libraryItems.find((item: any) => item.value === value || item.id === value);
  if (match) return textFor(match.title, language);
  return (labelMap as any)[language]?.[value] || value;
}

function localizeTemplateTag(value: string, language: Language, styleLibrary: StyleLibrary | null): string {
  const tagLabel = (styleLibrary?.tagLabels as any)?.[value];
  if (tagLabel) return textFor(tagLabel, language);
  return localizeLabel(value, language, styleLibrary);
}

function orderByLibrary(values: string[], libraryItems: { value: string }[] = []): string[] {
  const order = new Map(libraryItems.map((item, index) => [item.value, index]));
  return [...values].sort((a, b) => {
    const aOrder = order.has(a) ? order.get(a)! : Number.MAX_SAFE_INTEGER;
    const bOrder = order.has(b) ? order.get(b)! : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function generationErrorMessage(error: string, language: Language): string {
  const t = copy[language];
  if (error === 'FREE_LIMIT_REACHED') return t.freeLimitReached as string;
  if (error === 'CREDITS_REQUIRED') return t.creditsRequired as string;
  if (error === 'AUTH_REQUIRED') return t.authRequired as string;
  if (error === 'FORBIDDEN') return t.adminOnly as string;
  if (error === 'API_KEY_INVALID') return language === 'zh' ? '服务配置异常，请联系管理员' : language === 'ko' ? '서비스 구성 오류. 관리자에게 문의하세요.' : 'Service configuration error, please contact admin';
  if (error === 'UPSTREAM_BUSY') return language === 'zh' ? '生图服务繁忙，请稍后重试' : language === 'ko' ? '생성 서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.' : 'Generation service is busy, please try again later';
  if (error === 'SERVER_NOT_CONFIGURED') return language === 'zh' ? '生图服务尚未配置，请联系管理员' : language === 'ko' ? '생성 서비스가 아직 구성되지 않았습니다.' : 'Generation service not configured yet';
  if (error === 'BILLING_NOT_CONFIGURED') return t.checkoutUnavailable as string;
  if (error === 'CHECKOUT_FAILED' || error === 'BILLING_PORTAL_FAILED') return t.checkoutFailed as string;
  if (error === 'INVALID_PROMPT') return t.promptRequired as string;
  if (error === 'Failed to fetch' || error === 'NetworkError') return language === 'zh' ? '网络连接失败，请检查网络后重试' : language === 'ko' ? '네트워크 연결 실패. 네트워크를 확인하고 다시 시도해 주세요.' : 'Network error, please check your connection and try again';
  if (error === 'GENERATION_FAILED') return language === 'zh' ? '生图失败，请检查提示词后重试' : language === 'ko' ? '생성 실패. 프롬프트를 확인하고 다시 시도해 주세요.' : 'Generation failed, please check your prompt and try again';
  return language === 'zh' ? '生图失败，请稍后重试' : language === 'ko' ? '생성 실패. 나중에 다시 시도해 주세요.' : 'Generation failed, please try again later';
}

function getAuthHeaders(session: Session | null): Record<string, string> {
  if (session?.phpSession) return {};
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function getGenerationQuotaText(profile: UserProfile | null, language: Language): string {
  const t = copy[language];
  if (!profile) return t.authRequired as string;
  if (profile.isSuperAdmin) {
    const fn = t.creditsAvailable as Function;
    return profile.creditBalance > 0
      ? `${t.superAdminGeneration} ${fn(profile.creditBalance)}`
      : t.creditsRequired as string;
  }
  if (!profile.freeUsed) return t.oneFreeGeneration as string;
  if (profile.creditBalance > 0) {
    const fn = t.creditsAvailable as Function;
    return fn(profile.creditBalance) as string;
  }
  return t.creditsRequired as string;
}

function productText(value: string | Record<string, string> | undefined | null, language: Language): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.en || value.zh || '';
}

function formatMembershipStatus(membership: UserProfile['membership'] | undefined | null, language: Language): string {
  const t = copy[language];
  if (!membership?.isActive) return t.noPlan as string;
  const status = membership.status === 'trialing' ? 'trialing' : 'active';
  if (!membership.currentPeriodEnd) return status;
  const date = new Date(membership.currentPeriodEnd).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US'
  );
  return `${status} · ${t.activeUntil} ${date}`;
}

function transactionLabel(transaction: Transaction, language: Language): string {
  const typeMap: Record<string, string> = {
    grant: language === 'zh' ? '赠送' : language === 'ko' ? '증정' : 'Grant',
    purchase: language === 'zh' ? '购买' : language === 'ko' ? '구매' : 'Purchase',
    membership_grant: language === 'zh' ? '会员发放' : language === 'ko' ? '멤버십 증정' : 'Membership grant',
    generation: language === 'zh' ? '生图消耗' : language === 'ko' ? '생성 사용' : 'Generation',
    refund: language === 'zh' ? '失败返还' : language === 'ko' ? '환불' : 'Refund',
    adjustment: language === 'zh' ? '管理员调整' : language === 'ko' ? '관리자 조정' : 'Admin adjustment'
  };
  return typeMap[transaction.type] || transaction.type || '-';
}

function transactionCaseId(transaction: Transaction): number | null {
  const rawCaseId = transaction?.caseId || transaction?.metadata?.caseId;
  const caseId = Number(rawCaseId);
  return Number.isFinite(caseId) && caseId > 0 ? caseId : null;
}

function formatTemplatePrompt(item: TemplateItem, language: Language, styleLibrary: StyleLibrary | null): string {
  const title = textFor(item.title, language);
  const description = textFor(item.description, language);
  const useWhen = textFor(item.useWhen, language);
  const guidance = listFor(item.guidance as any, language);
  const pitfalls = listFor(item.pitfalls as any, language);
  const tags = [
    localizeLabel(item.category, language, styleLibrary),
    ...(item.styles || []).map((style) => localizeLabel(style, language, styleLibrary)),
    ...(item.scenes || []).map((scene) => localizeLabel(scene, language, styleLibrary)),
    ...(item.tags || []).map((tag) => localizeTemplateTag(tag, language, styleLibrary))
  ].filter(Boolean);
  const uniqueTags = [...new Set(tags)];

  if (language === 'zh') {
    return [
      `模板：${title}`,
      `用途：${useWhen || description}`,
      `视觉方向：${uniqueTags.join(' / ')}`,
      '',
      '请基于以下结构生成一条可直接用于 GPT Image 2 的图片 Prompt：',
      '- 主体：[要生成的产品、人物、空间、界面或信息主题]',
      '- 场景：[使用环境、叙事背景、受众语境]',
      '- 构图：[画面比例、镜头距离、主体位置、层级关系]',
      '- 风格：[材质、光线、色彩、时代感、品牌气质]',
      '- 文本：[必须准确显示的标题、标签、按钮或说明文字]',
      '- 细节：[关键装饰、辅助元素、信息标注、交互层]',
      '- 输出：[清晰度、比例、完成度、可读性要求]',
      '',
      '核心约束：',
      ...guidance.map((line) => `- ${line}`),
      '',
      '需要避免：',
      ...pitfalls.map((line) => `- ${line}`)
    ].join('\n');
  }

  return [
    `Template: ${title}`,
    `Use case: ${useWhen || description}`,
    `Visual direction: ${uniqueTags.join(' / ')}`,
    '',
    'Create a copy-ready GPT Image 2 prompt with this structure:',
    '- Subject: [product, person, space, interface, or information topic]',
    '- Scene: [context, audience, narrative setting]',
    '- Composition: [aspect ratio, camera distance, focal hierarchy, placement]',
    '- Style: [material, lighting, color, era, brand tone]',
    '- Text: [exact title, labels, buttons, or annotations that must be readable]',
    '- Details: [decorative elements, callouts, UI layers, supporting objects]',
    '- Output: [resolution, aspect ratio, polish level, readability requirements]',
    '',
    'Core constraints:',
    ...guidance.map((line) => `- ${line}`),
    '',
    'Avoid:',
    ...pitfalls.map((line) => `- ${line}`)
  ].join('\n');
}

function authErrorMessage(error: any, language: Language): string {
  const t = copy[language];
  const message = String(error?.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (error?.status === 429 || normalized.includes('rate limit') || normalized.includes('too many')) {
    return t.authRateLimited as string;
  }

  if (normalized.includes('provider') || normalized.includes('oauth')) {
    return t.googleNotConfigured as string;
  }

  return message || (t.authError as string);
}

export {
  fallbackRepoUrl,
  gaMeasurementId,
  GENERATED_TESTS_STORAGE_KEY,
  MAX_SAVED_GENERATIONS,
  HERO_CASE_COUNT,
  HOT_STRIP_CASE_COUNT,
  cx,
  textFor,
  listFor,
  compactText,
  pagePathWithHash,
  sendGaPageView,
  formatNumber,
  formatShortDate,
  formatRangeDate,
  dateInputValue,
  firstNumber,
  percentOf,
  readSavedGenerations,
  getSavedGeneration,
  saveGeneratedTest,
  normalizeFavoriteRows,
  takeDistinctCases,
  localizeLabel,
  localizeTemplateTag,
  orderByLibrary,
  copyToClipboard,
  generationErrorMessage,
  getAuthHeaders,
  getGenerationQuotaText,
  productText,
  formatMembershipStatus,
  transactionLabel,
  transactionCaseId,
  formatTemplatePrompt,
  authErrorMessage
};
