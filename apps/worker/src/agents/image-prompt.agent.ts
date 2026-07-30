/**
 * Image-prompt agent — turns a caption + brand style into a single vivid
 * text-to-image prompt. Routing hint task='copywriting' (cheap creative text).
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import {
  IMAGE_PROMPT_SYSTEM,
  imagePromptCraftPrompt,
  POSTER_PROMPT_SYSTEM,
  posterPromptCraftPrompt,
} from './prompts/index.js';

export interface ImagePromptInput {
  caption?: string;
  brandContext: string;
  imageStyle?: string;
  platform: string;
  brandPrefix?: string;
  /** Poster style: craft a bold text-strong headline graphic (routes to ideogram). */
  poster?: boolean;
  /** Optional explicit headline text for a poster. */
  headline?: string;
}

/**
 * Model hint the generate-image processor should use for a given prompt input.
 * Posters need a text-strong renderer → 'ideogram' (ADR-007); otherwise the
 * image router picks the default workhorse.
 */
export function imageModelHint(input: Pick<ImagePromptInput, 'poster'>): string | undefined {
  return input.poster ? 'ideogram' : undefined;
}

/** Returns a plain-text image generation prompt (poster-aware). */
export async function runImagePromptAgent(
  log: Logger,
  ctx: AiRunContext,
  input: ImagePromptInput,
): Promise<string> {
  const prompt = input.poster
    ? posterPromptCraftPrompt({
        headline: input.headline,
        caption: input.caption,
        brandContext: input.brandContext,
        imageStyle: input.imageStyle,
        platform: input.platform,
      })
    : imagePromptCraftPrompt({
        caption: input.caption,
        brandContext: input.brandContext,
        imageStyle: input.imageStyle,
        platform: input.platform,
      });

  const text = await runAi(log, { ...ctx, agent: 'image_prompt_engineer' }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system: input.poster ? POSTER_PROMPT_SYSTEM : IMAGE_PROMPT_SYSTEM,
      task: 'copywriting',
      brandPrefix: input.brandPrefix,
    });
    return { result: res.text, usage: res.usage };
  });

  return text.replace(/```/g, '').trim();
}
