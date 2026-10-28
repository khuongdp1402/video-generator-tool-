const STYLE_PRESETS = {
  story: {
    characterStyleBlock:
      'Cute 3D Pixar/Disney animation style, cinematic lighting, warm colorful ' +
      'palette, expressive characters, high quality 3D render, 16:9 or 9:16 as specified.',
    directorGuidance:
      'Mỗi scene mô tả một khoảnh khắc rõ ràng trong câu chuyện, nhân vật nhất quán xuyên suốt.',
    directorGuidanceByMarket: {
      US: 'Each scene depicts a vivid, emotionally engaging moment in the story with consistent characters and fast-paced American storytelling.',
      JP: '各シーンは物語の明確で感情に響く瞬間を描写し、日本の視聴者が共感しやすい自然な展開と一貫したキャラクターを維持してください。',
      VI: 'Mỗi scene mô tả một khoảnh khắc rõ ràng trong câu chuyện, nhân vật nhất quán xuyên suốt.',
    },
  },
  handdrawn: {
    characterStyleBlock:
      'Minimalist hand-drawn 2D explainer animation, doodle animation, sketch animation ' +
      'style, blue pencil/crayon line art, loose sketchy outlines, cream paper texture ' +
      'background, simple flat cartoon characters, no shading, subtle wobble linework, ' +
      'no 3D render, no photorealism, gentle motion only (blinking, slow pan/zoom).',
    directorGuidance:
      'Mỗi scene mô tả một ý đơn giản, phù hợp video giải thích (explainer), nhân vật ' +
      'và phong cách nét vẽ phải nhất quán xuyên suốt tất cả các scene.',
    directorGuidanceByMarket: {
      US: 'Each scene illustrates a single crisp concept suitable for a viral 2D explainer video, keeping character design and sketchy line art consistent throughout.',
      JP: '各シーンは解説動画（雑学・図解スタイル）に適したシンプルな1つのアイデアを表現し、手描きスケッチの線画スタイルを一貫させてください。',
      VI: 'Mỗi scene mô tả một ý đơn giản, phù hợp video giải thích (explainer), nhân vật và phong cách nét vẽ phải nhất quán xuyên suốt tất cả các scene.',
    },
  },
  minimalist: {
    characterStyleBlock:
      'Minimalist high-contrast 2D explainer animation, visual metaphor, clean geometric white line art on pure black background, Dan Koe style, iconic symbolic illustrations, crisp vector linework, subtle smooth motion, no realistic textures, no 3D rendering.',
    directorGuidance:
      'Mỗi scene tập trung vào 1 biểu tượng ẩn dụ thị giác duy nhất (cân, bóng đèn, phễu, bậc thang, chìa khóa). Tương phản cao đen/trắng, tối giản tuyệt đối.',
    directorGuidanceByMarket: {
      US: 'Each scene focuses on a single high-contrast visual metaphor (scale, lightbulb, funnel, staircase, key) in Dan Koe minimalist black-and-white style.',
      JP: '各シーンは1つの象徴的な視覚的メタファー（天秤、電球、階段、鍵など）に焦点を当て、黒背景に白線のミニマルで洗練された図解で表現してください。',
      VI: 'Mỗi scene tập trung vào 1 biểu tượng ẩn dụ thị giác duy nhất (cân, bóng đèn, phễu, bậc thang, chìa khóa). Tương phản cao đen/trắng, tối giản tuyệt đối.',
    },
  },
};

const MARKET_PRESETS = {
  US: {
    code: 'US',
    name: 'Mỹ (US - English)',
    language: 'en',
    locale: 'en-US',
    defaultVoice: 'en-US-AndrewMultilingualNeural',
    voices: [
      { id: 'en-US-AndrewMultilingualNeural', label: 'Andrew (Nam Mỹ - Ấm, Kể chuyện/Triết lý)' },
      { id: 'en-US-BrianNeural', label: 'Brian (Nam Mỹ - Năng lượng, Shorts/Explainer)' },
      { id: 'en-US-AvaMultilingualNeural', label: 'Ava (Nữ Mỹ - Tự nhiên, Hiện đại)' },
      { id: 'en-US-EmmaMultilingualNeural', label: 'Emma (Nữ Mỹ - Dịu dàng, Tâm lý học)' },
    ],
    defaultVoiceRate: '+3%',
    lessonTitle: 'Key Takeaway',
    youtubeCategoryId: '27',
    defaultTags: ['Shorts', 'Mindset', 'Psychology', 'Stoicism', 'SelfImprovement'],
    scriptInstruction:
      'Write the narration in natural, high-retention American English optimized for YouTube Shorts/Reels. ' +
      'Start with a scroll-stopping 3-second hook (curiosity gap or contrarian truth), use punchy spoken sentences (no fluff), ' +
      'and end with a loopable conclusion or crisp call-to-action.',
  },
  JP: {
    code: 'JP',
    name: 'Nhật Bản (JP - 日本語)',
    language: 'ja',
    locale: 'ja-JP',
    defaultVoice: 'ja-JP-KeitaNeural',
    voices: [
      { id: 'ja-JP-KeitaNeural', label: 'Keita - 圭太 (Nam Nhật - Rõ ràng, Tóm tắt sách/雑学)' },
      { id: 'ja-JP-NanamiNeural', label: 'Nanami - 七海 (Nữ Nhật - Tự nhiên, Kể chuyện/Tâm lý)' },
    ],
    defaultVoiceRate: '+0%',
    lessonTitle: '今日の教訓',
    youtubeCategoryId: '27',
    defaultTags: ['Shorts', '雑学', '心理学', '人生哲学', '自己啓発', '本の要約'],
    scriptInstruction:
      'ナレーションは日本のYouTubeショートでバズりやすい、自然で耳馴染みの良い日本語（丁寧な語りかけ、または引き込まれる解説調）で作成してください。' +
      '不自然な直訳調は避け、冒頭2秒で視聴者の指を止める強力なフック（疑問提起や意外な事実）から始め、テンポよく展開し、最後にフォローを促す一言を入れてください。',
  },
  VI: {
    code: 'VI',
    name: 'Việt Nam (VI - Tiếng Việt)',
    language: 'vi',
    locale: 'vi-VN',
    defaultVoice: 'vi-VN-NamMinhNeural',
    voices: [
      { id: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Nam Việt - Trầm ấm)' },
      { id: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Nữ Việt - Tự nhiên)' },
    ],
    defaultVoiceRate: '+0%',
    lessonTitle: 'Bài học rút ra',
    youtubeCategoryId: '22',
    defaultTags: ['Shorts', 'baihoccuocsong', 'trietly', 'phattrienbanthan'],
    scriptInstruction:
      'Viết lời thoại bằng tiếng Việt tự nhiên, súc tích, thu hút người xem ngay 3 giây đầu và có nhịp điệu nhanh gọn phù hợp YouTube Shorts / TikTok.',
  },
};

const DIMENSIONS_BY_ASPECT_RATIO = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

function getStylePreset(kind) {
  const preset = STYLE_PRESETS[kind];
  if (!preset) {
    throw new Error(`Unknown kind: ${kind}`);
  }
  return preset;
}

function getMarketPreset(market = 'VI') {
  const normalized = String(market || 'VI').toUpperCase();
  const preset = MARKET_PRESETS[normalized];
  if (!preset) {
    throw new Error(`Unknown market: ${market}. Expected one of: ${Object.keys(MARKET_PRESETS).join(', ')}`);
  }
  return preset;
}

function getDimensions(aspectRatio) {
  const dims = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
  if (!dims) {
    throw new Error(`Unknown aspectRatio: ${aspectRatio}`);
  }
  return dims;
}

module.exports = {
  STYLE_PRESETS,
  MARKET_PRESETS,
  getStylePreset,
  getMarketPreset,
  getDimensions,
};
