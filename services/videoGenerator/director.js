// services/videoGenerator/director.js
const { getStylePreset, getMarketPreset } = require('./stylePresets');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { sendPromptAndWaitForStableReply } = require('./geminiChat');
const { chatCompletionJson } = require('./agentgwClient');

const VALID_GENERATION_MODES = [
  'text_to_image',
  'image_to_video',
  'text_to_video',
  'video_to_video',
  'image_stitch',
];

function resolveGenerationMode(mode, fallback = 'image_to_video') {
  const normalized = String(mode || '').trim().toLowerCase();
  return VALID_GENERATION_MODES.includes(normalized) ? normalized : fallback;
}

function isShortKeywordInput(rawInput, opts = {}) {
  if (typeof opts.isKeyword === 'boolean') return opts.isKeyword;
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentenceBreaks = (trimmed.match(/[.!?。\n]+/g) || []).length;
  return words.length <= 28 && trimmed.length <= 180 && sentenceBreaks <= 1;
}

/**
 * Đảm bảo imagePrompt & videoPrompt của mỗi scene luôn bám sát 100% mục tiêu kịch bản,
 * chủ đề (title/lessonText), quy tắc nhất quán nhân vật (characterStyleBlock, filmRules),
 * tỉ lệ khung hình (aspectRatio) và chuyển động camera (cameraMotion).
 */
function enforceSceneGoalAlignment(scene = {}, opts = {}) {
  const kind = opts.kind || scene.kind || 'story';
  const preset = getStylePreset(kind);
  const styleBlock = (opts.characterStyleBlock || preset.characterStyleBlock || '').trim();
  const aspectRatio = opts.aspectRatio || scene.aspectRatio || preset.defaultAspectRatio || '9:16';
  const ratioLabel = aspectRatio === '16:9' ? '16:9 widescreen cinematic' : '9:16 vertical full-frame';
  const generationMode = resolveGenerationMode(
    scene.generationMode || opts.generationMode,
    'image_to_video'
  );
  const cameraMotion =
    scene.cameraMotion ||
    opts.cameraMotion ||
    'smooth cinematic camera push-in, natural subject motion, high temporal consistency';

  const coreNarrative = (scene.textEn || scene.text || '').trim();
  const goalTitle = (opts.title || scene.goalAnchor || '').trim();
  const filmRules = (opts.filmRules || '').trim();
  const highlights = Array.isArray(scene.highlightWords) && scene.highlightWords.length > 0
    ? `Key visual focus: ${scene.highlightWords.join(', ')}.`
    : '';

  let baseImagePrompt = (scene.imagePrompt || scene.videoPrompt || coreNarrative || '').trim();
  let baseVideoPrompt = (scene.videoPrompt || scene.imagePrompt || coreNarrative || '').trim();

  // Bổ sung styleBlock nếu chưa có
  const styleProbe = styleBlock.slice(0, 28).toLowerCase();
  if (styleBlock && (!styleProbe || !baseImagePrompt.toLowerCase().includes(styleProbe))) {
    baseImagePrompt = `${baseImagePrompt}. Style: ${styleBlock}`;
  }
  if (styleBlock && (!styleProbe || !baseVideoPrompt.toLowerCase().includes(styleProbe))) {
    baseVideoPrompt = `${baseVideoPrompt}. Style: ${styleBlock}`;
  }

  // Bổ sung mục tiêu cốt lõi của cảnh (Goal Anchor) để video không bị lạc đề
  const goalClause = [
    goalTitle ? `Overall Goal: "${goalTitle}".` : '',
    coreNarrative ? `Scene Action & Meaning: "${coreNarrative}".` : '',
    highlights,
    filmRules ? `Consistency Rules: ${filmRules}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const alignedImagePrompt = [
    `[${ratioLabel} keyframe]`,
    baseImagePrompt,
    goalClause,
    'Strict goal fidelity: accurate subject anatomy, clear visual storytelling matching the script, no unrelated objects or gibberish text.',
  ]
    .filter(Boolean)
    .join(' ');

  const modeMotionDirective =
    generationMode === 'image_to_video'
      ? `Animate the reference keyframe image smoothly (${cameraMotion}) while preserving 100% character identity and composition.`
      : generationMode === 'video_to_video'
      ? `Transform and restyle the reference video motion (${cameraMotion}) while keeping motion timing and fulfilling the scene goal.`
      : `Direct text-to-video generation (${cameraMotion}) with coherent beginning-to-end action.`;

  const alignedVideoPrompt = [
    `[${ratioLabel} video · mode=${generationMode}]`,
    baseVideoPrompt,
    modeMotionDirective,
    goalClause,
    'Strict goal fidelity: coherent physical motion, zero flickering, stay 100% faithful to the required scene objective.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...scene,
    generationMode,
    cameraMotion,
    goalAnchor: goalTitle || coreNarrative.slice(0, 120),
    imagePrompt: scene.imagePrompt || baseImagePrompt,
    videoPrompt: scene.videoPrompt || baseVideoPrompt,
    alignedImagePrompt,
    alignedVideoPrompt,
  };
}

/**
 * Kiểm định mức độ bám sát mục tiêu (Goal Alignment Validation) của scene
 * trước khi gửi sang Muse.ai / Gemini Ultra Veo.
 */
function validateSceneGoalAlignment(scene = {}, opts = {}) {
  const aligned = enforceSceneGoalAlignment(scene, opts);
  const missing = [];
  if (!aligned.text && !aligned.textEn) missing.push('narrative_text');
  if (!aligned.imagePrompt && !aligned.videoPrompt) missing.push('visual_prompt');
  if (!VALID_GENERATION_MODES.includes(aligned.generationMode)) missing.push('valid_generation_mode');

  const hasStyle = Boolean(aligned.alignedVideoPrompt && aligned.alignedVideoPrompt.length > 30);
  if (!hasStyle) missing.push('style_and_goal_context');

  const score = Math.max(0, 100 - missing.length * 25);
  return {
    valid: missing.length === 0,
    score,
    missing,
    generationMode: aligned.generationMode,
    alignedImagePrompt: aligned.alignedImagePrompt,
    alignedVideoPrompt: aligned.alignedVideoPrompt,
  };
}

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
    sceneCount = null,
    filmRules = '',
    sceneRules = [],
    filmAssets = [],
  } = options;

  const isKeyword = isShortKeywordInput(script, options);
  const targetSceneCount =
    Number.isFinite(Number(sceneCount)) && Number(sceneCount) >= 1
      ? Math.min(10, Math.round(Number(sceneCount)))
      : Math.max(2, Math.min(10, Math.round(Number(targetDuration || 30) / 6)));

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

  const inputBlock = isKeyword
    ? `TỪ KHÓA / Ý TƯỞNG GỐC (Keyword do người dùng nhập):\n"""\n${script}\n"""\n` +
      (targetSceneCount === 1
        ? `Hãy từ TỪ KHÓA trên sáng tạo ĐÚNG 1 scene duy nhất cô đọng, giàu hình ảnh và chuyển động điện ảnh rõ nét nhất bám sát 100% từ khóa.`
        : `Hãy TỰ SÁNG TẠO kịch bản câu chuyện/giải thích cuốn hút bám sát 100% TỪ KHÓA trên và triển khai thành ${targetSceneCount} scene (3-8 scene) mạch lạc từ Hook mở đầu đến Kết bài.`)
    : `Kịch bản:\n"""\n${script}\n"""\n` +
      (targetSceneCount === 1
        ? `Tóm lược nội dung trên thành ĐÚNG 1 scene duy nhất giàu hình ảnh nhất.`
        : `Chia kịch bản trên thành khoảng ${targetSceneCount} scene (3-8 scene).`);

  return `Bạn là đạo diễn AI cho hình ảnh & video ngắn chất lượng cao.
${preset.directorGuidance}
${marketRule}
${psychInstruction}

${inputBlock}
${extraContext}
Style hình ảnh/video áp dụng cho MỌI scene (giữ nguyên các từ khoá này trong mỗi videoPrompt/imagePrompt):
"""
${preset.characterStyleBlock}
"""

Trả lời DUY NHẤT một JSON object theo đúng schema sau,
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
      "imagePrompt": "prompt chi tiết tiếng Anh tạo hình ảnh toàn màn hình 1 tầng cho scene này, BẮT BUỘC bao gồm style ở trên",
      "videoPrompt": "prompt chi tiết tiếng Anh mô tả chuyển động camera/nhân vật để tạo video chuyển động cho scene này, bao gồm style ở trên",
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
    return options.returnFullPlan ? res : res.scenes;
  }

  const prompt = buildDirectorPrompt(rawScript, kind, options);
  const preset = getStylePreset(kind);
  const layoutMode = options.layoutMode || preset.defaultLayout || 'fullscreen';

  const formatResult = (parsed) => {
    const scenes = normalizeScenes(parsed.scenes, {
      layoutMode,
      generationMode: options.generationMode,
      sourceVideoPath: options.sourceVideoPath,
    });
    if (options.returnFullPlan) {
      return {
        scenes,
        title: parsed.title || '',
        lessonText: parsed.lessonText || '',
        youtubeMeta: parsed.youtubeMeta || null,
      };
    }
    return scenes;
  };

  let reply;
  try {
    reply = await sendPromptAndWaitForStableReply(page, prompt);
    return formatResult(extractJson(reply));
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) {
      throw err;
    }
    const retryReply = await sendPromptAndWaitForStableReply(
      page,
      'Câu trả lời trước không phải JSON hợp lệ. Trả lời lại DUY NHẤT một JSON object hợp lệ theo đúng schema đã yêu cầu, không thêm text nào khác.'
    );
    return formatResult(extractJson(retryReply));
  }
}

function normalizeScenes(rawScenes, opts = {}) {
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('Director trả về danh sách scene rỗng hoặc không hợp lệ.');
  }
  const sceneType = opts.layoutMode === 'split' ? 'split_media' : 'media';
  const defaultGenMode = resolveGenerationMode(opts.generationMode, 'image_to_video');
  return rawScenes.map((s, i) => ({
    id: i + 1,
    type: s.type || sceneType,
    text: s.text || '',
    textEn: s.textEn || '',
    visualMode: s.visualMode || 'standard',
    generationMode: resolveGenerationMode(s.generationMode, defaultGenMode),
    cameraMotion:
      s.cameraMotion ||
      opts.cameraMotion ||
      'smooth cinematic camera push-in, subtle natural subject motion',
    highlightWords: Array.isArray(s.highlightWords) ? s.highlightWords : [],
    imagePrompt: s.imagePrompt || '',
    videoPrompt: s.videoPrompt || '',
    durationSec: s.durationSec || 6,
    audioFile: s.audioFile || '',
    mediaFile: s.mediaFile || '',
    keyframeFile: s.keyframeFile || '',
    keyframePath: s.keyframePath || opts.keyframePath || '',
    sourceVideoPath: s.sourceVideoPath || opts.sourceVideoPath || '',
    mediaStatus: s.mediaStatus || 'pending',
  }));
}

module.exports = {
  VALID_GENERATION_MODES,
  resolveGenerationMode,
  isShortKeywordInput,
  enforceSceneGoalAlignment,
  validateSceneGoalAlignment,
  buildDirectorPrompt,
  planScenes,
  planScenesWithAgentGW,
  generateMarketScript,
  normalizeScenes,
};
