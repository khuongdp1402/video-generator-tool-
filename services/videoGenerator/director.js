// services/videoGenerator/director.js
const { getStylePreset, getMarketPreset } = require('./stylePresets');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { sendPromptAndWaitForStableReply } = require('./geminiChat');
const { chatCompletionJson } = require('./agentgwClient');

function buildDirectorPrompt(rawScript, kind, opts = {}) {
  const script = (rawScript || '').trim();
  if (!script) {
    throw new Error('Thiếu kịch bản — không thể chia scene từ kịch bản rỗng.');
  }
  const preset = getStylePreset(kind);

  // Normalize options: opts can be a market string or an options object
  const options = typeof opts === 'string' ? { market: opts } : (opts || {});
  const market = options.market || 'VI';
  const marketPreset = getMarketPreset(market);

  const {
    targetDuration = 30,
    filmRules = '',
    sceneRules = [],
    filmAssets = [],
  } = options;

  const targetSceneCount = Math.max(2, Math.min(10, Math.round(Number(targetDuration || 30) / 6)));

  let extraContext = '';
  if (filmRules && filmRules.trim()) {
    extraContext += `\nQuy tắc nhất quán toàn phim:\n"""\n${filmRules.trim()}\n"""\n`;
  }
  if (Array.isArray(sceneRules) && sceneRules.length > 0) {
    extraContext +=
      `\nQuy tắc theo khoảng cảnh:\n` +
      sceneRules.map((r) => `- Cảnh ${r.sceneStart}–${r.sceneEnd} (${r.name}): ${r.rules}`).join('\n') +
      '\n';
  }
  if (Array.isArray(filmAssets) && filmAssets.length > 0) {
    extraContext +=
      `\nDanh sách Nhân vật & Bối cảnh tham chiếu cần giữ nhất quán:\n` +
      filmAssets
        .map(
          (a) =>
            `- [${a.role}] ${a.name}${a.sceneStart ? ` (Cảnh ${a.sceneStart}–${a.sceneEnd})` : ''}: ${
              a.description || 'Giữ đúng nhận diện ảnh tham chiếu'
            }`
        )
        .join('\n') +
      '\n';
  }

  const marketRule =
    marketPreset.code === 'US'
      ? `\nThị trường mục tiêu: MỸ (US - English).\n` +
        `- Nếu kịch bản đầu vào bằng tiếng Việt hoặc ngôn ngữ khác, hãy BẢN ĐỊA HÓA / VIẾT LẠI hoàn toàn lời thoại ("text" của mỗi scene, "lessonText", "youtubeMeta") sang TIẾNG ANH MỸ (American English) tự nhiên, cuốn hút, chuẩn văn phong YouTube Shorts Mỹ.\n` +
        `- ${marketPreset.scriptInstruction}\n` +
        `- "highlightWords" gồm 1-3 từ khóa tiếng Anh đắt giá nhất trong câu thoại của scene đó.`
      : marketPreset.code === 'JP'
      ? `\nThị trường mục tiêu: NHẬT BẢN (JP - 日本語).\n` +
        `- Nếu kịch bản đầu vào bằng tiếng Việt hoặc ngôn ngữ khác, hãy BẢN ĐỊA HÓA / VIẾT LẠI hoàn toàn lời thoại ("text" của mỗi scene, "lessonText", "youtubeMeta") sang TIẾNG NHẬT BẢN XỨ (自然な日本語) chuẩn văn phong YouTubeショート Nhật Bản, tuyệt đối tránh văn phong dịch máy cứng nhắc.\n` +
        `- ${marketPreset.scriptInstruction}\n` +
        `- "highlightWords" gồm 1-3 cụm từ khóa tiếng Nhật quan trọng nhất trong câu thoại của scene đó.`
      : `\nThị trường mục tiêu: VIỆT NAM (VI - Tiếng Việt).\n` +
        `- ${marketPreset.scriptInstruction}\n` +
        `- "highlightWords" gồm 1-3 từ khóa nổi bật trong câu thoại.`;

  const psychInstruction =
    kind === 'psych_split'
      ? `\nLƯU Ý ĐẶC BIỆT CHO PHONG CÁCH TÂM LÝ HỌC LÀNH TÂM (psych_split):\n` +
        `- Bắt buộc mỗi scene phải có 2 trường thoại: "text" (tiếng Việt súc tích để đọc voiceover) VÀ "textEn" (câu dịch tiếng Anh chuẩn tự nhiên để hiện khung phụ đề tiếng Anh bên dưới).\n` +
        `- Gán "visualMode": "mode_a" cho cảnh đời thường/đối thoại (Pictogram đen trắng), hoặc "mode_b" cho cảnh phân tích chiều sâu tâm lý (Surreal Neon xanh tím).\n`
      : '';

  return `Bạn là đạo diễn AI cho video ngắn.
${preset.directorGuidance}
${marketRule}
${psychInstruction}

Kịch bản:
"""
${script}
"""
${extraContext}
Style hình ảnh/video áp dụng cho MỌI scene (giữ nguyên các từ khoá này trong mỗi videoPrompt/imagePrompt):
"""
${preset.characterStyleBlock}
"""

Chia kịch bản trên thành khoảng ${targetSceneCount} scene (3-8 scene). Trả lời DUY NHẤT một JSON object theo đúng schema sau,
không thêm bất kỳ text nào khác trước hoặc sau JSON:
{
  "title": "Tiêu đề video bằng ngôn ngữ của thị trường ${marketPreset.code}",
  "lessonText": "1 câu bài học cốt lõi / thông điệp đắt giá cuối video bằng ngôn ngữ ${marketPreset.code}",
  "youtubeMeta": {
    "title": "Tiêu đề YouTube Shorts chuẩn SEO (kèm #Shorts) bằng ngôn ngữ ${marketPreset.code}",
    "description": "Mô tả YouTube hấp dẫn kèm hashtags bằng ngôn ngữ ${marketPreset.code}",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "scenes": [
    {
      "id": 1,
      "text": "đoạn lời thoại/nội dung kịch bản mà scene này thể hiện (bằng ngôn ngữ ${marketPreset.locale})",
      "textEn": "bilingual English subtitle translation if psych_split",
      "visualMode": "mode_a hoặc mode_b (nếu psych_split)",
      "highlightWords": ["từ1", "từ2"],
      "imagePrompt": "prompt chi tiết tiếng Anh tạo hình ảnh cho scene này, BẮT BUỘC bao gồm style ở trên",
      "videoPrompt": "prompt chi tiết tiếng Anh mô tả chuyển động camera/nhân vật để biến ảnh thành video, bao gồm style ở trên",
      "durationSec": 6
    }
  ]
}`;
}

async function planScenesWithAgentGW(rawScript, kind, market = 'US', opts = {}) {
  const prompt = buildDirectorPrompt(rawScript, kind, { ...opts, market });
  const parsed = await chatCompletionJson({
    systemPrompt:
      'You are an elite multimodal video director and cross-cultural localization expert for US (English) and Japan (Japanese) YouTube channels. Always output strict valid JSON only.',
    userPrompt: prompt,
    model: opts.model,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    fetchImpl: opts.fetchImpl,
  });

  const scenes = normalizeScenes(parsed.scenes, { layoutMode: opts.layoutMode });
  return {
    scenes,
    title: parsed.title || '',
    lessonText: parsed.lessonText || '',
    youtubeMeta: parsed.youtubeMeta || null,
  };
}

async function generateMarketScript(topicOrDraft, kind = 'story', market = 'US', opts = {}) {
  const text = (topicOrDraft || '').trim();
  if (!text) {
    throw new Error('Vui lòng nhập chủ đề hoặc ý tưởng kịch bản.');
  }
  const marketPreset = getMarketPreset(market);
  const stylePreset = getStylePreset(kind);

  const prompt = `Bạn là biên kịch YouTube Shorts / Reels triệu view chuyên nghiệp cho thị trường ${marketPreset.name}.
Chủ đề / Ý tưởng / Kịch bản gốc:
"""
${text}
"""

Phong cách hình ảnh dự kiến: ${stylePreset.characterStyleBlock}
Yêu cầu ngôn ngữ & văn phong:
${marketPreset.scriptInstruction}

Hãy viết một kịch bản hoàn chỉnh bằng ngôn ngữ ${marketPreset.locale} (dù đầu vào là tiếng Việt hay ngôn ngữ nào khác, đầu ra PHẢI 100% bằng ngôn ngữ ${marketPreset.locale} bản xứ tự nhiên).
Trả lời DUY NHẤT một JSON object theo schema:
{
  "title": "Tiêu đề ngắn gọn (${marketPreset.locale})",
  "script": "Toàn bộ lời thoại kịch bản hoàn chỉnh (5-8 câu, tách dòng rõ ràng, có Hook 3s đầu cực mạnh, nhịp nhanh, kết có tính lặp loop)",
  "lessonText": "1 câu bài học đắt giá chốt lại cuối video (${marketPreset.locale})",
  "youtubeMeta": {
    "title": "Tiêu đề đăng YouTube Shorts hấp dẫn kèm #Shorts (${marketPreset.locale})",
    "description": "Mô tả video chuẩn SEO kèm hashtags (${marketPreset.locale})",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }
}`;

  const parsed = await chatCompletionJson({
    systemPrompt:
      'You are a viral YouTube scriptwriter for the US and Japanese markets. Output strict JSON only.',
    userPrompt: prompt,
    model: opts.model,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    fetchImpl: opts.fetchImpl,
  });

  return {
    ...parsed,
    market: marketPreset.code,
    title: parsed.title || parsed.youtubeMeta?.title || '',
    rawScript: parsed.rawScript || parsed.script || '',
    script: parsed.script || parsed.rawScript || '',
    lessonText: parsed.lessonText || '',
    youtubeDescription: parsed.youtubeDescription || parsed.youtubeMeta?.description || '',
    youtubeTags: parsed.youtubeTags || parsed.youtubeMeta?.tags || marketPreset.youtubeTags || [],
  };
}

async function planScenes(page, rawScript, kind, opts = {}) {
  const options = typeof opts === 'string' ? { market: opts } : (opts || {});
  if (!page) {
    const res = await planScenesWithAgentGW(rawScript, kind, options.market || 'US', options);
    return res.scenes;
  }

  const prompt = buildDirectorPrompt(rawScript, kind, options);
  const preset = getStylePreset(kind);
  const layoutMode = options.layoutMode || preset.defaultLayout || 'fullscreen';

  let reply;
  try {
    reply = await sendPromptAndWaitForStableReply(page, prompt);
    return normalizeScenes(extractJson(reply).scenes, { layoutMode });
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) {
      throw err;
    }
    const retryReply = await sendPromptAndWaitForStableReply(
      page,
      'Câu trả lời trước không phải JSON hợp lệ. Trả lời lại DUY NHẤT một JSON object hợp lệ theo đúng schema đã yêu cầu, không thêm text nào khác.'
    );
    return normalizeScenes(extractJson(retryReply).scenes, { layoutMode });
  }
}

function normalizeScenes(rawScenes, opts = {}) {
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('Director trả về danh sách scene rỗng hoặc không hợp lệ.');
  }
  const sceneType = opts.layoutMode === 'split' ? 'split_media' : 'media';
  return rawScenes.map((s, i) => ({
    id: i + 1,
    type: s.type || sceneType,
    text: s.text || '',
    textEn: s.textEn || '',
    visualMode: s.visualMode || 'standard',
    highlightWords: Array.isArray(s.highlightWords) ? s.highlightWords : [],
    imagePrompt: s.imagePrompt || '',
    videoPrompt: s.videoPrompt || '',
    durationSec: s.durationSec || 6,
    audioFile: s.audioFile || '',
    mediaFile: s.mediaFile || '',
    mediaStatus: s.mediaStatus || 'pending',
  }));
}

module.exports = {
  buildDirectorPrompt,
  planScenes,
  planScenesWithAgentGW,
  generateMarketScript,
  normalizeScenes,
};
