// infra/lambda/broker.mjs
// Submission broker: validates a grant request and answers with a one-shot
// presigned POST. The execution role (PutObject on submissions/* only) is
// the only writer credential in existence. CORS is enforced by the
// function URL config, not here.

import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { validateGrant } from './validate.mjs';

const s3 = new S3Client({});

function resp(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyObj),
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method;
  if (method !== 'POST') return resp(405, { reason: 'POST only' });
  let body;
  try {
    body = JSON.parse(event.body || '');
  } catch {
    return resp(400, { reason: 'invalid JSON' });
  }
  const verdict = validateGrant(body, { expectedToken: process.env.SUBMIT_TOKEN || '' });
  if (!verdict.ok) return resp(verdict.status, { reason: verdict.reason });
  const post = await createPresignedPost(s3, {
    Bucket: process.env.BUCKET,
    Key: verdict.key,
    Conditions: [
      ['eq', '$key', verdict.key],
      ['eq', '$Content-Type', verdict.contentType],
      ['content-length-range', 1, verdict.maxBytes],
    ],
    Fields: { 'Content-Type': verdict.contentType },
    Expires: 60,
  });
  return resp(200, { url: post.url, fields: post.fields, key: verdict.key });
}
