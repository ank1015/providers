import { type Static, Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "../../agent/types.js";

export interface CalculateResult extends AgentToolResult<undefined> {
	content: Array<{ type: "text"; content: string }>;
	details: undefined;
}

export function calculate(expression: string): CalculateResult {
	try {
		const result = new Function("return " + expression)();
		return { content: [{ type: "text", content: `${expression} = ${result}` }], details: undefined };
	} catch (e: any) {
		throw new Error(e.message || String(e));
	}
}

const calculateSchema = Type.Object({
	expression: Type.String({ description: "The mathematical expression to evaluate" }),
});

type CalculateParams = Static<typeof calculateSchema>;

export const calculateTool: AgentTool<typeof calculateSchema, undefined> = {
	label: "Calculator",
	name: "calculate",
	description: "Evaluate mathematical expressions",
	parameters: calculateSchema,
	execute: async (_toolCallId: string, args: CalculateParams) => {
		return calculate(args.expression);
	},
};
