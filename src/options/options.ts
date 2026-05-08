import { loadSettings, saveSettings } from '../lib/storage';
import { initI18n, t, applyTranslations } from '../lib/i18n';
import type { Provider, StorageSchema } from '../types';

const PROVIDERS: Provider[] = ['claude', 'openai', 'gemini'];

const DEFAULT_MODELS: Record<Provider, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
};

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element not found: ${id}`);
  return el as T;
};

const updateActiveSection = (active: Provider): void => {
  document
    .querySelectorAll<HTMLDetailsElement>('.provider-section')
    .forEach((d) => {
      d.open = d.dataset['provider'] === active;
    });
};

const init = async (): Promise<void> => {
  const settings = await loadSettings();
  const status = $<HTMLParagraphElement>('status');

  await initI18n(settings.uiLanguage);
  applyTranslations();

  for (const p of PROVIDERS) {
    $<HTMLInputElement>(`${p}-key`).value = settings.providers[p].apiKey;
    $<HTMLInputElement>(`${p}-model`).value = settings.providers[p].model;
  }

  document
    .querySelectorAll<HTMLInputElement>('input[name="provider"]')
    .forEach((el) => {
      el.checked = el.value === settings.activeProvider;
      el.addEventListener('change', () => {
        if (el.checked) updateActiveSection(el.value as Provider);
      });
    });

  updateActiveSection(settings.activeProvider);

  $<HTMLSelectElement>('ui-language').value = settings.uiLanguage;
  $<HTMLSelectElement>('output-language').value = settings.outputLanguage;

  $<HTMLFormElement>('form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const checked = document.querySelector<HTMLInputElement>(
      'input[name="provider"]:checked',
    );
    const activeProvider =
      (checked?.value as Provider | undefined) ?? settings.activeProvider;

    const providers = PROVIDERS.reduce(
      (acc, p) => {
        acc[p] = {
          apiKey: $<HTMLInputElement>(`${p}-key`).value.trim(),
          model: $<HTMLInputElement>(`${p}-model`).value.trim() || DEFAULT_MODELS[p],
        };
        return acc;
      },
      {} as Record<Provider, { apiKey: string; model: string }>,
    );

    const uiLanguage = $<HTMLSelectElement>('ui-language')
      .value as StorageSchema['uiLanguage'];
    const outputLanguage = $<HTMLSelectElement>('output-language')
      .value as StorageSchema['outputLanguage'];

    await saveSettings({
      activeProvider,
      providers,
      uiLanguage,
      outputLanguage,
    });

    // Reload i18n in case UI language changed
    await initI18n(uiLanguage);
    applyTranslations();

    status.textContent = t('savedMessage');
    status.className = 'success';
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  });
};

init().catch((err: unknown) => {
  console.error('[options] init failed:', err);
});
