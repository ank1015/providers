export { type BashToolDetails, createBashTool } from "./bash.js";
export { createEditTool } from "./edit.js";
export { type FindToolDetails, createFindTool } from "./find.js";
export { type GrepToolDetails, createGrepTool } from "./grep.js";
export { type LsToolDetails, createLsTool } from "./ls.js";
export { type ReadToolDetails, createReadTool } from "./read.js";
export type { TruncationResult } from "./truncate.js";
export { createWriteTool } from "./write.js";

import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createFindTool } from "./find.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";

// Factory function to create tools with a specific working directory
export function createCodingTools(workingDirectory: string) {
	const readTool = createReadTool(workingDirectory);
	const bashTool = createBashTool(workingDirectory);
	const editTool = createEditTool(workingDirectory);
	const writeTool = createWriteTool(workingDirectory);
	const grepTool = createGrepTool(workingDirectory);
	const findTool = createFindTool(workingDirectory);
	const lsTool = createLsTool(workingDirectory);

	return {
		// Default tools for full access mode
		codingTools: [readTool, bashTool, editTool, writeTool],

		allTools: [readTool, bashTool, editTool, writeTool, grepTool, findTool, lsTool]
	};
}

export type ToolName = "read" | "bash" | "edit" | "write" | "grep" | "find" | "ls";
