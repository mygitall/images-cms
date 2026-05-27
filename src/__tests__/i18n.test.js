import { describe, it, expect } from 'vitest';
import { copy } from '../i18n';

const REQUIRED_KEYS = [
  'loading', 'brand', 'navCases', 'navSkill', 'navTemplates', 'navCommunity',
  'eyebrow', 'title', 'subtitle', 'explore', 'githubProject',
  'cases', 'categories', 'templates', 'search',
  'category', 'style', 'scene', 'all', 'matching', 'openGithub',
  'copied', 'copyPrompt', 'favorite', 'favorited', 'unfavorite',
  'myFavorites', 'noFavorites', 'signInToFavorite',
  'closePreview', 'viewDetails', 'generateTest', 'generateImage', 'generating',
  'editablePrompt', 'generatedResult', 'originalImage', 'resetPrompt',
  'creditsRequired', 'generationFailed', 'promptRequired',
  'authRequired', 'signIn', 'signOut',
  'account', 'accountSettings', 'displayName', 'saveProfile',
  'totalGenerations', 'totalGenerationCredits',
  'adminPanel', 'history', 'loadFailed', 'retry', 'delete',
  'freeCreation', 'enterPrompt',
  'membershipCenter', 'superAdmin', 'credits',
  'buyCredits', 'subscribe', 'currentPlan', 'noPlan',
  'billingTitle', 'balanceTitle', 'transactionHistory', 'noTransactions',
  'adminAdjust', 'creditAmount', 'reason', 'applyAdjustment',
  'freeReady', 'freeUsedShort', 'signInToGenerate',
  'refresh', 'users', 'role', 'creditBalance', 'freeGeneration',
  'spentCredits', 'purchased', 'createdAt',
  'source', 'openOnGithub',
  'openCaseAria', 'modelsLabel', 'uploadBtn', 'viewFullImage',
  'closeDialog', 'referenceModeTitle', 'noReferenceImage',
  'fileTooLarge', 'fileReadFailed', 'apiConfigLabel', 'newApiLabel',
  'editPrefix', 'nameLabel', 'save', 'cancel',
  'showingNOfM', 'loadMoreBtn', 'noGenerationHistory',
  'siteAnnouncement', 'gotIt',
];

describe('i18n — all languages', () => {
  const languages = ['en', 'zh', 'ko'];

  for (const lang of languages) {
    describe(lang, () => {
      const t = copy[lang];

      it('exists', () => {
        expect(t).toBeDefined();
      });

      for (const key of REQUIRED_KEYS) {
        it(`has key "${key}"`, () => {
          expect(t[key]).toBeDefined();
          if (typeof t[key] === 'function') {
            // function keys should be callable
            expect(typeof t[key]).toBe('function');
          } else {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});

describe('i18n — function keys', () => {
  it('showingNOfM returns correct format', () => {
    expect(copy.zh.showingNOfM(20, 100)).toBe('已显示 20 / 100 个案例');
    expect(copy.en.showingNOfM(20, 100)).toBe('Showing 20 of 100 cases');
  });

  it('historyTotal returns correct format', () => {
    expect(copy.zh.historyTotal(5)).toBe('共 5 张');
    expect(copy.en.historyTotal(5)).toBe('5 images');
  });

  it('generatingTimer returns correct format', () => {
    expect(copy.zh.generatingTimer(10)).toBe('生成中... 10s');
    expect(copy.en.generatingTimer(10)).toBe('Generating... 10s');
  });

  it('openCaseAria returns correct format', () => {
    expect(copy.en.openCaseAria(1, 'Test')).toBe('Open case 1: Test');
  });
});
