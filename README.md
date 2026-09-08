# openscience-ecosystem

Static Astro site mapping the open-science research-information ecosystem
(identifiers, registration agencies, indices, institutional systems,
standards, communities/coalitions) as a validated, navigable knowledge graph.
See `specs.md` for the full spec.

## Running locally

```bash
npm install
npm run dev
```

Serves at **http://localhost:4321** with hot reload.

To serve a production build instead (matches what Playwright/e2e tests run
against):

```bash
npm run build     # validates content, then builds to dist/
npm run preview   # serves dist/ at http://127.0.0.1:4321
```

If port 4321 is already in use (e.g. a stale preview server), free it first:

```bash
fuser -k 4321/tcp
```

## Testing from another device on the local network

By default the dev server only binds to localhost. To reach it from another
device on your LAN:

```bash
npm run dev -- --host
```

Then, from the other device, open `http://<this-machine's-LAN-IP>:4321`
(find the IP with `hostname -I` or `ip addr`).

Alternatively, if this machine is on a Tailscale network, `astro.config.mjs`
already whitelists its Tailscale hostname (and any `*.ts.net` host) in Vite's
`allowedHosts` — a plain `npm run dev` (no `--host` needed) is reachable at
`http://<tailscale-hostname>:4321` from any device on the tailnet, including
via Tailscale Funnel if you want it reachable outside the tailnet too.

## Other scripts

- `npm run validate` — standalone content/graph validator (invariants I1-I34), no build needed
- `npm run typecheck` — `astro check` + `tsc --noEmit`
- `npx vitest run` — unit tests
- `npx playwright test` — e2e + accessibility tests (spins up `npm run preview` itself)
