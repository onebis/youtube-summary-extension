import { loadSettings, saveSettings } from '../lib/storage';
import { initI18n, t, applyTranslations } from '../lib/i18n';
import type { Provider, StorageSchema } from '../types';

const PROVIDERS: Provider[] = ['claude', 'openai', 'gemini'];

type ModelOption = { value: string; recommended?: boolean };

const MODEL_OPTIONS: Record<Provider, ModelOption[]> = {
  claude: [
    { value: 'claude-sonnet-4-6', recommended: true },
    { value: 'claude-opus-4-7' },
    { value: 'claude-haiku-4-5-20251001' },
  ],
  openai: [
    { value: 'gpt-4o', recommended: true },
    { value: 'gpt-4o-mini' },
    { value: 'gpt-4-turbo' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', recommended: true },
    { value: 'gemini-2.5-pro' },
    { value: 'gemini-2.0-flash' },
  ],
};

const DEFAULT_MODELS: Record<Provider, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
};

const populateModelOptions = (
  provider: Provider,
  selectedValue: string,
): void => {
  const select = document.getElementById(`${provider}-model`) as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = '';
  const recommendedSuffix = t('recommendedSuffix');
  const options = MODEL_OPTIONS[provider];

  // Preserve custom (non-listed) saved value as a custom option at top
  if (selectedValue && !options.some((m) => m.value === selectedValue)) {
    const custom = document.createElement('option');
    custom.value = selectedValue;
    custom.textContent = `${selectedValue} (custom)`;
    select.appendChild(custom);
  }

  for (const m of options) {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.recommended ? `${m.value}${recommendedSuffix}` : m.value;
    select.appendChild(opt);
  }

  select.value = selectedValue || DEFAULT_MODELS[provider];
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
    populateModelOptions(p, settings.providers[p].model);
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

  document
    .querySelectorAll<HTMLInputElement>('input[name="ui-language"]')
    .forEach((el) => {
      el.checked = el.value === settings.uiLanguage;
    });
  document
    .querySelectorAll<HTMLInputElement>('input[name="output-language"]')
    .forEach((el) => {
      el.checked = el.value === settings.outputLanguage;
    });

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
          model:
            $<HTMLSelectElement>(`${p}-model`).value.trim() || DEFAULT_MODELS[p],
        };
        return acc;
      },
      {} as Record<Provider, { apiKey: string; model: string }>,
    );

    const uiLanguage =
      (document.querySelector<HTMLInputElement>('input[name="ui-language"]:checked')
        ?.value as StorageSchema['uiLanguage'] | undefined) ?? settings.uiLanguage;
    const outputLanguage =
      (document.querySelector<HTMLInputElement>(
        'input[name="output-language"]:checked',
      )?.value as StorageSchema['outputLanguage'] | undefined) ?? settings.outputLanguage;

    await saveSettings({
      activeProvider,
      providers,
      uiLanguage,
      outputLanguage,
    });

    // Reload i18n in case UI language changed
    await initI18n(uiLanguage);
    applyTranslations();
    // Repopulate model options so "(推奨)" suffix follows the new UI language
    for (const p of PROVIDERS) {
      populateModelOptions(p, providers[p].model);
    }

    status.textContent = t('savedMessage');
    status.classList.add('success');
    status.hidden = false;
    void status.offsetWidth;
    status.classList.add('toast-show');
    setTimeout(() => {
      status.classList.remove('toast-show');
      setTimeout(() => {
        status.hidden = true;
        status.classList.remove('success');
        status.textContent = '';
      }, 220);
    }, 2500);
  });
};

init().catch((err: unknown) => {
  console.error('[options] init failed:', err);
});
