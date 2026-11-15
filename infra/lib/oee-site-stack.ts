import * as path from 'path';
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface OeeSiteStackProps extends StackProps {
	/** Public domain the site is served under, e.g. "oee.dataobservatory.net". */
	domainName: string;
	/**
	 * Write CloudFront standard logs and S3 server access logs to a separate log bucket.
	 * Default false: the synthesized template is then identical to a stack without this option.
	 */
	accessLogs?: boolean;
	/** Days after which log objects expire. Default 90. Used only when accessLogs is true. */
	accessLogRetentionDays?: number;
}

const DEFAULT_ACCESS_LOG_RETENTION_DAYS = 90;

// The built pages need one inline bootstrap script and inline styles, plus same-origin
// modules, CSS, fonts and data fetches. The only third-party requests are Google Tag Manager
// (static/consent-loader.js, loaded unless the visitor turned analytics off) and the measurement
// hits of its tags, so only the Google hosts appear. A tag added to the container that needs
// another host is blocked by this policy until the host is added here (docs/analytics.md).
const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com",
	"font-src 'self'",
	"connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'"
].join('; ');

const IMMUTABLE_PREFIX = '_app/immutable';

// Browser features the site never uses are denied for the page and any embedded frame.
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

/**
 * Static hosting for the Open Ecosystem Explorer: a private S3 bucket (read only through
 * CloudFront Origin Access Control), a CloudFront distribution with a viewer-request
 * function that maps page URLs onto the per-page index.html files of the static build,
 * security response headers, and three BucketDeployments that upload ../build (immutable
 * assets with a one-year Cache-Control, everything else revalidated), invalidate the
 * distribution and then remove the immutable assets of earlier builds.
 *
 * DNS is deliberately not managed here: the DNS zone for dataobservatory.net lives in a
 * different account, so the stack manages no Route 53 records. The certificate
 * validation CNAME and the alias A record are created by hand; see infra/README.md.
 */
export class OeeSiteStack extends Stack {
	constructor(scope: Construct, id: string, props: OeeSiteStackProps) {
		super(scope, id, props);

		// Optional access logs. The logs contain visitor IP addresses; see infra/README.md.
		let logBucket: s3.Bucket | undefined;
		if (props.accessLogs) {
			logBucket = new s3.Bucket(this, 'AccessLogBucket', {
				blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
				enforceSSL: true,
				encryption: s3.BucketEncryption.S3_MANAGED,
				// CloudFront standard logging delivers through bucket ACLs, which need ObjectWriter.
				objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
				lifecycleRules: [
					{
						expiration: Duration.days(
							props.accessLogRetentionDays ?? DEFAULT_ACCESS_LOG_RETENTION_DAYS
						)
					}
				],
				removalPolicy: RemovalPolicy.RETAIN
			});
		}

		const bucket = new s3.Bucket(this, 'SiteBucket', {
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: RemovalPolicy.RETAIN,
			...(logBucket && { serverAccessLogsBucket: logBucket, serverAccessLogsPrefix: 's3/' })
		});

		const certificate = new acm.Certificate(this, 'Certificate', {
			domainName: props.domainName,
			validation: acm.CertificateValidation.fromDns()
			// No hostedZone: the zone is in a different account. CloudFormation waits at this
			// resource until the validation CNAME exists.
		});

		const rewriteFn = new cloudfront.Function(this, 'RewriteExtensionlessUris', {
			runtime: cloudfront.FunctionRuntime.JS_2_0,
			code: cloudfront.FunctionCode.fromFile({
				filePath: path.join(__dirname, '../cloudfront-fn/rewrite-uri.js')
			}),
			comment:
				'Serves the per-page index.html of the static SvelteKit build and adds the trailing slash'
		});

		const headersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
			comment: 'Security headers for the static site',
			securityHeadersBehavior: {
				strictTransportSecurity: {
					accessControlMaxAge: Duration.days(365),
					includeSubdomains: true,
					override: true
				},
				contentTypeOptions: { override: true },
				frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
				referrerPolicy: {
					referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
					override: true
				},
				contentSecurityPolicy: { contentSecurityPolicy: CONTENT_SECURITY_POLICY, override: true }
			},
			customHeadersBehavior: {
				customHeaders: [{ header: 'Permissions-Policy', value: PERMISSIONS_POLICY, override: true }]
			}
		});

		const distribution = new cloudfront.Distribution(this, 'Distribution', {
			domainNames: [props.domainName],
			certificate,
			defaultRootObject: 'index.html',
			httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
			...(logBucket && { enableLogging: true, logBucket, logFilePrefix: 'cloudfront/' }),
			minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
			defaultBehavior: {
				origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
				responseHeadersPolicy: headersPolicy,
				functionAssociations: [
					{
						function: rewriteFn,
						eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
					}
				]
			},
			errorResponses: [
				{
					httpStatus: 403, // a missing key behind OAC comes back as 403, not 404
					responseHttpStatus: 404,
					responsePagePath: '/404.html',
					ttl: Duration.minutes(5)
				},
				{
					httpStatus: 404,
					responseHttpStatus: 404,
					responsePagePath: '/404.html',
					ttl: Duration.minutes(5)
				}
			]
		});

		// Three deployments of the same ../build source, in order: new chunks, pages (with the CDN
		// invalidation), then the removal of the chunks of earlier builds.
		const buildSource = s3deploy.Source.asset(path.join(__dirname, '../../build'));

		// Fingerprinted assets: content-hashed file names, safe to cache for a year. Not pruned
		// here: the pages of the previous build are still live while this runs, and they import
		// the previous chunks. No invalidation is needed for new names.
		const immutableCacheControl = [
			s3deploy.CacheControl.setPublic(),
			s3deploy.CacheControl.maxAge(Duration.days(365)),
			s3deploy.CacheControl.immutable()
		];
		const immutableDeployment = new s3deploy.BucketDeployment(this, 'DeployImmutableAssets', {
			sources: [buildSource],
			destinationBucket: bucket,
			exclude: ['*'],
			include: [`${IMMUTABLE_PREFIX}/*`],
			cacheControl: immutableCacheControl,
			prune: false
		});

		// Everything else (html, __data.json, data/*.json, search indexes, sitemap, favicon, robots.txt, 404.html) keeps stable names
		// and changes between builds: always revalidate, prune removed files (never touching
		// the immutable prefix, which this deployment excludes) and invalidate the CDN.
		const pagesDeployment = new s3deploy.BucketDeployment(this, 'DeploySite', {
			sources: [buildSource],
			destinationBucket: bucket,
			exclude: [`${IMMUTABLE_PREFIX}/*`],
			cacheControl: [
				s3deploy.CacheControl.setPublic(),
				s3deploy.CacheControl.maxAge(Duration.seconds(0)),
				s3deploy.CacheControl.mustRevalidate()
			],
			distribution,
			distributionPaths: ['/*'],
			prune: true
		});
		// New chunks land before pages that reference them.
		pagesDeployment.node.addDependency(immutableDeployment);

		// Last, once the new pages are live: delete the chunks that no build refers to any more,
		// so the bucket always holds exactly the current build. Nothing live points at a deleted
		// file. A browser tab opened on an older build that imports a deleted chunk gets a 404,
		// and SvelteKit answers a failed chunk import with a full page load of the destination,
		// which is served by the current build. Same filters and Cache-Control as the first
		// deployment, so files it finds already uploaded are left as they are.
		const pruneImmutableDeployment = new s3deploy.BucketDeployment(this, 'PruneImmutableAssets', {
			sources: [buildSource],
			destinationBucket: bucket,
			exclude: ['*'],
			include: [`${IMMUTABLE_PREFIX}/*`],
			cacheControl: immutableCacheControl,
			prune: true
		});
		pruneImmutableDeployment.node.addDependency(pagesDeployment);

		new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
		new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
		new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
		new CfnOutput(this, 'CertificateArn', { value: certificate.certificateArn });
		new CfnOutput(this, 'SiteUrl', { value: `https://${props.domainName}` });
	}
}
