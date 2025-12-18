import { v4 as uuidv4 } from "uuid";

/**
 * Generates a random UUID v4
 * @returns A random UUID string
 */
export function generateUUID(): string {
	return uuidv4();
}
