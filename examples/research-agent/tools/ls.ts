import type { AgentTool } from "../../../src/index.js";
import { Type } from "@sinclair/typebox";
import { readdir, stat } from "fs/promises";
import { resolve as resolvePath, join } from "path";

const lsSchema = Type.Object({
	path: Type.Optional(Type.String({ description: "Directory to list (default: workspace root)" })),
});

export function createLsTool(workingDirectory: string): AgentTool<typeof lsSchema> {
	return {
		name: "ls",
		label: "ls",
		description:
			"List files and directories. Shows entries with '/' suffix for directories. Helps navigate the workspace.",
		parameters: lsSchema,
		execute: async (_toolCallId: string, { path }: { path?: string }) => {
			const targetPath = path ? resolvePath(workingDirectory, path) : workingDirectory;

			try {
				// Read directory entries
				const entries = await readdir(targetPath);

				// Sort alphabetically
				entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

				// Format entries with directory indicators
				const formattedEntries: string[] = [];

				for (const entry of entries) {
					const fullPath = join(targetPath, entry);
					try {
						const stats = await stat(fullPath);
						if (stats.isDirectory()) {
							formattedEntries.push(`${entry}/`);
						} else {
							formattedEntries.push(entry);
						}
					} catch {
						// Skip entries we can't stat
						continue;
					}
				}

				if (formattedEntries.length === 0) {
					return {
						content: [{ type: "text", content: "(empty directory)" }],
						details: { path: targetPath, count: 0 },
					};
				}

				const content = formattedEntries.join("\n");

				return {
					content: [{ type: "text", content }],
					details: { path: targetPath, count: formattedEntries.length },
				};
			} catch (error: any) {
				if (error.code === "ENOENT") {
					throw new Error(`Directory not found: ${path || "."}`);
				}
				if (error.code === "ENOTDIR") {
					throw new Error(`Not a directory: ${path}`);
				}
				throw new Error(`Failed to list directory: ${error.message}`);
			}
		},
	};
}
