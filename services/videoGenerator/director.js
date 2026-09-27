// services/videoGenerator/director.js
const { getStylePreset } = require('./stylePresets');
const { extractJson, JsonExtractionError } = require('./chatJson');
const { sendPromptAndWaitForStableReply } = require('./geminiChat');

function buildDirectorPrompt(rawScript, kind) {
  const script = (rawScript || '').trim();
  if (!script) {
    throw new Error('Thiếu kịch bản — không thể chia scene từ kịch bản rỗng.');
  }
  const preset = getStylePreset(kind);

  return `Bạn là đạo diễn AI cho video ngắn.
${preset.directorGuidance}

Kịch bản:
"""
${script}
"""

Style hình ảnh/video áp dụng cho MỌI scene (giữ nguyên các từ khoá này trong mỗi videoPrompt/imagePrompt):
"""
${preset.characterStyleBlock}
"""

Chia kịch bản trên thành 3-8 scene. Trả lời DUY NHẤT một JSON object theo đúng schema sau,
không thêm bất kỳ text nào khác trước hoặc sau JSON:
{
  "scenes": [
    {
      "text": "đoạn lời thoại/nội dung kịch bản mà scene này thể hiện",
      "imagePrompt": "prompt mô tả chi tiết hình ảnh tĩnh của scene này, bao gồm style ở trên",
      "videoPrompt": "prompt mô tả chuyển động camera/nhân vật để biến ảnh thành video, bao gồm style ở trên",
      "durationSec": 6
    }
  ]
}`;
}

async function planScenes(page, rawScript, kind) {
  const prompt = buildDirectorPrompt(rawScript, kind);

  let reply;
  try {
    reply = await sendPromptAndWaitForStableReply(page, prompt);
    return normalizeScenes(extractJson(reply).scenes);
  } catch (err) {
    if (!(err instanceof JsonExtractionError)) {
      throw err;
    }
    // One retry: ask Gemini to reformat as strict JSON, reusing the same chat context.
    const retryReply = await sendPromptAndWaitForStableReply(
      page,
      'Câu trả lời trước không phải JSON hợp lệ. Trả lời lại DUY NHẤT một JSON object hợp lệ theo đúng schema đã yêu cầu, không thêm text nào khác.'
    );
    return normalizeScenes(extractJson(retryReply).scenes);
  }
}

function normalizeScenes(rawScenes) {
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('Director trả về danh sách scene rỗng hoặc không hợp lệ.');
  }
  return rawScenes.map((s, i) => ({
    id: i + 1,
    type: 'media',
    text: s.text || '',
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
