#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OeeSiteStack } from '../lib/oee-site-stack';

const app = new cdk.App();

const domainName: string = app.node.tryGetContext('domainName') ?? 'oee.dataobservatory.net';

// Context values given with -c arrive as strings ("true", "30").
const accessLogs = String(app.node.tryGetContext('accessLogs') ?? 'false') === 'true';
const retentionContext = app.node.tryGetContext('accessLogRetentionDays');
const accessLogRetentionDays =
	retentionContext === undefined || retentionContext === '' ? 90 : Number(retentionContext);
if (!Number.isInteger(accessLogRetentionDays) || accessLogRetentionDays < 1) {
	throw new Error('accessLogRetentionDays must be a positive integer');
}

new OeeSiteStack(app, 'OeeSiteStack', {
	domainName,
	accessLogs,
	accessLogRetentionDays,
	// The account comes from the environment (never a literal). CloudFront-attached ACM
	// certificates must live in us-east-1, so the region is fixed.
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: 'us-east-1'
	},
	description: 'Open Ecosystem Explorer static site (S3 + CloudFront)'
});
