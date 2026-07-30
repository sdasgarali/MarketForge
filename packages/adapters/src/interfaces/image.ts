import type { GeneratedImage } from './types.js';

export interface ImageGenerateOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  count?: number;
  modelHint?: string;
  referenceImageKeys?: string[];
}

export interface ImageAdapter {
  readonly name: string;
  generateImage(opts: ImageGenerateOptions): Promise<GeneratedImage[]>;
}
