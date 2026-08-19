import { describe, expect, it } from 'vitest';
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_SERVICE_PROFILES,
  getTranslationLanguageOptions,
  getTranslationServiceId,
  mapTranslationLanguage
} from '../plugin/src/core/translation-languages.js';

describe('Translation language profiles', () => {
  it('lists common languages without duplicate codes', () => {
    const codes = TRANSLATION_LANGUAGES.map((language) => language.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining([
      'auto', 'zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'it',
      'ru', 'ar', 'th', 'vi', 'id', 'ms', 'tr', 'nl', 'pl', 'uk', 'hi'
    ]));
  });

  it('enumerates common translation services and detects provider names', () => {
    expect(Object.keys(TRANSLATION_SERVICE_PROFILES)).toEqual(expect.arrayContaining([
      'microsoft', 'baidu', 'alibaba', 'google', 'deepl', 'youdao', 'tencent', 'mymemory'
    ]));
    expect(getTranslationServiceId({ id: 'deepL-translation', label: 'DeepL' })).toBe('deepl');
    expect(getTranslationServiceId({ id: 'aliyun-translation', label: '阿里云翻译' })).toBe('alibaba');
  });

  it('maps the shared language ids to service-specific codes', () => {
    expect(mapTranslationLanguage(TRANSLATION_SERVICE_PROFILES.microsoft, 'target', 'zh'))
      .toBe('zh-Hans');
    expect(mapTranslationLanguage(TRANSLATION_SERVICE_PROFILES.baidu, 'target', 'ja'))
      .toBe('jp');
    expect(mapTranslationLanguage(TRANSLATION_SERVICE_PROFILES.google, 'target', 'zh'))
      .toBe('zh-CN');
    expect(mapTranslationLanguage(TRANSLATION_SERVICE_PROFILES.deepl, 'target', 'zh'))
      .toBe('ZH');
    expect(mapTranslationLanguage(TRANSLATION_SERVICE_PROFILES.youdao, 'target', 'zh'))
      .toBe('zh-CHS');
  });

  it('does not expose auto detection as a target language', () => {
    const targetLanguages = getTranslationLanguageOptions(
      TRANSLATION_SERVICE_PROFILES.google,
      'target'
    );

    expect(targetLanguages.some((language) => language.code === 'auto')).toBe(false);
    expect(targetLanguages.some((language) => language.code === 'ko')).toBe(true);
  });

  it('does not expose auto detection to an unknown provider target', () => {
    const targetLanguages = getTranslationLanguageOptions(null, 'target');

    expect(targetLanguages.some((language) => language.code === 'auto')).toBe(false);
    expect(targetLanguages.some((language) => language.code === 'vi')).toBe(true);
  });
});
