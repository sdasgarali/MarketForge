/**
 * Registry of provider integrations that can be configured from the website.
 * Each provider stores a set of fields (encrypted together as one JSON secret in
 * `api_credentials`, kind=`provider:<id>`). `secret: true` fields are masked in
 * the API response; non-secret fields (region, folder id) may be echoed back.
 */
export type IntegrationCategory =
  | 'ai_text'
  | 'ai_image'
  | 'ai_video'
  | 'ai_voice'
  | 'publishing'
  | 'storage';

export interface IntegrationField {
  key: string;
  label: string;
  secret: boolean;
  optional?: boolean;
  placeholder?: string;
  multiline?: boolean;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  fields: IntegrationField[];
}

const apiKeyField = (placeholder: string): IntegrationField => ({
  key: 'apiKey',
  label: 'API key',
  secret: true,
  placeholder,
});

export const INTEGRATIONS: IntegrationProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    category: 'ai_text',
    description: 'Copywriting + QA/review models (Sonnet, Opus).',
    fields: [apiKeyField('sk-ant-…')],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'ai_text',
    description: 'GPT models (optional routing target).',
    fields: [apiKeyField('sk-…')],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'ai_text',
    description: 'Gemini models (cheap bulk tasks).',
    fields: [apiKeyField('AIza…')],
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'ai_text',
    description: 'Fast, low-cost inference for bulk tags.',
    fields: [apiKeyField('gsk_…')],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'ai_text',
    description: 'Multi-model gateway (fallback routing).',
    fields: [apiKeyField('sk-or-…')],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM (free)',
    category: 'ai_text',
    description: 'build.nvidia.com — free API for testing (Llama, Nemotron, DeepSeek).',
    fields: [apiKeyField('nvapi-…')],
  },
  {
    id: 'fal',
    name: 'fal.ai',
    category: 'ai_image',
    description: 'Image + short-form video generation (Ideogram, Flux, Kling).',
    fields: [apiKeyField('fal_…')],
  },
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    category: 'ai_video',
    description: 'Character video generation ("see-dance").',
    fields: [apiKeyField('…')],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'ai_voice',
    description: 'Voice + subtitles.',
    fields: [apiKeyField('…')],
  },
  {
    id: 'ayrshare',
    name: 'Ayrshare',
    category: 'publishing',
    description: 'Social publishing aggregator (X, Instagram, …).',
    fields: [apiKeyField('…')],
  },
  {
    id: 's3',
    name: 'S3-compatible storage',
    category: 'storage',
    description: 'Primary asset store (system of record).',
    fields: [
      { key: 'bucket', label: 'Bucket', secret: false, placeholder: 'marketforge-assets' },
      { key: 'region', label: 'Region', secret: false, optional: true, placeholder: 'us-east-1' },
      { key: 'endpoint', label: 'Endpoint', secret: false, optional: true, placeholder: 'https://…' },
      { key: 'accessKeyId', label: 'Access key ID', secret: true },
      { key: 'secretAccessKey', label: 'Secret access key', secret: true },
    ],
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'storage',
    description: 'Per-brand asset mirror (service account).',
    fields: [
      { key: 'clientEmail', label: 'Service account email', secret: false, placeholder: '…@….iam.gserviceaccount.com' },
      { key: 'privateKey', label: 'Private key', secret: true, multiline: true, placeholder: '-----BEGIN PRIVATE KEY-----' },
      { key: 'rootFolderId', label: 'Root folder id', secret: false, optional: true },
    ],
  },
];

export function getProvider(id: string): IntegrationProvider | undefined {
  return INTEGRATIONS.find((p) => p.id === id);
}

export const CREDENTIAL_KIND_PREFIX = 'provider:';
