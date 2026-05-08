type LocaleStrings = Record<string, { message: string }>;
type UiLang = 'auto' | 'ja' | 'en';

let cache: LocaleStrings | null = null;

const loadCustomLocale = async (lang: 'ja' | 'en'): Promise<LocaleStrings> => {
  const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
  const res = await fetch(url);
  return (await res.json()) as LocaleStrings;
};

export const initI18n = async (lang: UiLang): Promise<void> => {
  if (lang === 'auto') {
    cache = null;
    return;
  }
  cache = await loadCustomLocale(lang);
};

const interpolate = (msg: string, params?: Record<string, string>): string => {
  if (!params) return msg;
  let out = msg;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
};

export const t = (key: string, params?: Record<string, string>): string => {
  let msg: string;
  if (cache) {
    msg = cache[key]?.message ?? key;
  } else {
    msg = chrome.i18n.getMessage(key) || key;
  }
  return interpolate(msg, params);
};

export const applyTranslations = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset['i18n'];
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset['i18nAria'];
    if (key) el.setAttribute('aria-label', t(key));
  });
};
