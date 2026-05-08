import type { Provider } from '../../types';
import type { LLMClient } from './index';
import { ClaudeClient } from './claude';
import { OpenAIClient } from './openai';
import { GeminiClient } from './gemini';

export const getClient = (provider: Provider): LLMClient => {
  switch (provider) {
    case 'claude':
      return new ClaudeClient();
    case 'openai':
      return new OpenAIClient();
    case 'gemini':
      return new GeminiClient();
  }
};
