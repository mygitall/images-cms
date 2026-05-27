export interface CaseItem {
  id: number;
  title: string;
  category: string;
  prompt: string;
  promptPreview?: string;
  image: string;
  imageAlt: string;
  sourceLabel?: string;
  sourceUrl?: string;
  githubUrl?: string;
  styles?: string[];
  scenes?: string[];
  guidance?: Record<string, string[]>;
  pitfalls?: Record<string, string[]>;
}

export interface TemplateItem {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  useWhen?: Record<string, string>;
  cover: string;
  category: string;
  styles?: string[];
  scenes?: string[];
  tags?: string[];
  guidance?: Record<string, string[]>;
  pitfalls?: Record<string, string[]>;
  exampleCases?: number[];
  anchor?: string;
}

export interface StyleLibrary {
  repository?: string;
  templateDocument?: string;
  categories: { value: string; title: Record<string, string> }[];
  styles: { value: string; title: Record<string, string> }[];
  scenes: { value: string; title: Record<string, string> }[];
  templates: TemplateItem[];
  tagLabels?: Record<string, Record<string, string>>;
}

export interface SiteData {
  repository?: string;
  cases: CaseItem[];
  categories: string[];
  styles: string[];
  scenes: string[];
  totalCases: number;
}

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string;
  creditBalance: number;
  freeUsed: boolean;
  isSuperAdmin: boolean;
  role: string;
  membership: {
    isActive: boolean;
    planId: string;
    status: string;
    currentPeriodEnd: string | null;
  };
  usage: {
    totalGenerations: number;
    totalGenerationCredits: number;
    purchasedCredits: number;
    apiCalls: number;
    dailyLimit?: number;
    totalLimit?: number;
    lastGenerationCaseId?: number;
  };
  recentTransactions: Transaction[];
}

export interface Session {
  access_token?: string;
  phpSession?: boolean;
  user?: {
    email?: string;
    user_metadata?: {
      name?: string;
      avatar_url?: string;
      picture?: string;
    };
  };
}

export interface GenerationState {
  status: 'idle' | 'generating' | 'success' | 'saved' | 'error';
  image: string;
  message: string;
  prompt?: string;
  savedAt?: string;
}

export interface PreviewState {
  type: 'case' | 'template' | 'free';
  item: CaseItem | TemplateItem;
}

export interface Transaction {
  id: number;
  amount: number;
  type: string;
  source?: string;
  reason?: string;
  metadata?: { caseId?: number };
  caseId?: number;
  createdAt: string;
}

export interface FavoriteRow {
  caseId: number;
  createdAt: string;
}

export interface ApiProfile {
  name: string;
  api_key?: string;
  base_url?: string;
  isActive?: boolean;
}

export interface PlanItem {
  id: string;
  type: string;
  name: Record<string, string>;
  description: Record<string, string>;
  priceLabel: string;
  interval?: string;
  monthlyCredits?: number;
  credits?: number;
}

export interface AdminMetrics {
  traffic?: {
    configured?: boolean;
    error?: string;
    totals?: Record<string, number>;
    daily?: Record<string, unknown>[];
    topPages?: { label: string; value: number }[];
    channels?: { label: string; value: number }[];
    countries?: { label: string; value: number }[];
  };
  business?: {
    totals?: Record<string, number>;
    range?: Record<string, number>;
    daily?: Record<string, unknown>[];
  };
  range?: { startDate: string; endDate: string };
}

export interface HistoryItem {
  id: number;
  imageUrl: string;
  prompt: string;
  fullPrompt: string;
  model: string;
  aspect: string;
  resolution: string;
  createdAt: string;
}

export type Language = 'zh' | 'en' | 'ko';

export interface I18nStrings {
  [key: string]: string | ((...args: any[]) => string);
}
