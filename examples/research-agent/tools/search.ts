import type { AgentTool } from "../../../src";
import { Type } from "@sinclair/typebox";
import { createParallelClient } from "../utils/web.js";


const searchSchema = Type.Object({
	objective: Type.String({ description: "A small one line description of the objective of the search" }),
	queries: Type.Array(Type.String({ description: "An array of 2-3 words search queries" })),
});

export const searchTool: AgentTool<typeof searchSchema> = {
    name: "search",
    label: "search",
    description: "Returns 5 web search results based on objective and search queries. Each search contains the url and excerpts from the url based on the objective.",
    parameters: searchSchema,
    execute: async (
        _toolCallId: string,
        { objective, queries }: { objective: string; queries: string[]; },
        signal?: AbortSignal
    ) => {
        const client = createParallelClient();

        const search = await client.beta.search({
            objective,
            search_queries: queries,
            max_results: 5,
            mode: 'agentic',
            excerpts: {
                max_chars_per_result: 5000
            }
        });

        // Format search results into a readable string
        const formattedResults: string[] = [];

        formattedResults.push(`Search Results for: ${objective}`);
        formattedResults.push(`Queries: ${queries.join(', ')}`);
        formattedResults.push(`\nFound ${search.results.length} results:\n`);
        formattedResults.push('='.repeat(80));

        for (let i = 0; i < search.results.length; i++) {
            const result = search.results[i];
            formattedResults.push(`\n${i + 1}. ${result.title}`);
            formattedResults.push(`   URL: ${result.url}`);

            if (result.publish_date) {
                formattedResults.push(`   Published: ${result.publish_date}`);
            }

            if (result.excerpts && result.excerpts.length > 0) {
                formattedResults.push(`   Excerpts:`);
                for (const excerpt of result.excerpts) {
                    // Truncate very long excerpts and clean up whitespace
                    const cleaned = excerpt.trim().replace(/\s+/g, ' ');
                    const truncated = cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
                    formattedResults.push(`   - ${truncated}`);
                }
            }

            formattedResults.push(''); // Empty line between results
        }

        const content = formattedResults.join('\n');

        return {
            content: [{ type: "text", content }],
            details: { search_id: search.search_id, result_count: search.results.length }
        };
    }
}