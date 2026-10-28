// services/videoGenerator/agentgwClient.js
const { extractJson } = require('./chatJson');

const DEFAULT_BASE_URL = 'https://agentgw.cloud/v1';
const DEFAULT_ROOT_URL = 'https://agentgw.cloud';
const DEFAULT_MODEL = 'agentgw-opus-4-8';

function getAgentGwConfig(overrides = {}) {
  const apiKey = (overrides.apiKey || process.env.AGENTGW_API_KEY || '').trim();
  let baseUrl = (overrides.baseUrl || process.env.AGENTGW_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (!baseUrl.endsWith('/v1')) {
    baseUrl = `${baseUrl}/v1`;
  }
  const rootUrl = baseUrl.replace(/\/v1$/, '') || DEFAULT_ROOT_URL;
  const model = (overrides.model || process.env.AGENTGW_MODEL || DEFAULT_MODEL).trim();

  return {
    apiKey,
    baseUrl,
    rootUrl,
    model,
    configured: Boolean(apiKey),
  };
}

/**
 * Kiểm tra trạng thái key và hạn mức token trên agentgw.cloud
 */
async function checkKeyUsage(overrides = {}) {
  const cfg = getAgentGwConfig(overrides);
  if (!cfg.configured) {
    return {
      configured: false,
      valid: false,
      model: cfg.model,
      summary: 'Chưa cấu hình AGENTGW_API_KEY trong .env',
    };
  }

  try {
    const res = await fetch(`${cfg.rootUrl}/v1/usage/brief?format=text&lang=vi`, {
      method: 'GET',
      headers: {
        'x-api-key': cfg.apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    const text = (await res.text()).trim();
    const firstLine = text.split('\n')[0] || '';
    const summary = firstLine.startsWith('AGW|') ? firstLine.slice(4).trim() : firstLine;

    return {
      configured: true,
      valid: res.ok && firstLine.startsWith('AGW|'),
      httpStatus: res.status,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      summary: summary || (res.ok ? 'Key hợp lệ' : `HTTP ${res.status}`),
    };
  } catch (err) {
    return {
      configured: true,
      valid: false,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      summary: `Không kết nối được agentgw.cloud: ${err.message}`,
    };
  }
}

/**
 * Gọi Chat Completions chuẩn OpenAI tới agentgw.cloud/v1/chat/completions
 */
async function chatCompletion({
  messages,
  systemPrompt,
  userPrompt,
  model,
  temperature = 0.7,
  maxTokens = 4096,
  apiKey,
  baseUrl,
  timeoutMs = 120000,
  fetchImpl = fetch,
}) {
  const cfg = getAgentGwConfig({ apiKey, baseUrl, model });
  if (!cfg.configured) {
    throw new Error('Thiếu AGENTGW_API_KEY trong file .env.');
  }

  const finalMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt || '' },
      ];

  const response = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
      'x-api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AgentGW API lỗi HTTP ${response.status}: ${errText.slice(0, 400)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AgentGW API không trả về nội dung message hợp lệ.');
  }
  return content.trim();
}

/**
 * Gọi Chat Completions và parse JSON (kèm 1 lần tự sửa lỗi JSON nếu cần)
 */
async function chatCompletionJson(options) {
  const firstReply = await chatCompletion(options);
  try {
    return extractJson(firstReply);
  } catch (err) {
    const retryMessages = [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: options.userPrompt || '' },
      { role: 'assistant', content: firstReply },
      {
        role: 'user',
        content:
          'Your previous response was not valid JSON. Reply with ONLY a valid JSON object matching the requested schema, with no markdown commentary before or after.',
      },
    ];
    const secondReply = await chatCompletion({ ...options, messages: retryMessages, temperature: 0.2 });
    return extractJson(secondReply);
  }
}

module.exports = {
  getAgentGwConfig,
  checkKeyUsage,
  chatCompletion,
  chatCompletionJson,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
};
