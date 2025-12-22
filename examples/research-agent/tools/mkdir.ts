import type { AgentTool } from "../../../src/index.js";
import { Type } from "@sinclair/typebox";
import { mkdir } from "fs/promises";
import { resolve as resolvePath } from "path";

const mkdirSchema = Type.Object({
	path: Type.String({ description: "Path of the directory to create (relative to workspace)" }),
});

export function createMkdirTool(workingDirectory: string): AgentTool<typeof mkdirSchema> {
	return {
		name: "mkdir",
		label: "mkdir",
		description:
			"Create a new directory. Automatically creates parent directories if needed. Use this to organize research into topics and subtopics.",
		parameters: mkdirSchema,
		execute: async (_toolCallId: string, { path }: { path: string }) => {
			const absolutePath = resolvePath(workingDirectory, path);

			try {
				// Create directory with recursive option
				await mkdir(absolutePath, { recursive: true });

				return {
					content: [
						{
							type: "text",
							content: `Successfully created directory: ${path}`,
						},
					],
					details: { path: absolutePath },
				};
			} catch (error: any) {
				throw new Error(`Failed to create directory: ${error.message}`);
			}
		},
	};
}
