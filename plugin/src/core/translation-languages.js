export const TRANSLATION_LANGUAGES = Object.freeze([
  { code: 'auto', label: '自动检测' },
  { code: 'zh', label: '中文' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'es', label: '西班牙语' },
  { code: 'pt', label: '葡萄牙语' },
  { code: 'it', label: '意大利语' },
  { code: 'ru', label: '俄语' },
  { code: 'ar', label: '阿拉伯语' },
  { code: 'th', label: '泰语' },
  { code: 'vi', label: '越南语' },
  { code: 'id', label: '印度尼西亚语' },
  { code: 'ms', label: '马来语' },
  { code: 'tr', label: '土耳其语' },
  { code: 'nl', label: '荷兰语' },
  { code: 'pl', label: '波兰语' },
  { code: 'uk', label: '乌克兰语' },
  { code: 'hi', label: '印地语' },
  { code: 'cs', label: '捷克语' },
  { code: 'sv', label: '瑞典语' }
]);

function createProfile(id, aliases, targetCodes) {
  const sourceCodes = { auto: 'auto', ...targetCodes };
  return Object.freeze({
    id,
    aliases: Object.freeze(aliases),
    sourceCodes: Object.freeze(sourceCodes),
    targetCodes: Object.freeze(targetCodes),
    sourceLanguages: Object.freeze(Object.keys(sourceCodes)),
    targetLanguages: Object.freeze(Object.keys(targetCodes))
  });
}

const commonCodes = {
  zh: 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt',
  it: 'it',
  ru: 'ru',
  ar: 'ar',
  th: 'th',
  vi: 'vi',
  id: 'id',
  ms: 'ms',
  tr: 'tr',
  nl: 'nl',
  pl: 'pl',
  uk: 'uk',
  hi: 'hi',
  cs: 'cs',
  sv: 'sv'
};

export const TRANSLATION_SERVICE_PROFILES = Object.freeze({
  microsoft: createProfile('microsoft', ['microsoft', '微软'], {
    ...commonCodes,
    zh: 'zh-Hans'
  }),
  baidu: createProfile('baidu', ['baidu', '百度'], {
    ...commonCodes,
    ja: 'jp',
    ko: 'kor',
    fr: 'fra',
    es: 'spa',
    ar: 'ara',
    vi: 'vie',
    ms: 'may',
    sv: 'swe'
  }),
  alibaba: createProfile('alibaba', ['alibaba', 'aliyun', '阿里', '阿里云'], {
    zh: 'zh',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
    es: 'es',
    pt: 'pt',
    it: 'it',
    ru: 'ru',
    ar: 'ar',
    th: 'th',
    vi: 'vi',
    id: 'id',
    ms: 'ms',
    tr: 'tr',
    nl: 'nl',
    pl: 'pl',
    uk: 'uk'
  }),
  google: createProfile('google', ['google', '谷歌'], {
    ...commonCodes,
    zh: 'zh-CN'
  }),
  deepl: createProfile('deepl', ['deepl'], {
    zh: 'ZH',
    en: 'EN',
    ja: 'JA',
    ko: 'KO',
    fr: 'FR',
    de: 'DE',
    es: 'ES',
    pt: 'PT-PT',
    it: 'IT',
    ru: 'RU',
    ar: 'AR',
    id: 'ID',
    tr: 'TR',
    nl: 'NL',
    pl: 'PL',
    uk: 'UK'
  }),
  youdao: createProfile('youdao', ['youdao', '有道'], {
    zh: 'zh-CHS',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    de: 'de',
    es: 'es',
    pt: 'pt',
    it: 'it',
    ru: 'ru',
    vi: 'vi',
    ar: 'ar',
    nl: 'nl'
  }),
  tencent: createProfile('tencent', ['tencent', '腾讯'], {
    ...commonCodes
  }),
  mymemory: createProfile('mymemory', ['mymemory'], {
    ...commonCodes,
    zh: 'zh-CN',
    pt: 'pt-PT'
  })
});

function providerMetadata(provider) {
  const raw = provider?.raw || provider || {};
  if (typeof raw === 'string') return raw;
  return [
    provider?.serviceId,
    raw.serviceId,
    raw.service,
    raw.id,
    raw.providerId,
    raw.code,
    raw.name,
    raw.label,
    raw.title,
    raw.displayName
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getTranslationServiceId(provider) {
  const metadata = providerMetadata(provider);
  const explicitId = provider?.serviceId || provider?.raw?.serviceId || provider?.raw?.service;
  if (explicitId && TRANSLATION_SERVICE_PROFILES[explicitId]) return explicitId;

  return Object.values(TRANSLATION_SERVICE_PROFILES)
    .find((profile) => profile.aliases.some((alias) => metadata.includes(alias.toLowerCase())))?.id || null;
}

export function getTranslationServiceProfile(provider) {
  const serviceId = getTranslationServiceId(provider);
  return serviceId ? TRANSLATION_SERVICE_PROFILES[serviceId] : null;
}

export function mapTranslationLanguage(profile, direction, language) {
  const codes = direction === 'source' ? profile?.sourceCodes : profile?.targetCodes;
  return codes?.[language] || language;
}

export function getTranslationLanguageOptions(profile, direction) {
  const isSource = direction === 'source';
  const supported = direction === 'source'
    ? profile?.sourceLanguages
    : profile?.targetLanguages;
  return TRANSLATION_LANGUAGES.filter((language) => (
    (isSource || language.code !== 'auto') &&
    (!supported || supported.includes(language.code))
  ));
}
