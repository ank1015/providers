import type { AgentTool } from "../../../src/index.js";
import { Type } from "@sinclair/typebox";
import { readFile } from "fs/promises";
import { resolve as resolvePath } from "path";

const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative to workspace)" }),
});

export function createReadTool(workingDirectory: string): AgentTool<typeof readSchema> {
	return {
		name: "read",
		label: "read",
		description: "Read the contents of a file. Returns the full file content.",
		parameters: readSchema,
		execute: async (_toolCallId: string, { path }: { path: string }) => {
			const absolutePath = resolvePath(workingDirectory, path);

			try {
				// Read the file
				const content = await readFile(absolutePath, "utf-8");

				return {
					content: [
						{
							type: "text",
							content,
						},
					],
					details: { path: absolutePath, size: content.length },
				};
			} catch (error: any) {
				if (error.code === "ENOENT") {
					throw new Error(`File not found: ${path}`);
				}
				throw new Error(`Failed to read file: ${error.message}`);
			}
		},
	};
}
