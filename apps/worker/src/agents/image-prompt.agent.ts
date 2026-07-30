/**
 * Image-prompt agent — turns a caption + brand style into a single vivid
 * text-to-image prompt. Routing hint task='copywriting' (cheap creative text).
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { IMAGE_PROMPT_SYSTEM, imagePromptCraftPrompt } from './prompts/index.js';

export interface ImagePromptInput {
  caption?: string;
  brandContext: string;
  imageStyle?: string;
  platform: string;
  brandPrefix?: string;
}

/** Returns a plain-text image generation prompt. */
export async function runImagePromptAgent(
  log: Logger,
  ctx: AiRunContext,
  input: ImagePromptInput,
): Promise<string> {
  const prompt = imagePromptCraftPrompt({
    caption: input.caption,
    brandContext: input.brandContext,
    imageStyle: input.imageStyle,
    platform: input.platform,
  });

  const text = await runAi(log, { ...ctx, agent: 'image_prompt_engineer' }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system: IMAGE_PROMPT_SYSTEM,
      task: 'copywriting',
      brandPrefix: input.brandPrefix,
    });
    return { result: res.text, usage: res.usage };
  });

  return text.replace(/```/g, '').trim();
}
