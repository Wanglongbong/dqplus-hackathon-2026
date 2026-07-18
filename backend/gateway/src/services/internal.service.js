async function internalRequest(baseUrl, path, options = {}) {
  if (!baseUrl) {
    const err = new Error('Internal service is not configured');
    err.status = 503;
    throw err;
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(Number(process.env.INTERNAL_REQUEST_TIMEOUT_MS) || 12000),
    });
  } catch {
    const err = new Error('Internal service is unavailable');
    err.status = 503;
    throw err;
  }
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const err = new Error(payload?.error || 'Internal service request failed');
    err.status = response.status >= 500 ? 503 : response.status;
    throw err;
  }
  return payload;
}

module.exports = { internalRequest };
