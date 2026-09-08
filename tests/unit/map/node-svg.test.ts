import { describe, it, expect } from 'vitest';
import { renderClassBoxSvg, classBoxDataUri, classBoxHeight } from '../../../src/lib/map/node-svg.js';

describe('renderClassBoxSvg', () => {
  it('is deterministic for identical input', () => {
    const input = { name: 'OpenAlex', stereotype: 'Índice · Bibliográfico', fill: '#0e7070', fields: [{ label: 'Gobernanza', value: 'Sin fines de lucro' }] };
    expect(renderClassBoxSvg(input)).toBe(renderClassBoxSvg(input));
  });

  it('produces valid-looking SVG with the name and stereotype embedded', () => {
    const svg = renderClassBoxSvg({ name: 'Scopus', stereotype: 'Índice · Bibliográfico', fill: '#0e7070', fields: [] });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('Scopus');
    expect(svg).toContain('Índice');
  });

  it('escapes XML-unsafe characters in name/stereotype/field text', () => {
    const svg = renderClassBoxSvg({
      name: 'A & B <test>',
      stereotype: 'X "quoted"',
      fill: '#000',
      fields: [{ label: 'L&R', value: '<v>' }],
    });
    expect(svg).not.toContain('<test>');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
  });

  it('caps fields at 4 rows', () => {
    const fields = [1, 2, 3, 4, 5, 6].map((n) => ({ label: `L${n}`, value: `V${n}` }));
    const svg = renderClassBoxSvg({ name: 'X', stereotype: 'Y', fill: '#000', fields });
    expect(svg).toContain('L4');
    expect(svg).not.toContain('L5');
  });

  it('truncates overlong names/labels/values rather than overflowing the box', () => {
    const svg = renderClassBoxSvg({
      name: 'A very extremely long entity name that will not fit',
      stereotype: 'Y',
      fill: '#000',
      fields: [],
    });
    expect(svg).toContain('…');
  });

  it('classBoxHeight grows with field count and matches the rendered viewBox height', () => {
    const zero = classBoxHeight(0);
    const two = classBoxHeight(2);
    expect(two).toBeGreaterThan(zero);
    const svg = renderClassBoxSvg({ name: 'X', stereotype: 'Y', fill: '#000', fields: [{ label: 'a', value: 'b' }] });
    expect(svg).toContain(`height="${classBoxHeight(1)}"`);
  });
});

describe('classBoxDataUri', () => {
  it('produces a base64 SVG data URI', () => {
    const uri = classBoxDataUri({ name: 'DOI', stereotype: 'Identificador', fill: '#953800', fields: [] });
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('is deterministic', () => {
    const input = { name: 'DOI', stereotype: 'Identificador', fill: '#953800', fields: [] };
    expect(classBoxDataUri(input)).toBe(classBoxDataUri(input));
  });

  it('decodes back to valid SVG containing the entity name', () => {
    const uri = classBoxDataUri({ name: 'ROR', stereotype: 'Identificador', fill: '#953800', fields: [] });
    const b64 = uri.replace('data:image/svg+xml;base64,', '');
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(decoded).toContain('ROR');
    expect(decoded).toContain('<svg');
  });
});
