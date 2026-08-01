/**
 * Video design agents (operator plan §8 video path): Character Designer +
 * Component Designer. Before a short video is generated, these expand the brief
 * into on-brand character and scene/component descriptions, which are folded into
 * the video prompt. Best-effort — the caller proceeds with the base prompt if
 * design fails. Every LLM call flows through `runAi`.
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { extractJson } from '../lib/json.js';
import {
  CHARACTER_DESIGNER_SYSTEM,
  COMPONENT_DESIGNER_SYSTEM,
  characterDesignerPrompt,
  componentDesignerPrompt,
} from './prompts/index.js';

export interface VideoDesignInput {
  topic: string;
  brandContext: string;
  hints?: string;
}

export interface VideoDesign {
  characters?: string;
  components?: string;
}

/** Compose the final video prompt from a base prompt + design descriptions. Pure. */
export function composeVideoPrompt(basePrompt: string, design: VideoDesign): string {
  const parts = [basePrompt.trim()];
  if (design.characters?.trim()) parts.push(`Characters: ${design.characters.trim()}`);
  if (design.components?.trim()) parts.push(`Scene & components: ${design.components.trim()}`);
  return parts.filter(Boolean).join('\n\n');
}

async function runDesigner(
  log: Logger,
  ctx: AiRunContext,
  agent: string,
  system: string,
  prompt: string,
): Promise<string> {
  const text = await runAi(log, { ...ctx, agent }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system,
      task: 'copywriting',
      brandPrefix: ctx.brand_id ? `brand:${ctx.brand_id}` : undefined,
    });
    return { result: res.text, usage: res.usage };
  });
  const parsed = extractJson<{ summary?: string }>(text);
  return typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary : text.trim();
}

/**
 * Run Character + Component designers (parallel). Returns their summary text.
 * Never throws — on failure returns an empty design so video still generates.
 */
export async function designVideoScene(
  log: Logger,
  ctx: AiRunContext,
  input: VideoDesignInput,
): Promise<VideoDesign> {
  try {
    const [characters, components] = await Promise.all([
      runDesigner(
        log,
        ctx,
        'character-designer',
        CHARACTER_DESIGNER_SYSTEM,
        characterDesignerPrompt(input),
      ),
      runDesigner(
        log,
        ctx,
        'component-designer',
        COMPONENT_DESIGNER_SYSTEM,
        componentDesignerPrompt(input),
      ),
    ]);
    return { characters, components };
  } catch (err) {
    log.warn({ err: String(err) }, 'video design failed; proceeding with base prompt');
    return {};
  }
}
