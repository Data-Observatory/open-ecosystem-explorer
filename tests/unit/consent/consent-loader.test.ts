import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_MAX_AGE_DAYS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  localIsoDate,
  parseConsent,
  serializeConsent
} from '../../../src/lib/consent/core.js';
import { LOCALES } from '../../../src/lib/locale.js';

// static/consent-loader.js is plain JavaScript that runs before the app. It is the only code that
// can load Google Tag Manager. Analytics are on by default: the container loads unless the visitor
// stored a current "denied" choice. It cannot import core.ts, so these tests keep the two in step.

const FILE = join(process.cwd(), 'static', 'consent-loader.js');
const source = readFileSync(FILE, 'utf8');
const CONTAINER_ID = 'GTM-M9NXQLBC';
const TAG_URL = `https://www.googletagmanager.com/gtm.js?id=${CONTAINER_ID}`;
const DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
};
const GRANTED = { ...DENIED, analytics_storage: 'granted' };
const START = { 'gtm.start': expect.any(Number), event: 'gtm.js' };

const daysAgo = (days: number) => {
  const now = new Date();
  return localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
};
const storedValue = (choice: string, date: string, version = 1) =>
  JSON.stringify({ v: version, choice, date });

type Options = {
  stored?: string | null;
  storageThrows?: boolean;
  hostname?: string;
  pathname?: string;
  cookies?: string[];
  code?: string;
};

function run({
  stored = null,
  storageThrows = false,
  hostname = 'localhost',
  pathname = '/es/',
  cookies = [],
  code = source
}: Options) {
  const data = new Map<string, string>();
  if (stored !== null) data.set(CONSENT_STORAGE_KEY, stored);
  const appended: { tag: string; src?: string; async?: boolean }[] = [];
  const classes: string[] = [];
  const cookieWrites: string[] = [];
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new DOMException('blocked', 'SecurityError');
      return data.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageThrows) throw new DOMException('blocked', 'SecurityError');
      data.set(key, value);
    }
  };
  const window: Record<string, unknown> = { location: { hostname, pathname } };
  // The getter is installed like a browser does it: reading it may throw.
  Object.defineProperty(window, 'localStorage', {
    get: () => {
      if (storageThrows) throw new DOMException('blocked', 'SecurityError');
      return localStorage;
    }
  });
  const document = {
    documentElement: { classList: { add: (name: string) => classes.push(name) } },
    head: { appendChild: (element: { tag: string; src?: string }) => appended.push(element) },
    createElement: (tag: string) => ({ tag }),
    get cookie() {
      return cookies.map((name) => `${name}=1`).join('; ');
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    }
  };
  runInNewContext(code, { window, document, Date, Number, RegExp, JSON });
  // gtag pushes `arguments` objects (array-like); the container bootstrap pushes a plain object.
  const layer = () =>
    (window.dataLayer as unknown[]).map((entry) =>
      entry !== null && typeof entry === 'object' && 'length' in entry
        ? Array.from(entry as ArrayLike<unknown>)
        : entry
    );
  return {
    window,
    data,
    appended,
    classes,
    cookieWrites,
    layer,
    consent: window.oeeConsent as { grant(): void; deny(): void; isLoaded(): boolean }
  };
}

const kinds = (layer: unknown[]) =>
  layer.map((entry) => (Array.isArray(entry) ? entry[0] : 'push'));

describe('consent-loader.js: agreement with core.ts', () => {
  it('uses the storage key of core.ts', () => {
    expect(/STORAGE_KEY\s*=\s*'([^']+)'/.exec(source)?.[1]).toBe(CONSENT_STORAGE_KEY);
  });

  it('uses the stored format version and maximum age of core.ts', () => {
    expect(Number(/\bVERSION\s*=\s*(\d+)\s*;/.exec(source)?.[1])).toBe(CONSENT_VERSION);
    expect(Number(/MAX_AGE_DAYS\s*=\s*(\d+)\s*;/.exec(source)?.[1])).toBe(CONSENT_MAX_AGE_DAYS);
  });

  it('lists the same locales as the site', () => {
    const list = /LOCALES\s*=\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '';
    expect([...list.matchAll(/'([a-z]{2})'/g)].map((m) => m[1])).toEqual([...LOCALES]);
  });

  it('writes values that core.ts reads back', () => {
    const loader = run({});
    loader.consent.grant();
    expect(parseConsent(loader.data.get(CONSENT_STORAGE_KEY))).toBe('granted');
    expect(loader.data.get(CONSENT_STORAGE_KEY)).toBe(serializeConsent('granted', new Date()));
    loader.consent.deny();
    expect(parseConsent(loader.data.get(CONSENT_STORAGE_KEY))).toBe('denied');
  });

  it('names the container id and has no module syntax', () => {
    expect(source).toContain(CONTAINER_ID);
    expect(source).not.toMatch(/^\s*(import|export)\s/m);
  });

  it('never grants advertising consent types', () => {
    expect(source).not.toMatch(/ad_storage:\s*value/);
    expect(source).not.toMatch(/ad_(storage|user_data|personalization):\s*'granted'/);
  });

  it('does not use em or en dashes', () => {
    expect(source).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`)
    );
  });
});

describe('consent-loader.js: first paint', () => {
  it('adds the class js to the root element', () => {
    expect(run({}).classes).toEqual(['js']);
    expect(run({ storageThrows: true }).classes).toEqual(['js']);
  });
});

describe('consent-loader.js: before a choice', () => {
  it('sets Consent Mode, then bootstraps the container with its script', () => {
    const loader = run({});
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    // Consent default first, so no tag in the container fires before the consent state exists.
    expect(kinds(loader.layer())).toEqual(['consent', 'js', 'push']);
    expect(loader.layer()[0]).toEqual(['consent', 'default', GRANTED]);
    expect(loader.layer()[2]).toEqual(START);
    expect(typeof loader.window.gtag).toBe('function');
    expect(loader.consent.isLoaded()).toBe(true);
  });

  it.each([
    ['an unknown choice', storedValue('maybe', daysAgo(1))],
    ['another version', storedValue('denied', daysAgo(1), 2)],
    ['malformed JSON', '{"v":1,"choice":"den'],
    ['a plain word', 'denied'],
    ['a denied choice older than 365 days', storedValue('denied', daysAgo(366))],
    ['a denied choice with an impossible date', storedValue('denied', '2026-02-30')]
  ])('loads the container for %s', (_label, stored) => {
    const loader = run({ stored });
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    expect(loader.layer()[0]).toEqual(['consent', 'default', GRANTED]);
  });

  it('loads the container and does not throw when storage throws', () => {
    const loader = run({ storageThrows: true });
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    expect(loader.layer()[0]).toEqual(['consent', 'default', GRANTED]);
  });
});

describe('consent-loader.js: pages without a locale (the bare root redirect)', () => {
  it.each(['/', '/index.html', '/sub-path/', '/sub-path/index.html'])(
    '%s loads nothing, so the redirect does not count a second page view',
    (pathname) => {
      const loader = run({ pathname });
      expect(loader.appended).toEqual([]);
      expect(loader.layer()).toEqual([['consent', 'default', GRANTED]]);
      expect(loader.consent.isLoaded()).toBe(false);
    }
  );

  it.each(['/es', '/en/', '/es/glossary/', '/sub-path/en/entity/doi/'])(
    '%s loads the container',
    (pathname) => {
      expect(run({ pathname }).appended).toHaveLength(1);
    }
  );
});

describe('consent-loader.js: after a stored granted choice', () => {
  it.each([daysAgo(0), daysAgo(365)])('loads the container once (choice dated %s)', (date) => {
    const loader = run({ stored: storedValue('granted', date) });
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    expect(kinds(loader.layer())).toEqual(['consent', 'js', 'push']);
    expect(loader.layer()[0]).toEqual(['consent', 'default', GRANTED]);
    expect(loader.consent.isLoaded()).toBe(true);
  });
});

describe('consent-loader.js: after a stored denied choice', () => {
  it.each([daysAgo(0), daysAgo(365)])(
    'does not load the container and denies every consent type (choice dated %s)',
    (date) => {
      const loader = run({ stored: storedValue('denied', date) });
      expect(loader.appended).toEqual([]);
      expect(loader.layer()).toEqual([['consent', 'default', DENIED]]);
      expect(loader.consent.isLoaded()).toBe(false);
    }
  );

  it('does not load the container on any locale page either', () => {
    for (const pathname of ['/es/', '/en/about/', '/es/entity/doi/']) {
      expect(run({ stored: storedValue('denied', daysAgo(1)), pathname }).appended).toEqual([]);
    }
  });
});

describe('consent-loader.js: window.oeeConsent', () => {
  it('has no revoke: changing the choice only asks again', () => {
    expect(run({}).consent).not.toHaveProperty('revoke');
  });

  it('grant stores the choice and does not load the container a second time', () => {
    const loader = run({});
    loader.consent.grant();
    loader.consent.grant();
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    expect(loader.layer().filter((entry) => !Array.isArray(entry))).toEqual([START]);
    expect(parseConsent(loader.data.get(CONSENT_STORAGE_KEY))).toBe('granted');
  });

  it('grant after a stored denied choice sets consent granted, then loads the container', () => {
    const loader = run({ stored: storedValue('denied', daysAgo(1)) });
    loader.consent.grant();
    expect(loader.appended).toEqual([{ tag: 'script', async: true, src: TAG_URL }]);
    expect(kinds(loader.layer())).toEqual(['consent', 'consent', 'js', 'push']);
    expect(loader.layer()[1]).toEqual(['consent', 'update', GRANTED]);
    expect(parseConsent(loader.data.get(CONSENT_STORAGE_KEY))).toBe('granted');
  });

  it('grant after deny in the same page view sets consent granted again', () => {
    const loader = run({});
    loader.consent.deny();
    loader.consent.grant();
    expect(loader.layer().at(-1)).toEqual(['consent', 'update', GRANTED]);
    expect(loader.appended).toHaveLength(1);
  });

  it('grant does not throw when storage throws', () => {
    const loader = run({ storageThrows: true });
    expect(() => loader.consent.grant()).not.toThrow();
    expect(loader.appended).toHaveLength(1);
  });

  it('deny stores the choice and sets every consent type to denied', () => {
    const loader = run({});
    loader.consent.deny();
    expect(parseConsent(loader.data.get(CONSENT_STORAGE_KEY))).toBe('denied');
    expect(loader.layer().at(-1)).toEqual(['consent', 'update', DENIED]);
  });

  it('deny does not load the container where it was not loaded', () => {
    const loader = run({ stored: storedValue('denied', daysAgo(1)) });
    loader.consent.deny();
    expect(loader.appended).toEqual([]);
  });

  it('deny does not throw when storage throws and still denies consent', () => {
    const loader = run({ storageThrows: true });
    expect(() => loader.consent.deny()).not.toThrow();
    expect(loader.layer().at(-1)).toEqual(['consent', 'update', DENIED]);
  });

  describe('cookie deletion on deny', () => {
    const expiry = /expires=Thu, 01 Jan 1970 00:00:00 GMT/;
    const domainOf = (write: string) => /domain=([^;]+)/.exec(write)?.[1] ?? '';
    const forName = (writes: string[], name: string) =>
      writes.filter((write) => write.startsWith(`${name}=;`) && expiry.test(write));
    const HOST = 'oee.example.org';

    it.each(['_ga', '_ga_ABC123DEF4', '_gid', '_gat', '_gat_UA_1'])(
      'expires %s without a domain and on the exact host only, never on a parent domain',
      (name) => {
        const loader = run({ hostname: HOST, cookies: [name] });
        loader.consent.deny();
        expect(forName(loader.cookieWrites, name).map(domainOf).sort()).toEqual(['', HOST]);
      }
    );

    it('leaves other cookies alone and never writes a parent domain without a known property', () => {
      const loader = run({ hostname: HOST, cookies: ['_ga', '_ga_ZCRKY3JWGH', 'theme'] });
      loader.consent.deny();
      expect(loader.cookieWrites.some((write) => write.startsWith('theme='))).toBe(false);
      const onParent = loader.cookieWrites.filter((write) => {
        const domain = domainOf(write);
        return domain !== '' && domain !== HOST;
      });
      expect(onParent).toEqual([]);
    });

    it('also expires the cookie of a configured property on parent domains, and no other', () => {
      const code = source.replace(
        "GA_MEASUREMENT_ID = '';",
        "GA_MEASUREMENT_ID = 'G-X6BJF4NQ71';"
      );
      expect(code).not.toBe(source);
      const loader = run({
        code,
        hostname: HOST,
        cookies: ['_ga_X6BJF4NQ71', '_ga_ZCRKY3JWGH', '_ga', 'theme']
      });
      loader.consent.deny();
      expect(forName(loader.cookieWrites, '_ga_X6BJF4NQ71').map(domainOf)).toEqual(
        expect.arrayContaining(['', HOST, 'example.org'])
      );
      expect(loader.cookieWrites.some((write) => /domain=org(;|$)/.test(write))).toBe(false);
      for (const name of ['_ga_ZCRKY3JWGH', '_ga']) {
        expect(forName(loader.cookieWrites, name).map(domainOf).sort()).toEqual(['', HOST]);
      }
      expect(loader.window['ga-disable-G-X6BJF4NQ71']).toBe(true);
    });

    it('lifts the optional ga-disable switch again on grant', () => {
      const code = source.replace(
        "GA_MEASUREMENT_ID = '';",
        "GA_MEASUREMENT_ID = 'G-X6BJF4NQ71';"
      );
      const loader = run({ code, stored: storedValue('denied', daysAgo(1)) });
      expect(loader.window['ga-disable-G-X6BJF4NQ71']).toBe(true);
      loader.consent.grant();
      expect(loader.window['ga-disable-G-X6BJF4NQ71']).toBe(false);
    });
  });
});
