import 'dotenv/config'

import { startSock } from './api/whatsApp'
import { sendFinancialMessage, sendTextMessage } from './services/whatsApp'

const GROUP_ID = process.env.GROUP_NAME!
if (!GROUP_ID) {
    throw new Error('Environment variable GROUP_NAME must be defined');
}

const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (!AUTH_TOKEN) {
    throw new Error('Environment variable AUTH_TOKEN must be defined');
}

// Run with: serverless invoke local --function cronHandler
export const run = async (_event, context) => {
    try {
      const sockPromise = startSock();
      const result = await sendFinancialMessage(GROUP_ID, sockPromise);
      console.log('Submission result:', result);
    } catch (err) {
      console.error('Error in run():', err);
    }
}

//run(null, null); //Local debug

/** ===== HTTP handler =====
 *  Auth:
 *    - Header: Authorization: Bearer <AUTH_TOKEN>
 *    - or query/body: token=<AUTH_TOKEN>
 *  Params:
 *    - group: name of the group JID (@g.us). Default: GROUP_NAME
 *    - mode: 'trm' | 'raw' (default: 'trm')
 *    - text: content to send when mode='raw' (or if text is present)
 */
type HttpEvent = {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string } };
  httpMethod?: string; // compat v1
};

type JsonBody = { 
  group: string;
  text: string;
  mode?: string | undefined;
};

function jsonResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
function methodOf(e: HttpEvent) {
  return e.requestContext?.http?.method || (e as any).httpMethod || 'POST';
}
function parseBody(bodyStr: string): JsonBody | null {
  let jsonBody: any;
    try {
      jsonBody = JSON.parse(bodyStr);
    } catch {
      return null;
    }

    const group: string | undefined = jsonBody.group;
    if (!group) {
      return null;
    }
    const text: string | undefined = typeof jsonBody.text === 'string' ? jsonBody.text.trim() : undefined;
    if (!text || text.length === 0) {
      return null;
    }
    const mode: string | undefined = jsonBody.group;
    if (!mode) {
      return null;
    }
    return { group, text, mode };
}

function getBearerToken(headers?: Record<string, string | undefined>): string | undefined {
  const raw = headers?.authorization ?? headers?.Authorization;
  if (!raw) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1];
}

export const http = async (event: HttpEvent) => {
  try {
    if (methodOf(event) !== 'POST') {
      return jsonResponse(405, { error: 'method_not_allowed', hint: 'Use POST with JSON body' });
    }

    // Auth: Authorization: Bearer <token>
    const token = getBearerToken(event.headers);
    if (token !== AUTH_TOKEN) {
      return jsonResponse(401, { error: 'unauthorized' });
    }
    if (!event.body) {
      return jsonResponse(400, { error: 'missing_body' });
    }

    const body: JsonBody | null = parseBody(event.body);
    if (!body) {
      return jsonResponse(400, { error: 'invalid_json' });
    }

    const sockPromise = startSock();

    if (body.text.length > 0 || body.mode === 'raw') {
      const result = await sendTextMessage(body.group, sockPromise, body.text);
      if ((result as any)?.error) return jsonResponse(422, { error: (result as any).error, mode: 'raw' });
      return jsonResponse(200, { ok: true, mode: 'raw', group: body.group, result });
    } else if (body.mode === 'trm') {
      const result = await sendFinancialMessage(body.group, sockPromise);
      if ((result as any)?.error) return jsonResponse(422, { error: (result as any).error, mode: 'trm' });
      return jsonResponse(200, { ok: true, mode: 'trm', group: body.group, result });
    } else {
      return jsonResponse(400, { error: 'invalid_mode' });
    }
  } catch (err: any) {
    console.error('HTTP handler error:', err);
    return jsonResponse(500, { error: 'internal_error', detail: err?.message });
  }
};
