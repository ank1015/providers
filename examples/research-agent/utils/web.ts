import Parallel from "parallel-web";
import Firecrawl from '@mendable/firecrawl-js';

export function createParallelClient() {
    const apiKey = process.env.PARALLEL_API_KEY;
    if(!apiKey){
        throw new Error(
            "Parallel API key is required. Set PARALLEL_API_KEY environment variable or pass it as an argument.",
        );
    }
    const client = new Parallel({ apiKey });
    return client;
}

export function createFirecrawlClient() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if(!apiKey){
        throw new Error(
            "Firecrawl API key is required. Set FIRECRAWL_API_KEY environment variable or pass it as an argument.",
        );
    }
    const firecrawl = new Firecrawl({ apiKey });
    return firecrawl;
} 