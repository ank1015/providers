const tools = [
    'read: Read file contents',
    'bash: Execute bash commands',
    'edit: Make surgical edits to files (find exact text and replace)',
    'write: Create or overwrite files',
    'grep: Search file contents for patterns (respects .gitignore)',
    'find: Find files by glob pattern (respects .gitignore)',
    'ls: List directory contents',
]

const guidelinesList: string[] = [
    'Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)',
    'Use read to examine files before editing',
    'Use edit for precise changes (old text must match exactly)',
    'Use write only for new files or complete rewrites',
    'When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did',
    'Be concise in your responses',
    'Show file paths clearly when working with files'
];

export function buildSystemPrompt(workingDir: string): string {

	const now = new Date();
	const dateTime = now.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});

	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");
	const toolsList = tools.map((t) => `- ${t}}`).join("\n");


	let prompt = `You are an expert coding assistant. You help users with coding tasks by reading files, executing commands, editing code, and writing new files.

Available tools:
${toolsList}

Guidelines:
${guidelines}

Current date and time: ${dateTime}
Current working directory: ${workingDir}`

    return prompt;

}