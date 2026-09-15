import { createDefaultTableImageService } from '../../image-generation/table-image-host.js';
import { sharedPhoneImageGenerationRuntime } from '../../image-generation/runtime.js';
import { getPhoneSettings, normalizeImageGenerationSettings } from '../../settings.js';

/** Built-in pages reuse ownership, translation, storage and timeout semantics, not workshop bindings. */
export function createBuiltinTheaterImageService(options = {}) {
    const getSettings = options.getPhoneSettings || getPhoneSettings;
    const imageRuntime = options.imageGenerationRuntime || sharedPhoneImageGenerationRuntime;
    return createDefaultTableImageService({
        ...options,
        imageGenerationRuntime: imageRuntime,
        isTableEnabled: async () => {
            const config = normalizeImageGenerationSettings(getSettings()?.imageGeneration);
            return config.enabled && config.theaterEnabled[options.sceneId] === true;
        },
        composePrompt: async ({ promptValues, canvas }) => {
            const description = Object.entries(promptValues).map(([field, value]) => String(value ?? '').trim() ? field + '：' + String(value).trim() : '').filter(Boolean).join('\n');
            const result = await imageRuntime.composeCharacterImagePrompt({explicitNames: [], description, scanDescription: true});
            const prompt = typeof result === 'string' ? result : result?.prompt;
            return [prompt, canvas.promptSuffix].filter(Boolean).join('\n');
        },
    });
}
