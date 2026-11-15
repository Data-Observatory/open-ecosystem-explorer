import { describe, expect, it } from 'vitest';
import { nodeAccessibleName } from '../../../src/lib/map/accessible-name';

describe('nodeAccessibleName', () => {
	it('keeps the full name when it already starts with the drawn text', () => {
		expect(nodeAccessibleName({ label: 'ROR', name: 'ROR', typeLabel: 'Identificador' })).toBe(
			'ROR (Identificador)'
		);
		expect(
			nodeAccessibleName({
				label: 'Acceso abierto',
				name: 'Acceso abierto diamante',
				typeLabel: 'Concepto'
			})
		).toBe('Acceso abierto diamante (Concepto)');
	});

	it('starts with the drawn short form when the full name does not', () => {
		expect(
			nodeAccessibleName({
				label: 'CRIS',
				name: 'Sistema de información de investigación (CRIS)',
				typeLabel: 'Concepto'
			})
		).toBe('CRIS: Sistema de información de investigación (CRIS) (Concepto)');
	});

	it('ignores line breaks and case in the drawn text', () => {
		expect(
			nodeAccessibleName({
				label: 'acceso\nabierto',
				name: 'Acceso abierto',
				typeLabel: 'Concepto'
			})
		).toBe('Acceso abierto (Concepto)');
	});
});
