// services/videoGenerator/director.js
const { getStylePreset } = require('./stylePresets');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { sendPromptAndWaitForStableReply } = require('./geminiChat');

function buildDirectorPrompt(rawScript, kind, opts = {}) {
  const script = (rawScript || '').trim();
  if (!script) {
    throw new Error('Thiếu kịch bản — không thể chia scene từ kịch bản rỗng.');
  }
  const preset = getStylePreset(kind);
  const {
    targetDuration = 30,
    filmRules = '',
    sceneRules = [],
    filmAssets = [],
  } = opts;

  const targetSceneCount = Math.max(2, Math.min(10, Math.round(Number(targetDuration || 30) / 6)));

  let extraContext = '';
  if (filmRules && filmRules.trim()) {
    extraContext += `\nQuy tắc nhất quán toàn phim:\n"""\n${filmRules.trim()}\n"""\n`;
  }
  if (Array.isArray(sceneRules) && sceneRules.length > 0) {
    extraContext += `\nQuy tắc theo khoảng cảnh:\n` +
      sceneRules.map((r) => `- Cảnh ${r.sceneStart}–${r.sceneEnd} (${r.name}): ${r.rules}`).join('\n') + '\n';
  }
  if (Array.isArray(filmAssets) && filmAssets.length > 0) {
    extraContext += `\nDanh sách Nhân vật & Bối cảnh tham chiếu cần giữ nhất quán:\n` +
      filmAssets.map((a) => `- [${a.role}] ${a.name}${a.sceneStart ? ` (Cảnh ${a.sceneStart}–${a.sceneEnd})` : ''}: ${a.description || 'Giữ đúng nhận diện ảnh tham chiếu'}`).join('\n') + '\n';
  }

  return `Bạn là đạo diễn AI cho video ngắn.
${preset.directorGuidance}

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
  "scenes": [
    {
      "text": "đoạn lời thoại tiếng Việt ngắn gọn, súc tích mà scene này thể hiện",
      "textEn": "concise, natural English translation of the Vietnamese line above for bilingual subtitles",
      "visualMode": "pictogram hoặc surreal hoặc standard",
      "imagePrompt": "prompt tiếng Anh mô tả chi tiết hình ảnh tĩnh của scene này, bao gồm style ở trên",
      "videoPrompt": "prompt tiếng Anh mô tả chuyển động camera/nhân vật để biến ảnh thành video, bao gồm style ở trên",
      "durationSec": 6
    }
  ]
}`;
}

async function planScenes(page, rawScript, kind, opts = {}) {
  const prompt = buildDirectorPrompt(rawScript, kind, opts);
  const preset = getStylePreset(kind);
  const layoutMode = opts.layoutMode || preset.defaultLayout || 'fullscreen';

  let reply;
  try {
    reply = await sendPromptAndWaitForStableReply(page, prompt);
    return normalizeScenes(extractJson(reply).scenes, { layoutMode });
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) {
      throw err;
    }
    // One retry: ask Gemini to reformat as strict JSON, reusing the same chat context.
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
    imagePrompt: s.imagePrompt || '',
    videoPrompt: s.videoPrompt || '',
    durationSec: s.durationSec || 6,
    audioFile: '',
    durationInFrames: Math.round((s.durationSec || 6) * 30),
    mediaStatus: 'pending',
    mediaFile: null,
  }));
}

module.exports = { buildDirectorPrompt, planScenes, normalizeScenes };
