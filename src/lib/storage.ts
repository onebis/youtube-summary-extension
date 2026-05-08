import type { StorageSchema } from '../types';

const DEFAULTS: StorageSchema = {
  activeProvider: 'claude',
  providers: {
    claude: { apiKey: '', model: 'claude-sonnet-4-6' },
    openai: { apiKey: '', model: 'gpt-4o' },
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
  },
  uiLanguage: 'auto',
  outputLanguage: 'ja',
  summaryMode: 'short',
};

export const loadSettings = async (): Promise<StorageSchema> => {
  const raw = (await chrome.storage.local.get(null)) as Partial<StorageSchema>;
  return {
    ...DEFAULTS,
    ...raw,
    providers: {
      ...DEFAULTS.providers,
      ...(raw.providers ?? {}),
    },
  };
};

export const saveSettings = async (patch: Partial<StorageSchema>): Promise<void> => {
  await chrome.storage.local.set(patch);
};
