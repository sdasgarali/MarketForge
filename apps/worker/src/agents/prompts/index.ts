/**
 * File-based default prompts for each agent. When a DB `prompt_template` is
 * configured for the tenant/agent it overrides these (see lib/brand.ts). Prompts
 * are functions so they compose brand context + inputs deterministically.
 */

export const RESEARCH_SYSTEM =
  'You are a senior marketing research analyst. Produce concise, structured, ' +
  'source-aware research that a copywriter can act on. Output STRICT JSON only.';

export function researchPrompt(input: {
  topic: string;
  platform?: string;
  brandContext: string;
  sources?: string[];
}): string {
  return [
    `Research the topic: "${input.topic}".`,
    input.platform ? `Target platform: ${input.platform}.` : '',
    input.brandContext ? `Brand context: ${input.brandContext}.` : '',
    input.sources?.length ? `Consider these sources: ${input.sources.join(', ')}.` : '',
    '',
    'Return STRICT JSON with this shape:',
    '{',
    '  "summary": string,',
    '  "keywords": string[],',
    '  "hashtags": string[],',
    '  "hooks": string[],',
    '  "pain_points": string[],',
    '  "search_intent": string[]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

export const COPYWRITER_SYSTEM =
  'You are an expert social-media copywriter. Write platform-native, on-brand ' +
  'copy that respects character limits and the brand voice. Output STRICT JSON only.';

export function copywriterPrompt(input: {
  platform: string;
  contentType: string;
  language: string;
  brandContext: string;
  researchSummary?: string;
  keywords?: string[];
  negativePrompt?: string;
}): string {
  return [
    `Write a ${input.platform} ${input.contentType} in ${input.language}.`,
    input.brandContext ? `Brand: ${input.brandContext}.` : '',
    input.researchSummary ? `Research: ${input.researchSummary}.` : '',
    input.keywords?.length ? `Weave in keywords where natural: ${input.keywords.join(', ')}.` : '',
    input.negativePrompt ? `Avoid: ${input.negativePrompt}.` : '',
    '',
    'Return STRICT JSON with this shape:',
    '{',
    '  "title": string,',
    '  "body": string,',
    '  "caption": string,',
    '  "hashtags": string[]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

export const IMAGE_PROMPT_SYSTEM =
  'You are an expert image-prompt engineer. Turn a brief into a single vivid, ' +
  'concrete text-to-image prompt. Output ONLY the prompt text, no preamble.';

export function imagePromptCraftPrompt(input: {
  caption?: string;
  brandContext: string;
  imageStyle?: string;
  platform: string;
}): string {
  return [
    `Craft a text-to-image prompt for a ${input.platform} post.`,
    input.caption ? `Post caption: ${input.caption}.` : '',
    input.brandContext ? `Brand: ${input.brandContext}.` : '',
    input.imageStyle ? `Visual style: ${input.imageStyle}.` : '',
    'Return only the final image prompt as plain text.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const POSTER_PROMPT_SYSTEM =
  'You are an expert poster / key-visual designer. Turn a brief into a single ' +
  'bold, text-strong poster prompt: a striking graphic with a short punchy ' +
  'HEADLINE rendered legibly, strong hierarchy, high contrast, and ample negative ' +
  'space for the headline. Output ONLY the prompt text, no preamble.';

/**
 * Poster style (content_type/style = 'poster'): a bold static graphic with a
 * legible headline. Routed to a text-strong image model (modelHint 'ideogram').
 */
export function posterPromptCraftPrompt(input: {
  headline?: string;
  caption?: string;
  brandContext: string;
  imageStyle?: string;
  platform: string;
}): string {
  return [
    `Craft a POSTER / key-visual image prompt for a ${input.platform} post.`,
    'It must read as a graphic poster with a bold, legible HEADLINE (not a photo).',
    input.headline ? `Headline text to render: "${input.headline}".` : '',
    input.caption ? `Supporting message: ${input.caption}.` : '',
    input.brandContext ? `Brand: ${input.brandContext}.` : '',
    input.imageStyle ? `Visual style: ${input.imageStyle}.` : '',
    'Emphasise strong typography, high contrast, clear hierarchy, and negative space.',
    'Return only the final poster image prompt as plain text.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const REVIEWER_SYSTEM =
  'You are a meticulous content QA reviewer. Score the content for the given ' +
  'check on a 0-100 scale and explain briefly. Output STRICT JSON only.';

export function reviewerPrompt(input: {
  stage: string;
  brandContext: string;
  title?: string;
  body?: string;
  caption?: string;
  hashtags?: string[];
}): string {
  const stageGuidance: Record<string, string> = {
    grammar: 'Assess spelling, grammar, punctuation, and readability.',
    brand: 'Assess alignment with the brand voice, tone, and CTA.',
    policy: 'Assess platform policy & safety: no hate, harassment, disallowed claims, or unsafe content.',
    duplicate: 'Assess originality; penalize generic, templated, or duplicated phrasing.',
    seo: 'Assess keyword usage, hashtag quality, and discoverability.',
    marketing: 'Assess persuasiveness, hook strength, and clarity of value proposition.',
  };
  return [
    `Review this content for the "${input.stage}" check.`,
    stageGuidance[input.stage] ?? `Assess the "${input.stage}" quality dimension.`,
    input.brandContext ? `Brand: ${input.brandContext}.` : '',
    '--- CONTENT ---',
    input.title ? `Title: ${input.title}` : '',
    input.body ? `Body: ${input.body}` : '',
    input.caption ? `Caption: ${input.caption}` : '',
    input.hashtags?.length ? `Hashtags: ${input.hashtags.join(' ')}` : '',
    '--- END ---',
    '',
    'Return STRICT JSON: { "score": number (0-100), "passed": boolean, "findings": string }',
  ]
    .filter(Boolean)
    .join('\n');
}
