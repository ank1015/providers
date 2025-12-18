import { Api, KnownApis, Model, Usage } from "./types";
import { MODELS } from "./models.generated";

// Extract valid model IDs for a specific API
type ModelIdsForApi<TApi extends Api> = TApi extends keyof typeof MODELS
	? keyof (typeof MODELS)[TApi]
	: never;

export function getProviders(): Api[] {
	return [...KnownApis];
}

export function getModel<TApi extends Api>(
	api: TApi,
	modelId: ModelIdsForApi<TApi>,
): Model<TApi> | undefined {
	const modelsForApi = MODELS[api as keyof typeof MODELS];
	if (!modelsForApi) return undefined;
	return (modelsForApi as any)[modelId] as Model<TApi> | undefined;
}

export function getModels<TApi extends Api>(api: TApi): Model<TApi>[] {
	const modelsForApi = MODELS[api as keyof typeof MODELS];
	if (!modelsForApi) return [];
	return Object.values(modelsForApi) as Model<TApi>[];
}

export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	usage.cost.input = (model.cost.input / 1000000) * usage.input;
	usage.cost.output = (model.cost.output / 1000000) * usage.output;
	usage.cost.cacheRead = (model.cost.cacheRead / 1000000) * usage.cacheRead;
	usage.cost.cacheWrite = (model.cost.cacheWrite / 1000000) * usage.cacheWrite;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
	return usage.cost;
}
