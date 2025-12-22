import type { AgentTool } from "../../../src/index.js";
import { Type } from "@sinclair/typebox";
import { appendFile, mkdir } from "fs/promises";
import { dirname, resolve as resolvePath } from "path";

const appendSchema = Type.Object({
	path: Type.String({ description: "Path to the file to append to (relative to workspace)" }),
	content: Type.String({ description: "Content to append to the file" }),
});

export function createAppendTool(workingDirectory: string): AgentTool<typeof appendSchema> {
	return {
		name: "append",
		label: "append",
		description:
			"Append content to an existing file. Creates the file if it doesn't exist. Automatically creates parent directories. Useful for building up research logs and cumulative findings.",
		parameters: appendSchema,
		execute: async (_toolCallId: string, { path, content }: { path: string; content: string }) => {
			const absolutePath = resolvePath(workingDirectory, path);
			const dir = dirname(absolutePath);

			try {
				// Create parent directories if needed
				await mkdir(dir, { recursive: true });

				// Append to the file
				await appendFile(absolutePath, content, "utf-8");

				return {
					content: [
						{
							type: "text",
							content: `Successfully appended ${content.length} characters to ${path}`,
						},
					],
					details: { path: absolutePath, appended_size: content.length },
				};
			} catch (error: any) {
				throw new Error(`Failed to append to file: ${error.message}`);
			}
		},
	};
}
