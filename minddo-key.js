const CACHE_SKEW_MS = 0;

let cachedKey = "";
let cachedExpiresAt = 0;
let keyRequest = null;

function makeKeyError(message, fix) {
  const error = new Error(message);
  error.fix = fix;
  return error;
}

function getKeygenConfig() {
  const url = typeof process.env.KEYGEN_URL === "string" ? process.env.KEYGEN_URL.trim().replace(/\/+$/, "") : "";
  const token = typeof process.env.KEYGEN_TOKEN === "string" ? process.env.KEYGEN_TOKEN.trim() : "";
  if (!url || !token || url === "paste-here" || token === "paste-here") {
    throw makeKeyError(
      "Bubbl could not get an AI key from MindDo.",
      "Put your MindDo KEYGEN_URL and KEYGEN_TOKEN in .env, then restart the server."
    );
  }
  return { url, token };
}

function isConfigured() {
  try {
    getKeygenConfig();
    return true;
  } catch (_error) {
    return false;
  }
}

async function requestKey() {
  const { url, token } = getKeygenConfig();
  let response;
  try {
    response = await fetch(`${url}/api/lookup-key`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (_error) {
    throw makeKeyError(
      "Bubbl could not reach MindDo for an AI key.",
      "Check your internet connection and make sure KEYGEN_URL in .env is correct."
    );
  }

  let body = {};
  try {
    body = await response.json();
  } catch (_error) {
    body = {};
  }

  if (!response.ok || typeof body.apiKey !== "string" || !body.apiKey || typeof body.expiresAt !== "string") {
    throw makeKeyError(
      "MindDo could not provide a usable AI key.",
      "Check the MindDo service, KEYGEN_URL, and KEYGEN_TOKEN in .env."
    );
  }

  const expiresAt = Date.parse(body.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw makeKeyError(
      "MindDo returned an expired AI key.",
      "Ask MindDo for a current key and check the service clock."
    );
  }

  cachedKey = body.apiKey;
  cachedExpiresAt = expiresAt;
  return cachedKey;
}

async function getKey({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedKey && cachedExpiresAt - CACHE_SKEW_MS > Date.now()) {
    return cachedKey;
  }
  if (keyRequest) return keyRequest;
  keyRequest = requestKey().finally(() => {
    keyRequest = null;
  });
  return keyRequest;
}

function invalidateKey() {
  cachedKey = "";
  cachedExpiresAt = 0;
}

module.exports = { getKey, invalidateKey, isConfigured };
