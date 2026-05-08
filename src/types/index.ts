export type Provider = 'claude' | 'openai' | 'gemini';

export type ProviderConfig = {
  apiKey: string;
  model: string;
};

export type SummaryMode = 'short' | 'medium' | 'detailed';

export type StorageSchema = {
  activeProvider: Provider;
  providers: {
    claude: ProviderConfig;
    openai: ProviderConfig;
    gemini: ProviderConfig;
  };
  uiLanguage: 'auto' | 'ja' | 'en';
  outputLanguage: 'ja' | 'en';
  summaryMode: SummaryMode;
};
