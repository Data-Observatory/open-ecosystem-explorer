import { describe, it, expect } from 'vitest';
import {
	hexToRgb,
	rgbToLab,
	ciede2000,
	simulateCvd,
	hexDeltaE
} from '../../../src/lib/map/color-distance.js';

describe('color-distance', () => {
	it('hexToRgb parses a hex colour', () => {
		expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
		expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
	});

	it('identical colours have zero ΔE', () => {
		expect(hexDeltaE('#1f6feb', '#1f6feb')).toBeCloseTo(0, 5);
	});

	it('white vs black has a large ΔE (near the theoretical max)', () => {
		const d = hexDeltaE('#ffffff', '#000000');
		expect(d).toBeGreaterThan(90);
	});

	it('ciede2000 is symmetric', () => {
		const a = rgbToLab(hexToRgb('#1f6feb'));
		const b = rgbToLab(hexToRgb('#0969da'));
		expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 6);
	});

	it('simulateCvd is a no-op for normal vision', () => {
		const rgb = hexToRgb('#8250df');
		expect(simulateCvd(rgb, 'normal')).toEqual(rgb);
	});

	it('simulateCvd desaturates red/green distinctions', () => {
		// Pure red and pure green are maximally different in normal vision but
		// should collapse much closer together under a red-green CVD sim.
		const normal = hexDeltaE('#ff0000', '#00ff00', 'normal');
		const protan = hexDeltaE('#ff0000', '#00ff00', 'protanopia');
		expect(protan).toBeLessThan(normal);
	});

	it('known collision from the evaluation report: repository vs community fails a 20 ΔE floor in normal vision', () => {
		// This is the exact pair the report measured at ΔE 3.3 (base palette,
		// before the map2 override) — regression proof for why the override
		// exists at all.
		const d = hexDeltaE('#1f6feb', '#0969da', 'normal');
		expect(d).toBeLessThan(20);
	});
});
