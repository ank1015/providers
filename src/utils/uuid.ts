import { randomUUID } from "crypto";

/**
 * Generates a random UUID v4
 * @returns A random UUID string
 */
export function generateUUID(): string {
	return randomUUID();
}
