# Open Ecosystem Explorer site infrastructure (CDK)

Deploys the static site (SvelteKit adapter-static output in `../build`) to S3 + CloudFront.

Domain: `oee.dataobservatory.net` (default; override with `-c domainName=...`). Stack id: `OeeSiteStack`. Region: `us-east-1` (CloudFront certificates must live there).

This stack is copied from the sister site `fairness` (`Data-Observatory/fairness`, `infra/`) and adapted. The differences: the stack and domain names, the viewer-request function (this build has one directory per page, `es/about/index.html`, and links end in a slash), the Content-Security-Policy comment, and the tests.

## Status

Deployed by hand on 2026-11-14 (`cdk deploy` from the repository root build, `SITE_URL=https://oee.dataobservatory.net`). The stack `OeeSiteStack` exists in the app account (us-east-1), the ACM certificate is issued, the validation CNAME and the alias A record exist in the DNS account, and the site is public at `https://oee.dataobservatory.net`. Checked after the deploy: `/` and the locale pages return 200, `/es/about` redirects to `/es/about/`, a made-up path returns the 404 page with status 404, `sitemap.xml` and `robots.txt` use the public origin, the security headers are present, and a browser run over six pages (map, entity, glossary, questions, about) showed no console error and no Content-Security-Policy violation (Google hosts blocked for the test).

Not done yet: the deploy workflow (`DEPLOY_ENABLED` is not set, so later deploys are by hand, as in "Deploying by hand"), and the GitHub side of "Deploy workflow: owner setup" (OIDC role, environments, variables, secret, branch protection). The sections below keep the steps for a redeploy and for those.

## Account topology (read this first)

Two AWS accounts are involved, as for `fairness`:

- the app account, where this stack is deployed (profile placeholder `<app-profile>`);
- the DNS account, which holds the Route 53 hosted zone (profile placeholder `<dns-profile>`, zone id placeholder `<hosted-zone-id>`).

The DNS zone for dataobservatory.net lives in a different account, so the stack manages no Route 53 records. CDK cannot write cross-account DNS records on its own. Two records are created by hand, against the DNS account, and nothing else there:

1. ACM validation CNAME. `cdk deploy` waits at the `Certificate` resource until a DNS validation record exists. While it waits, read the pending record in the app account and create it in the DNS account:

   ```sh
   aws acm list-certificates --profile <app-profile> --region us-east-1 \
     --query "CertificateSummaryList[?DomainName=='oee.dataobservatory.net'].CertificateArn" --output text

   aws acm describe-certificate --profile <app-profile> --region us-east-1 \
     --certificate-arn <certificate-arn> \
     --query "Certificate.DomainValidationOptions[0].ResourceRecord"

   # then, in the DNS account, with the Name and Value printed above:
   aws route53 change-resource-record-sets --profile <dns-profile> \
     --hosted-zone-id <hosted-zone-id> \
     --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":
       {"Name":"<Name>","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"<Value>"}]}}]}'
   ```

   The deploy continues once ACM validates the record (usually a few minutes).

2. CloudFront alias A record. After the distribution exists (stack output `DistributionDomainName`), point the domain at it:

   ```sh
   aws route53 change-resource-record-sets --profile <dns-profile> \
     --hosted-zone-id <hosted-zone-id> \
     --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":
       {"Name":"oee.dataobservatory.net","Type":"A","AliasTarget":
         {"HostedZoneId":"Z2FDTNDATAQYW2","DNSName":"<DistributionDomainName>","EvaluateTargetHealth":false}}}]}'
   ```

   `Z2FDTNDATAQYW2` is the fixed, global hosted zone id CloudFront uses for alias records.

## What this stack creates

- A private S3 bucket: all public access blocked, TLS enforced, S3-managed encryption, retained on stack deletion. Readable only through CloudFront Origin Access Control, scoped to the distribution.
- An ACM certificate for the domain (DNS validation, no Route 53 record managed here).
- A CloudFront distribution: the domain as its only alias, HTTP to HTTPS redirect, TLS 1.2 (2021 policy) or newer, HTTP/2 and HTTP/3, `index.html` as root object.
- A CloudFront Function (`cloudfront-fn/rewrite-uri.js`, viewer-request): `/es/about/` is served from `es/about/index.html`, and `/es/about` gets a 301 to `/es/about/` (query string kept). Anything with a file extension passes through (`/es/__data.json`, `/data/graph.json`, `/sitemap.xml`).
- Custom error responses: 403 and 404 serve `/404.html` with status 404 (a missing key behind Origin Access Control comes back as 403).
- A response headers policy: HSTS (one year, includeSubdomains, no preload), nosniff, frame deny, referrer policy `strict-origin-when-cross-origin`, a Content-Security-Policy limited to same-origin sources plus the Google Tag Manager and Google Analytics hosts (`googletagmanager.com`, `google-analytics.com`, `analytics.google.com`), and `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.
- Two `BucketDeployment`s of `../build` (see Caching).
- Optional access logging, off by default (see Access logging).

Outputs: `DistributionDomainName`, `DistributionId`, `BucketName`, `CertificateArn`, `SiteUrl`.

### Content-Security-Policy and the analytics container

The policy allows the site's own scripts (one inline bootstrap script that SvelteKit writes into every page, hence `'unsafe-inline'`; a per-page hash cannot be set in a static headers policy), inline styles, and the Google hosts. The page loads Google Tag Manager from `static/consent-loader.js` unless the visitor turned analytics off. A tag that someone adds to the container later and that needs another host (a different Google domain, a third-party pixel) is blocked by the browser without any error on the site, so add the host to `CONTENT_SECURITY_POLICY` in `lib/oee-site-stack.ts` and to the pinned copy in `test/oee-site-stack.test.ts`, in the same change. See `docs/analytics.md` for the Consent Mode checks that are the owner's job.

## Caching

The build is uploaded by two `BucketDeployment`s with the same `../build` source. Include and exclude filters make each file belong to exactly one of them.

| Deployment              | Files                                                                                         | Cache-Control                         | Prune | Invalidation |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- | ----- | ------------ |
| `DeployImmutableAssets` | `_app/immutable/**` (content-hashed names)                                                    | `public, max-age=31536000, immutable` | no    | none         |
| `DeploySite`            | everything else (html, `__data.json`, `data/*`, search indexes, sitemap, `robots.txt`, `404.html`) | `public, max-age=0, must-revalidate`  | yes   | `/*`         |

Prune is off for the immutable deployment on purpose: a page cached by a browser or by CloudFront can still import a chunk from a previous build, so old chunks must stay in the bucket after a new deploy. The second deployment excludes `_app/immutable/*`, so its prune never deletes them. It also depends on the first, so new chunks are uploaded before the pages that reference them. Invalidation is only needed for the files whose names do not change, so only the second deployment invalidates.

Old chunks accumulate. Remove them manually (or with an S3 lifecycle rule) if storage grows.

## Access logging

Off by default: without the context the synthesized template is unchanged. Turn it on with a CDK context value:

```sh
./node_modules/.bin/cdk synth -c domainName=oee.example.test -c accessLogs=true -c accessLogRetentionDays=90
```

| Context                  | Default | Effect                                                    |
| ------------------------ | ------- | --------------------------------------------------------- |
| `accessLogs`             | `false` | `true` creates the log bucket and enables both log kinds. |
| `accessLogRetentionDays` | `90`    | Days after which log objects expire. Positive integer.    |

When on, the stack adds one log bucket (all public access blocked, TLS enforced, S3-managed encryption, object ownership `ObjectWriter` because CloudFront standard logging delivers through bucket ACLs, retained on stack deletion, lifecycle expiration after `accessLogRetentionDays`). CloudFront standard logs go to the prefix `cloudfront/` and S3 server access logs of the site bucket to the prefix `s3/`.

The logs contain visitor IP addresses. If logging is enabled, the privacy statement on the About page must say so, with the retention period.

Turning logging off again in a later deploy removes the logging settings from the distribution and the site bucket; the log bucket is retained with its contents until it is emptied and deleted by hand. Every deploy, including the one from the workflow below, takes the logging setting from its context values, so the same values must be passed each time.

## Build, test and synth (no AWS calls)

```sh
# from the repo root: the static build is the deployment source
npm run build            # SITE_URL=https://oee.dataobservatory.net for the build that is published

cd infra
npm ci
npx tsc --noEmit
npx vitest run
CDK_DEFAULT_ACCOUNT=111111111111 CDK_DEFAULT_REGION=us-east-1 \
  ./node_modules/.bin/cdk synth -c domainName=oee.example.test
```

Synth with dummy values only. The account id is read from `CDK_DEFAULT_ACCOUNT`; no account id, ARN or profile name is stored in tracked files (`test/no-account-ids.test.ts` and `test/workflows.test.ts` fail if one is). The stack tests read `../build`, so build the site first.

## Deploying by hand (creates real billable AWS resources)

Run by the repository owner. The first deploy of the domain is done this way, because it waits at the certificate until the validation CNAME exists.

```sh
# 1. Build the site with the public origin (repo root)
SITE_URL=https://oee.dataobservatory.net npm run build

# 2. Deploy (infra directory)
cd infra
./node_modules/.bin/cdk bootstrap --profile <app-profile>   # first time only, per account and region; skip if the account is already bootstrapped for us-east-1
./node_modules/.bin/cdk diff --profile <app-profile>        # review the changes first
./node_modules/.bin/cdk deploy --profile <app-profile>      # creates real AWS resources
```

Create the two DNS records above while the deploy runs. Redeploying after a content or code change repeats step 1 and `cdk deploy`: `BucketDeployment` re-syncs `build/` and invalidates the CDN. See "Credentials with SSO profiles" if the CLI cannot resolve the profile.

After the first deploy, check the live site: `/` redirects to `/es/`, `/es/about` redirects to `/es/about/`, a made-up path shows the 404 page, `/sitemap.xml` lists `https://oee.dataobservatory.net/...` addresses, and the browser console shows no Content-Security-Policy error on the map, the entity pages and with analytics on.

## Changing the domain

```sh
SITE_URL=https://<other-name>.dataobservatory.net npm run build
cd infra && ./node_modules/.bin/cdk deploy --profile <app-profile> -c domainName=<other-name>.dataobservatory.net
```

The DNS records change accordingly, and so does the repository variable `SITE_DOMAIN` below.

## Deploy workflow: owner setup

`.github/workflows/deploy.yml` runs the checks, builds the site, and runs `cdk diff` and `cdk deploy` through GitHub OIDC, in two jobs. It is inert until the owner completes the steps below: both jobs run only when the repository variable `DEPLOY_ENABLED` is `true`. It starts after a successful `CI` run on `main` (for the commit that passed, `workflow_run`) or by hand (`workflow_dispatch`, default ref), never on `push`. Runs do not overlap and a run in progress is not cancelled. No account id, ARN or profile name is stored in the repository.

- Job `diff` (environment `production-diff`, no reviewers): runs `check`, `lint`, `validate`, `layout:check`, the unit tests, `build` (with `SITE_URL` from `SITE_DOMAIN`) and the infra type-check and tests, then `cdk diff`. The diff is written to the job summary and the build is uploaded as the artifact `site-build`.
- Job `deploy` (environment `production`, `needs: diff`): pauses until a reviewer approves, so the approver reads the diff first, then downloads `site-build` and runs `cdk deploy`. The reviewed build is the build that is published.
- The infra packages are installed before the AWS credentials exist, so install scripts never see them.

Owner steps, none of which is done by the workflow or by an agent:

1. The GitHub repository exists (`Data-Observatory/open-ecosystem-explorer`, default branch `main`, `main` pushed on 2026-11-14). Done.
2. In the app account, create the GitHub OIDC identity provider (`token.actions.githubusercontent.com`, audience `sts.amazonaws.com`) if it does not exist. The `fairness` setup may already have created one: check before creating a second.
3. In the app account, create an IAM role for this repository (or add this repository to the trust policy of the `fairness` role). Its trust policy allows `sts:AssumeRoleWithWebIdentity` from that provider only when the `sub` claim equals one of `repo:<org>/<repo>:environment:production` (job `deploy`) and `repo:<org>/<repo>:environment:production-diff` (job `diff`), and `aud` equals `sts.amazonaws.com`. Its permissions allow it to assume only the CDK bootstrap roles of the account and region (the deploy, file-publishing, image-publishing and lookup roles created by `cdk bootstrap`) and nothing else.
4. In the GitHub repository settings, create the environment `production-diff` (no reviewers) and the environment `production` with required reviewers. The `deploy` job pauses at `production` until a reviewer approves, after the `diff` job has finished, which gates the `cdk deploy` step.
5. Add the repository variables `DEPLOY_ENABLED` (`true` to activate), `AWS_REGION` (`us-east-1`), `SITE_DOMAIN` (`oee.dataobservatory.net`), and optionally `ACCESS_LOGS` (`true` or empty) and `ACCESS_LOG_RETENTION_DAYS` (a number, or empty for 90).
6. Add the repository secret `AWS_DEPLOY_ROLE_ARN` with the ARN of the role from step 3.
7. If `ACCESS_LOGS` is `true`, update the privacy statement first: the logs contain visitor IP addresses.
8. The first deploy and the two DNS records are done (see Status). Set `DEPLOY_ENABLED` to `true` once steps 2 to 6 are in place, so later pushes to `main` deploy through the workflow.

Turn on branch protection for `main` with the `CI` jobs `test` and `infra` as required checks, so a pull request cannot be merged red. The repository settings are the owner's.

Third-party actions in the workflows are pinned by commit SHA, checked against each action's repository when the file was written (`fairness` pins the same commits): `actions/checkout` v4.3.1, `actions/setup-node` v4.4.0, `actions/upload-artifact` v4.6.2, `actions/download-artifact` v4.3.0, `aws-actions/configure-aws-credentials` v6.3.0. Update the SHAs deliberately.

## Credentials with SSO profiles

The CDK CLI used with `fairness` could not resolve credentials from an AWS SSO profile on its own (errors "Unable to resolve AWS account" or "no credentials have been configured"). Export temporary credentials into the shell instead, without writing them to any file:

```sh
eval "$(aws configure export-credentials --profile <app-profile> --format env)"
export AWS_REGION=us-east-1 CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
./node_modules/.bin/cdk diff
./node_modules/.bin/cdk deploy
```
