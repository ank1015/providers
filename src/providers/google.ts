import { GenerateContentConfig } from "@google/genai"
import { CompleteFunction, Context, Model } from "../types"



export type GoogleProviderOptions = GenerateContentConfig

export const completeGoogle:CompleteFunction<'google'> = async (
    model: Model<'google'>,
    context: Context,
    options: GoogleProviderOptions
) => {

    return {} as any

}