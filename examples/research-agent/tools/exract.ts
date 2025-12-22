import type { AgentTool } from "../../../src";
import { Type } from "@sinclair/typebox";
import { createFirecrawlClient, createParallelClient } from "../utils/web.js";


const extractSchema = Type.Object({
	url: Type.String({ description: "The url to get data from." }),
	objective: Type.Optional(Type.String({ description: "A small one line description of the objective of the search." })),
});

export const extractTool: AgentTool<typeof extractSchema> = {
    name: "extract",
    label: "extract",
    description: "Get the full content or some specific information from a url",
    parameters: extractSchema,
    execute: async (
        _toolCallId: string,
        { url, objective }: { url: string; objective?: string },
        signal?: AbortSignal
    ) => {
        if (objective && objective !== "") {
            // Use Parallel API for targeted extraction
            const client = createParallelClient();
            const extract = await client.beta.extract({
                urls: [url],
                objective,
                excerpts: true,
                full_content: false,
            });

            // Format the response
            const formattedResults: string[] = [];

            formattedResults.push(`Extracted Information for: ${objective}`);
            formattedResults.push(`URL: ${url}\n`);
            formattedResults.push("=".repeat(80));

            // Handle results
            if (extract.results && extract.results.length > 0) {
                for (const result of extract.results) {
                    formattedResults.push(`\nTitle: ${result.title || "N/A"}`);
                    formattedResults.push(`URL: ${result.url}\n`);

                    if (result.excerpts && result.excerpts.length > 0) {
                        formattedResults.push("Relevant Excerpts:");
                        for (const excerpt of result.excerpts) {
                            const cleaned = excerpt.trim().replace(/\s+/g, " ");
                            formattedResults.push(`\n${cleaned}`);
                        }
                    }

                    if (result.full_content) {
                        formattedResults.push("\nFull Content:");
                        formattedResults.push(result.full_content);
                    }
                }
            }

            // Handle errors
            if (extract.errors && extract.errors.length > 0) {
                formattedResults.push("\n" + "=".repeat(80));
                formattedResults.push("\nErrors encountered:");
                for (const error of extract.errors) {
                    formattedResults.push(`\n- ${error.url}: ${error.error_type}`);
                    if (error.http_status_code) {
                        formattedResults.push(`  Status Code: ${error.http_status_code}`);
                    }
                    if (error.content) {
                        formattedResults.push(`  Details: ${error.content}`);
                    }
                }
            }

            const content = formattedResults.join("\n");

            return {
                content: [{ type: "text", content }],
                details: {
                    extract_id: extract.extract_id,
                    result_count: extract.results?.length || 0,
                    error_count: extract.errors?.length || 0,
                },
            };
        } else {
            // Use Firecrawl for full content extraction
            const client = createFirecrawlClient();
            const doc = await client.scrape(url, { formats: ["markdown"] });

            // Form the response
            const formattedResults: string[] = [];

            formattedResults.push(`Content extracted from: ${url}\n`);
            formattedResults.push("=".repeat(80));

            if (doc.metadata?.title) {
                formattedResults.push(`\nTitle: ${doc.metadata.title}`);
            }

            if (doc.metadata?.description) {
                formattedResults.push(`Description: ${doc.metadata.description}`);
            }

            if (doc.metadata?.keywords) {
                formattedResults.push(`Keywords: ${doc.metadata.keywords}`);
            }

            formattedResults.push("\n" + "=".repeat(80));
            formattedResults.push("\nMarkdown Content:\n");

            if (doc.markdown) {
                formattedResults.push(doc.markdown);
            } else {
                formattedResults.push("(No markdown content available)");
            }

            const content = formattedResults.join("\n");

            return {
                content: [{ type: "text", content }],
                details: {
                    metadata: doc.metadata,
                    status_code: doc.metadata?.statusCode,
                },
            };
        }
    },
};