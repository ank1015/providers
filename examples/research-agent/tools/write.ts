import type { AgentTool } from "../../../src/index.js";
import { Type } from "@sinclair/typebox";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve as resolvePath } from "path";

const writeSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative to workspace)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

export function createWriteTool(workingDirectory: string): AgentTool<typeof writeSchema> {
	return {
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories. Supports markdown, JSON, CSV, and text files.",
		parameters: writeSchema,
		execute: async (_toolCallId: string, { path, content }: { path: string; content: string }) => {
			const absolutePath = resolvePath(workingDirectory, path);
			const dir = dirname(absolutePath);

			try {
				// Create parent directories if needed
				await mkdir(dir, { recursive: true });

				// Write the file
				await writeFile(absolutePath, content, "utf-8");

				return {
					content: [
						{
							type: "text",
							content: `Successfully wrote ${content.length} characters to ${path}`,
						},
					],
					details: { path: absolutePath, size: content.length },
				};
			} catch (error: any) {
				throw new Error(`Failed to write file: ${error.message}`);
			}
		},
	};
}
