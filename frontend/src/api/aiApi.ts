
import { request } from './baseClient';

export const aiApi = {
    getAiModels: (): Promise<string[]> => request('/ai/models'),
    askAi: (prompt: string, model?: string): Promise<{ answer: string }> =>
        request('/ai/query', {
            method: 'POST',
            body: JSON.stringify({ prompt, model })
        }),
};
