import { loadSettings, saveSettings } from '../lib/storage';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element not found: ${id}`);
  return el as T;
};

const init = async (): Promise<void> => {
  const settings = await loadSettings();
  const keyInput = $<HTMLInputElement>('claude-key');
  const modelInput = $<HTMLInputElement>('claude-model');
  const status = $<HTMLParagraphElement>('status');

  keyInput.value = settings.providers.claude.apiKey;
  modelInput.value = settings.providers.claude.model;

  $<HTMLFormElement>('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = keyInput.value.trim();
    const model = modelInput.value.trim() || 'claude-sonnet-4-6';

    await saveSettings({
      providers: {
        ...settings.providers,
        claude: { apiKey, model },
      },
    });

    status.textContent = '保存しました';
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
