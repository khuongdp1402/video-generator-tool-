// services/videoGenerator/promptWriter.js
const fs = require('fs');
const path = require('path');

const DEFAULT_SKILLS = [
  {
    id: 'skill_lanh_tam_psych',
    name: '🧠 Tâm lý học Lành Tâm (Khung 3 tầng · Pictogram & Ẩn dụ)',
    instructions:
      'Viết kịch bản tâm lý học đời thường sâu sắc, chạm cảm xúc theo phong cách kênh "Lành Tâm". ' +
      'Cấu trúc gồm: (1) Mở đầu nêu một thói quen/hành vi dễ gặp trong giao tiếp hoặc tình cảm (dùng hình ảnh Pictogram 2 nhân vật đen trên nền trắng đối thoại/tranh luận); ' +
      '(2) Phân tích cảm giác tổn thương, tự nghi ngờ bản thân của người nghe; ' +
      '(3) Giải thích khái niệm tâm lý học đằng sau bằng ẩn dụ thị giác siêu thực (sợi dây cảm xúc, vết nứt, con thuyền giấy); ' +
      '(4) Kết lại bằng lời khuyên chữa lành ngắn gọn.',
  },
  {
    id: 'skill_pixar_story',
    name: '🎬 Kể chuyện 3D Pixar & Bài học cuộc sống',
    instructions:
      'Viết kịch bản câu chuyện ngụ ngôn hoặc tình huống đời sống theo phong cách hoạt hình 3D Pixar ấm áp. ' +
      'Mô tả rõ ngoại hình nhân vật cố định xuyên suốt các cảnh, bối cảnh giàu ánh sáng điện ảnh và kết thúc bằng một bài học ý nghĩa.',
  },
  {
    id: 'skill_handdrawn_explainer',
    name: '✏️ Giải thích kiến thức 2D Hand-drawn (Doodle)',
    instructions:
      'Viết kịch bản giải thích một khái niệm khoa học, tài chính hoặc kỹ năng sống theo phong cách vẽ tay 2D bút chì xanh trên nền giấy kem. ' +
      'Chia thành các ý ngắn gọn, mỗi cảnh minh họa bằng một sơ đồ hoặc nhân vật nét vẽ đơn giản, dí dỏm.',
  },
  {
    id: 'skill_minimalist_dankoe',
    name: '⚫ Triết lý Tối giản Đen-Trắng (Dan Koe Style)',
    instructions:
      'Viết kịch bản phát triển bản thân, kỷ luật và tư duy theo phong cách tối giản nét trắng trên nền đen tuyền. ' +
      'Mỗi câu tương ứng với 1 biểu tượng hình học hoặc ẩn dụ trực quan mạnh mẽ (cái phễu, chiếc cân, bậc thang, đồng hồ cát, chìa khóa).',
  },
  {
    id: 'skill_kol_review',
    name: '🛍️ Review Sản phẩm / Thời trang KOL',
    instructions:
      'Viết prompt tạo video giới thiệu sản phẩm hoặc thời trang tự nhiên, tập trung vào chất liệu, form dáng, chuyển động camera mượt mà, ánh sáng studio hoặc dạo phố hiện đại, không tự bịa giá bán.',
  },
  {
    id: 'skill_short_film_10s',
    name: '🎞️ Phim ngắn Điện ảnh nối cảnh (10s / cảnh)',
    instructions:
      'Chia câu chuyện thành chuỗi các cảnh quay 10 giây nối tiếp nhau. ' +
      'Ghi rõ Cảnh 1, Cảnh 2, Cảnh 3... Mỗi cảnh mô tả góc máy, ánh sáng, hành động tiếp nối từ khung hình cuối của cảnh trước để nối mượt mà.',
  },
];

const DEFAULT_PROFILES = [
  {
    id: 'prof_gemini_web_free',
    name: 'Google Gemini Ultra Web (Miễn phí 100% qua Chrome CDP)',
    provider: 'gemini_web',
    model: 'gemini-ultra-web',
    apiKey: '',
    verifyStatus: 'valid',
  },
];

const CURATED_MODELS = {
  gemini_web: [
    { id: 'gemini-ultra-web', name: '🌟 Gemini Ultra Web (Chạy qua Chrome CDP - Không tốn phí API)', recommended: true },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: '⚡ Gemini 2.5 Flash (Nhanh & Miễn phí 15 RPM)', recommended: true },
    { id: 'gemini-2.5-pro', name: '🧠 Gemini 2.5 Pro (Sáng tạo kịch bản chuyên sâu)' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: '🐳 DeepSeek V3 (Kịch bản tiếng Việt mượt mà)', recommended: true },
    { id: 'deepseek-reasoner', name: '🔬 DeepSeek R1 (Tư duy logic sâu)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: '🤖 GPT-4o Mini (Nhanh & Tiết kiệm)', recommended: true },
    { id: 'gpt-4o', name: '🚀 GPT-4o (Chất lượng cao nhất)' },
  ],
};

function createPromptWriterStore(dataFile) {
  function getDb() {
    if (fs.existsSync(dataFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        return {
          profiles: parsed.profiles && parsed.profiles.length ? parsed.profiles : [...DEFAULT_PROFILES],
          skills: parsed.skills && parsed.skills.length ? parsed.skills : [...DEFAULT_SKILLS],
        };
      } catch (e) {
        return { profiles: [...DEFAULT_PROFILES], skills: [...DEFAULT_SKILLS] };
      }
    }
    return { profiles: [...DEFAULT_PROFILES], skills: [...DEFAULT_SKILLS] };
  }

  function saveDb(db) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
  }

  function getState() {
    const db = getDb();
    return {
      profiles: db.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        model: p.model,
        verify_status: p.verifyStatus || 'valid',
        has_key: Boolean(p.apiKey),
      })),
      skills: db.skills,
    };
  }

  function getModelsForProvider(provider = 'gemini_web') {
    return CURATED_MODELS[provider] || CURATED_MODELS.gemini_web;
  }

  function upsertProfile({ id, name, provider = 'gemini', model = 'gemini-2.5-flash', api_key = '' }) {
    const db = getDb();
    let profile = id ? db.profiles.find((p) => p.id === id) : null;
    if (profile) {
      profile.name = (name || profile.name).trim();
      profile.provider = provider || profile.provider;
      profile.model = model || profile.model;
      if (api_key && api_key.trim()) profile.apiKey = api_key.trim();
      profile.verifyStatus = 'valid';
    } else {
      profile = {
        id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: (name || `${provider.toUpperCase()} Profile`).trim(),
        provider,
        model,
        apiKey: (api_key || '').trim(),
        verifyStatus: 'valid',
      };
      db.profiles.push(profile);
    }
    saveDb(db);
    return profile;
  }

  function deleteProfile(id) {
    const db = getDb();
    db.profiles = db.profiles.filter((p) => p.id !== id);
    if (db.profiles.length === 0) db.profiles = [...DEFAULT_PROFILES];
    saveDb(db);
    return { deleted: true };
  }

  function upsertSkill({ id, name, instructions }) {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Vui lòng nhập tên Skill');
    const db = getDb();
    let skill = id ? db.skills.find((s) => s.id === id) : null;
    if (skill) {
      skill.name = cleanName;
      skill.instructions = (instructions || '').trim();
    } else {
      skill = {
        id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        instructions: (instructions || '').trim(),
      };
      db.skills.push(skill);
    }
    saveDb(db);
    return skill;
  }

  function deleteSkill(id) {
    const db = getDb();
    db.skills = db.skills.filter((s) => s.id !== id);
    saveDb(db);
    return { deleted: true };
  }

  async function callAiText(profile, promptText, chatRunner = null) {
    if (!profile || profile.provider === 'gemini_web' || !profile.apiKey) {
      if (typeof chatRunner === 'function') {
        return await chatRunner(promptText);
      }
      return buildOfflineFallbackScript(promptText);
    }

    if (profile.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        profile.model || 'gemini-2.5-flash'
      )}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error && data.error.message) || 'Lỗi gọi Gemini API');
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const baseUrl =
      profile.provider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.apiKey}`,
      },
      body: JSON.stringify({
        model: profile.model || (profile.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
        messages: [{ role: 'user', content: promptText }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data.error && data.error.message) || `Lỗi gọi ${profile.provider} API`);
    }
    return data.choices?.[0]?.message?.content || '';
  }

  function buildOfflineFallbackScript(promptText) {
    const topicMatch = promptText.match(/Ý tưởng \/ Chủ đề:\s*"""([\s\S]*?)"""/);
    const topic = (topicMatch ? topicMatch[1] : promptText).trim().slice(0, 200);
    return (
      `Có một kiểu người trong cuộc sống liên quan đến "${topic}": dù bạn nói gì đi nữa, phản xạ đầu tiên của họ luôn khiến bạn phải suy nghĩ.\n` +
      `Thật ra trong tâm lý học, đằng sau hành vi ấy thường là một cơ chế phòng vệ tâm lý vô thức mà chính họ cũng không nhận ra.\n` +
      `Vì vậy, thay vì tự nghi ngờ giá trị bản thân mình, hãy học cách giữ ranh giới cảm xúc bình tĩnh và vững vàng.`
    );
  }

  async function generateSingle({ brief, skillId, profileId, duration = 30, ratio = '9:16' }, chatRunner = null) {
    const cleanBrief = (brief || '').trim();
    if (!cleanBrief) throw new Error('Vui lòng nhập ý tưởng hoặc nội dung tóm tắt');
    const db = getDb();
    const skill = db.skills.find((s) => s.id === skillId) || db.skills[0];
    const profile = db.profiles.find((p) => p.id === profileId) || db.profiles[0];

    const fullPrompt = `Bạn là biên kịch & đạo diễn video AI chuyên nghiệp.
Quy tắc Skill (${skill.name}):
${skill.instructions}

Thời lượng mục tiêu: ${duration} giây · Khung hình: ${ratio}
Ý tưởng / Chủ đề:
"""
${cleanBrief}
"""

Hãy viết ngay kịch bản / prompt hoàn chỉnh, giàu hình ảnh, sẵn sàng đưa sang bộ tạo video. Chỉ trả lời nội dung kịch bản, không thêm lời bình luận thừa.`;

    const output = await callAiText(profile, fullPrompt, chatRunner);
    return { prompt: output.trim(), skill: skill.name, profile: profile.name };
  }

  async function generateBulk(
    { submode = 'variations', brief = '', count = 3, sets = [], skillId, profileId, duration = 30, ratio = '9:16' },
    chatRunner = null
  ) {
    const db = getDb();
    const skill = db.skills.find((s) => s.id === skillId) || db.skills[0];
    const profile = db.profiles.find((p) => p.id === profileId) || db.profiles[0];
    const results = [];

    if (submode === 'sets' && Array.isArray(sets) && sets.length > 0) {
      for (const s of sets) {
        const num = Math.max(1, Math.min(10, Number(s.count) || 1));
        for (let i = 0; i < num; i++) {
          const itemBrief = `${brief ? brief + ' — ' : ''}${s.name || 'Bộ ảnh'}: ${s.note || 'Sáng tạo góc máy và chuyển động ấn tượng'}${num > 1 ? ` (Biến thể #${i + 1})` : ''}`;
          const single = await generateSingle(
            { brief: itemBrief, skillId: skill.id, profileId: profile.id, duration, ratio },
            chatRunner
          );
          results.push({
            set_name: s.name || 'Bộ ảnh',
            prompt: single.prompt,
          });
        }
      }
      return { prompts: results };
    }

    const total = Math.max(1, Math.min(20, Number(count) || 3));
    if (!brief || !brief.trim()) {
      throw new Error('Vui lòng nhập ý tưởng chung để tạo hàng loạt');
    }
    for (let i = 1; i <= total; i++) {
      const varBrief = `${brief.trim()}\n(Yêu cầu: Viến thể góc nhìn/kịch bản số #${i}/${total}, tạo sự mới mẻ và cuốn hút ngay từ 3 giây đầu)`;
      const single = await generateSingle(
        { brief: varBrief, skillId: skill.id, profileId: profile.id, duration, ratio },
        chatRunner
      );
      results.push({
        set_name: `Biến thể #${i}`,
        prompt: single.prompt,
      });
    }
    return { prompts: results };
  }

  return {
    getDb,
    getState,
    getModelsForProvider,
    upsertProfile,
    deleteProfile,
    upsertSkill,
    deleteSkill,
    generateSingle,
    generateBulk,
  };
}

const defaultPwFile = path.join(__dirname, '..', '..', 'storage', 'prompt_writer.json');
const defaultPwStore = createPromptWriterStore(defaultPwFile);

module.exports = { createPromptWriterStore, DEFAULT_SKILLS, DEFAULT_PROFILES, ...defaultPwStore };
