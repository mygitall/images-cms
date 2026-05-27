import { describe, it, expect } from 'vitest';
import {
  cx, textFor, listFor, compactText, formatNumber, firstNumber,
  normalizeFavoriteRows, localizeLabel, getAuthHeaders,
  getGenerationQuotaText, transactionLabel, transactionCaseId,
  generationErrorMessage, authErrorMessage
} from '../utils';
import { copy } from '../i18n';

describe('cx', () => {
  it('joins truthy classes', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });
  it('filters falsy values', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('returns empty string for no args', () => {
    expect(cx()).toBe('');
  });
});

describe('textFor', () => {
  it('returns string as-is', () => {
    expect(textFor('hello', 'en')).toBe('hello');
  });
  it('returns localized value from object', () => {
    expect(textFor({ en: 'Hello', zh: '你好' }, 'zh')).toBe('你好');
  });
  it('falls back to en then zh', () => {
    expect(textFor({ zh: '你好' }, 'en')).toBe('你好');
  });
  it('returns empty for falsy value', () => {
    expect(textFor(null, 'en')).toBe('');
  });
});

describe('compactText', () => {
  it('returns short text as-is', () => {
    expect(compactText('short', 10)).toBe('short');
  });
  it('truncates with ellipsis', () => {
    expect(compactText('1234567890ABC', 10)).toBe('1234567890...');
  });
  it('handles empty', () => {
    expect(compactText('')).toBe('');
  });
});

describe('formatNumber', () => {
  it('formats with comma separators', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });
  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('firstNumber', () => {
  it('returns first defined number', () => {
    expect(firstNumber(undefined, null, 42)).toBe(42);
  });
  it('returns 0 for all undefined', () => {
    expect(firstNumber()).toBe(0);
  });
});

describe('normalizeFavoriteRows', () => {
  it('converts case_id to caseId', () => {
    expect(normalizeFavoriteRows([{ case_id: 1, created_at: '2024' }]))
      .toEqual([{ caseId: 1, createdAt: '2024' }]);
  });
  it('filters invalid ids', () => {
    expect(normalizeFavoriteRows([{ caseId: -1 }, { caseId: 0 }, { caseId: 'x' }]))
      .toEqual([]);
  });
  it('handles empty input', () => {
    expect(normalizeFavoriteRows()).toEqual([]);
  });
});

describe('getAuthHeaders', () => {
  it('returns empty for phpSession', () => {
    expect(getAuthHeaders({ phpSession: true })).toEqual({});
  });
  it('returns bearer for access_token', () => {
    expect(getAuthHeaders({ access_token: 'abc' }))
      .toEqual({ Authorization: 'Bearer abc' });
  });
  it('returns empty for no session', () => {
    expect(getAuthHeaders({})).toEqual({});
  });
});

describe('getGenerationQuotaText', () => {
  it('shows auth required for null profile', () => {
    expect(getGenerationQuotaText(null, 'en')).toBe(copy.en.authRequired);
  });
  it('shows free test ready for new user', () => {
    expect(getGenerationQuotaText({ freeUsed: false }, 'en')).toBe(copy.en.oneFreeGeneration);
  });
  it('shows credits required when out of credits', () => {
    expect(getGenerationQuotaText({ freeUsed: true, creditBalance: 0 }, 'en'))
      .toBe(copy.en.creditsRequired);
  });
});

describe('transactionLabel', () => {
  it('labels generation type in zh', () => {
    expect(transactionLabel({ type: 'generation' }, 'zh')).toBe('生图消耗');
  });
  it('labels purchase type in en', () => {
    expect(transactionLabel({ type: 'purchase' }, 'en')).toBe('Purchase');
  });
  it('labels refund type in ko', () => {
    expect(transactionLabel({ type: 'refund' }, 'ko')).toBe('환불');
  });
  it('falls back to type string', () => {
    expect(transactionLabel({ type: 'unknown' }, 'en')).toBe('unknown');
  });
});

describe('transactionCaseId', () => {
  it('extracts caseId directly', () => {
    expect(transactionCaseId({ caseId: 42 })).toBe(42);
  });
  it('extracts from metadata', () => {
    expect(transactionCaseId({ metadata: { caseId: 99 } })).toBe(99);
  });
  it('returns null for no caseId', () => {
    expect(transactionCaseId({})).toBeNull();
  });
});

describe('generationErrorMessage', () => {
  it('handles AUTH_REQUIRED', () => {
    expect(generationErrorMessage('AUTH_REQUIRED', 'en')).toBe(copy.en.authRequired);
  });
  it('handles CREDITS_REQUIRED', () => {
    expect(generationErrorMessage('CREDITS_REQUIRED', 'zh')).toBe(copy.zh.creditsRequired);
  });
  it('handles network errors', () => {
    const msg = generationErrorMessage('Failed to fetch', 'zh');
    expect(msg).toContain('网络');
  });
  it('returns generic fallback for unknown', () => {
    const msg = generationErrorMessage('SOMETHING_ELSE', 'en');
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe('authErrorMessage', () => {
  it('detects rate limit from message', () => {
    const msg = authErrorMessage({ message: 'too many requests' }, 'en');
    expect(msg).toBe(copy.en.authRateLimited);
  });
  it('detects provider error', () => {
    const msg = authErrorMessage({ message: 'oauth provider' }, 'zh');
    expect(msg).toBe(copy.zh.googleNotConfigured);
  });
});
