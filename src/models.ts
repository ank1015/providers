import { MODELS } from "./models.generated.js";
import type { Api, Model, Usage } from "./types.js";

const modelRegistry: Map<string, Map<string, Model<Api>>> = new Map();

// Initialize registry from MODELS on module load
for (const [provider, models] of Object.entries(MODELS)) {
	const providerModels = new Map<string, Model<Api>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, model as Model<Api>);
	}
	modelRegistry.set(provider, providerModels);
}

type ModelApi<
	TApi extends Api,
	TModelId extends keyof (typeof MODELS)[TApi],
> = (typeof MODELS)[TApi][TModelId] extends { api: infer TApi } ? (TApi extends Api ? TApi : never) : never;

export function getModel<TApi extends Api, TModelId extends keyof (typeof MODELS)[TApi]>(
	api: TApi,
	modelId: TModelId,
): Model<ModelApi<TApi, TModelId>> {
	return modelRegistry.get(api)?.get(modelId as string) as Model<ModelApi<TApi, TModelId>>;
}

export function getModels<TApi extends Api>(
	api: TApi,
): Model<ModelApi<TApi, keyof (typeof MODELS)[TApi]>>[] {
	const models = modelRegistry.get(api);
	return models ? (Array.from(models.values()) as Model<ModelApi<TApi, keyof (typeof MODELS)[TApi]>>[]) : [];
}

export function getProviders(): Api[] {
	return Array.from(modelRegistry.keys()) as Api[];
}

// export function getModels<TProvider extends KnownProvider>(
// 	provider: TProvider,
// ): Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[] {
// 	const models = modelRegistry.get(provider);
// 	return models ? (Array.from(models.values()) as Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[]) : [];
// }

export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	usage.cost.input = (model.cost.input / 1000000) * usage.input;
	usage.cost.output = (model.cost.output / 1000000) * usage.output;
	usage.cost.cacheRead = (model.cost.cacheRead / 1000000) * usage.cacheRead;
	usage.cost.cacheWrite = (model.cost.cacheWrite / 1000000) * usage.cacheWrite;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
	return usage.cost;
}
