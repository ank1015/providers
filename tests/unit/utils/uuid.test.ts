import { describe, it, expect } from 'vitest';
import { generateUUID } from '../../../src/utils/uuid.js';

describe('generateUUID', () => {
	it('should return a string', () => {
		const uuid = generateUUID();
		expect(typeof uuid).toBe('string');
	});

	it('should return a valid UUID v4 format', () => {
		const uuid = generateUUID();
		// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		// where x is any hex digit and y is one of 8, 9, a, or b
		const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuid).toMatch(uuidV4Regex);
	});

	it('should return unique values on each call', () => {
		const uuids = new Set<string>();
		const count = 1000;

		for (let i = 0; i < count; i++) {
			uuids.add(generateUUID());
		}

		expect(uuids.size).toBe(count);
	});

	it('should have correct length of 36 characters', () => {
		const uuid = generateUUID();
		expect(uuid.length).toBe(36);
	});

	it('should have hyphens at correct positions', () => {
		const uuid = generateUUID();
		expect(uuid[8]).toBe('-');
		expect(uuid[13]).toBe('-');
		expect(uuid[18]).toBe('-');
		expect(uuid[23]).toBe('-');
	});
});
