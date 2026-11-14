import { describe, expect, it } from 'vitest';
import { fmt } from '../../../src/lib/invariants/types.js';

describe('fmt', () => {
	it('formats a message with a field and a value', () => {
		const text = fmt({
			level: 'ERROR',
			ruleId: 'I7',
			file: 'src/content/entities/x.md',
			field: 'relations[0].predicate',
			value: 'implemented-by',
			message: 'bad predicate.',
			hint: 'use implements'
		});
		expect(text).toContain('ERROR I7');
		expect(text).toContain('relations[0].predicate');
		expect(text).toContain('"implemented-by"');
		expect(text).toContain('use implements');
	});

	it('formats a message with no field and no value', () => {
		const text = fmt({
			level: 'WARN',
			ruleId: 'I28',
			file: 'src/content/entities/',
			message: 'too many components.',
			hint: 'component 1: a, b\ncomponent 2: c'
		});
		expect(text).toContain('WARN I28  src/content/entities/');
		expect(text).not.toContain('Got:');
		expect(text).toContain('component 2: c');
	});
});
