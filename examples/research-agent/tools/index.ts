export { createWriteTool } from "./write.js";
export { createAppendTool } from "./append.js";
export { createReadTool } from "./read.js";
export { createLsTool } from "./ls.js";
export { createMkdirTool } from "./mkdir.js";
export { searchTool } from "./search.js";
export { extractTool } from "./exract.js";

import { createWriteTool } from "./write.js";
import { createAppendTool } from "./append.js";
import { createReadTool } from "./read.js";
import { createLsTool } from "./ls.js";
import { createMkdirTool } from "./mkdir.js";
import { searchTool } from "./search.js";
import { extractTool } from "./exract.js";

// Factory function to create tools with a specific working directory
export function createResearchTools(workingDirectory: string) {
	const writeTool = createWriteTool(workingDirectory);
	const appendTool = createAppendTool(workingDirectory);
	const readTool = createReadTool(workingDirectory);
	const lsTool = createLsTool(workingDirectory);
	const mkdirTool = createMkdirTool(workingDirectory);

	return {
		// All research tools (filesystem + web)
		researchTools: [searchTool, extractTool, writeTool, appendTool, readTool, lsTool, mkdirTool],

		// Individual tool groups for flexibility
		filesystemTools: [writeTool, appendTool, readTool, lsTool, mkdirTool],
		webTools: [searchTool, extractTool],
	};
}

export type FilesystemToolName = "write" | "append" | "read" | "ls" | "mkdir";
export type WebToolName = "search" | "extract";
export type ResearchToolName = FilesystemToolName | WebToolName;
