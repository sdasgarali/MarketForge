# Plan WIP — MarketForge Adapters (real impls)

## SESSION_CONTEXT_RETRIEVAL
> DONE. Real adapters implemented under src/impl/, factory wired behind env flags
> with stub fallback. typecheck + 33 tests green, tsup build green.

## Completed
- [x] Deps added (@anthropic-ai/sdk openai @google/generative-ai groq-sdk @fal-ai/client @aws-sdk/client-s3 @aws-sdk/s3-request-presigner undici; dev vitest)
- [x] pricing.ts + http.ts helpers
- [x] LLM: Anthropic/OpenAI/Gemini/Groq/OpenRouter/Routing + models.ts
- [x] Image: fal-image.ts + nano-banana.ts
- [x] Video: fal-video.ts (Kling/Veo/Runway/Hailuo via fal queue)
- [x] Voice: elevenlabs.ts + subtitles.ts (SRT)
- [x] Publisher: ayrshare.ts + platform-map.ts + postiz.ts skeleton
- [x] Storage: s3.ts + localdisk.ts + drive-mirror.ts skeleton
- [x] factory.ts + index.ts wired (env-flag selection, stub fallback)
- [x] Tests: router, ayrshare mapping, pricing calc, localdisk roundtrip (33 pass)
- [x] typecheck + test + build green

## Blockers / Notes
- verbatimModuleSyntax + NodeNext: use .js import extensions, `import type`.
- vitest not in repo; add to adapters devDeps + test script.
