/**
 * Build an LLM adapter for an org from ITS saved provider keys (integrations),
 * overlaid on the deployment env. Used by API-side AI features (e.g. brand
 * knowledge refresh, supervisor diagnosis). Mirrors the worker's per-org
 * adapter resolution.
 */
import { type AdapterEnv, type LlmAdapter, createAdapters } from '@marketforge/adapters';
import { env } from '@marketforge/config';
import { integrationsService } from '../modules/integrations/service.js';

const TEXT_PROVIDERS: Array<[provider: string, envKey: keyof AdapterEnv]> = [
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openai', 'OPENAI_API_KEY'],
  ['gemini', 'GEMINI_API_KEY'],
  ['groq', 'GROQ_API_KEY'],
  ['openrouter', 'OPENROUTER_API_KEY'],
  ['nvidia', 'NVIDIA_API_KEY'],
];

/** True when the org has at least one text-LLM provider key configured. */
export async function orgHasLlm(orgId: string): Promise<boolean> {
  for (const [provider] of TEXT_PROVIDERS) {
    const vals = await integrationsService.resolve(orgId, provider);
    if (vals?.apiKey) return true;
  }
  return false;
}

export async function getOrgLlm(orgId: string): Promise<LlmAdapter> {
  const overlay: Partial<AdapterEnv> = {};
  for (const [provider, envKey] of TEXT_PROVIDERS) {
    const vals = await integrationsService.resolve(orgId, provider);
    if (vals?.apiKey) (overlay as Record<string, unknown>)[envKey] = vals.apiKey;
  }
  const merged = { ...(env as unknown as AdapterEnv), ...overlay };
  return createAdapters(merged).llm;
}
