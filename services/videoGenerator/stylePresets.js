// services/videoGenerator/stylePresets.js
const STYLE_PRESETS = {
  psych_split: {
    id: 'psych_split',
    name: 'Tâm lý học Lành Tâm (Khung 3 tầng · Song ngữ)',
    badge: 'HOT · TikTok Tâm Lý',
    defaultLayout: 'split',
    defaultAspectRatio: '9:16',
    characterStyleBlock:
      'Clean 16:9 psychological illustration animation. Alternate seamlessly between two visual modes depending on scene context: ' +
      '(Mode A - Everyday Behavior / Dialogue): Minimalist black stick-figure pictogram silhouettes (male/female icons) on pure white background with expressive comic speech marks, question marks, sound waves, pointing gestures, flat vector sign style; ' +
      '(Mode B - Deep Psychological Metaphor): Surrealist editorial concept art in moody deep indigo, purple, and glowing cyan lighting, featureless glowing human silhouettes connected by threads, separated by glowing cracks, paper boats on giant hands, floating doors of memory, smooth atmospheric motion.',
    directorGuidance:
      'Phong cách kênh "Lành Tâm - Tâm Lý Học Đời Thường": ' +
      'Các cảnh đầu nêu ví dụ hành vi đời thường dùng Mode A (Pictogram nhân vật đen trên nền trắng tinh, có icon cảm xúc ?!, sóng âm cãi vã). ' +
      'Các cảnh sau phân tích chiều sâu tâm lý học dùng Mode B (Surreal Psychology tông xanh tím trầm phát sáng, ẩn dụ thị giác sâu sắc). ' +
      'Bắt buộc mỗi scene phải có cả lời thoại tiếng Việt ngắn gọn súc tích ("text") VÀ câu dịch tiếng Anh tự nhiên tương ứng ("textEn").',
    directorGuidanceByMarket: {
      US: 'Clean 16:9 psychological illustration animation in dual mode (everyday pictogram vs surreal psychology). Output both concise English text and natural phrasing.',
      JP: '日常生活の行動（ピクトグラム）と深い心理メタファー（シュールアート）を組み合わせた洗練された図解アニメーション。',
      VI: 'Phong cách Lành Tâm: Các cảnh đầu đời thường (Pictogram đen trắng), các cảnh sau phân tích chiều sâu tâm lý (Surreal Neon).',
    },
  },
  pictogram: {
    id: 'pictogram',
    name: 'Pictogram Đen Trắng (Biểu tượng 2D)',
    badge: '2D Icon',
    defaultLayout: 'split',
    defaultAspectRatio: '9:16',
    characterStyleBlock:
      'Minimalist 2D pictogram stick-figure animation, solid black bathroom-sign style human silhouettes on a pure stark white background, expressive comic symbols (exclamation marks, question marks, sound wave lines, thought bubbles, arrows), high contrast black on white, flat clean vector graphic, simple clear body language motion, no 3D, no gradients.',
    directorGuidance:
      'Mỗi scene thể hiện một tình huống đối thoại hoặc phản ứng tâm lý rõ ràng giữa các nhân vật ký hiệu màu đen trên nền trắng, sử dụng biểu tượng trực quan dễ hiểu ngay lập tức.',
    directorGuidanceByMarket: {
      US: 'Minimalist 2D pictogram stick-figure animation, black silhouettes on white background with clear visual symbols.',
      JP: '白背景に黒のピクトグラム記号キャラクターによる、直感的でわかりやすい解説スタイル。',
      VI: 'Mỗi scene thể hiện một tình huống đối thoại hoặc phản ứng tâm lý rõ ràng giữa các nhân vật ký hiệu màu đen trên nền trắng.',
    },
  },
  psych_surreal: {
    id: 'psych_surreal',
    name: 'Ẩn dụ Tâm lý Siêu thực (Surreal Neon)',
    badge: 'Editorial Art',
    defaultLayout: 'split',
    defaultAspectRatio: '9:16',
    characterStyleBlock:
      'Surrealist psychological editorial illustration animation, moody dark indigo and violet atmosphere with glowing cyan and warm amber rim lighting, symbolic visual metaphors (glowing threads between minds, fractured ground separating two silhouettes, giant gentle hands holding paper boats, floating portals and windows), smooth poetic camera pan and subtle particle motion.',
    directorGuidance:
      'Mỗi scene là một ẩn dụ thị giác giàu tính nghệ thuật và chiều sâu tâm lý học, tông màu xanh tím huyền ảo, nhân vật dạng bóng (silhouette) phát sáng nhẹ.',
    directorGuidanceByMarket: {
      US: 'Surrealist psychological editorial illustration animation in moody dark indigo and violet with glowing cyan rim lighting.',
      JP: '深い心理的メタファーを表現した幻想的で美しいシュールレアリスム風アート。',
      VI: 'Mỗi scene là một ẩn dụ thị giác giàu tính nghệ thuật và chiều sâu tâm lý học, tông màu xanh tím huyền ảo.',
    },
  },
  minimalist: {
    id: 'minimalist',
    name: 'Tối giản Đen-Trắng (Dan Koe Style)',
    badge: 'Visual Metaphor',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '9:16',
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
  handdrawn: {
    id: 'handdrawn',
    name: 'Vẽ tay 2D Explainer (Doodle / Sketch)',
    badge: '2D Sketch',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '16:9',
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
  story: {
    id: 'story',
    name: 'Hoạt hình 3D Pixar / Storytelling',
    badge: '3D Pixar',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '9:16',
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
  anime: {
    id: 'anime',
    name: 'Anime Nhật Bản 2D (Makoto Shinkai)',
    badge: 'Anime HD',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '9:16',
    characterStyleBlock:
      'High quality 2D Japanese anime style, Makoto Shinkai and Kyoto Animation inspired, breathtaking dramatic lighting, vibrant cel-shaded colors, detailed expressive anime characters, soft wind and light rays motion, cinematic anime framing.',
    directorGuidance:
      'Mỗi scene mang đậm cảm xúc điện ảnh Anime Nhật Bản, chú trọng ánh sáng, bầu trời, biểu cảm ánh mắt và chuyển động gió/ánh sáng tinh tế.',
    directorGuidanceByMarket: {
      US: 'Cinematic Japanese anime style with expressive characters, dramatic lighting, and scenic backgrounds.',
      JP: '新海誠・京アニ風の美しいライティングと空の描写が際立つ高品質2Dアニメーションスタイル。',
      VI: 'Mỗi scene mang đậm cảm xúc điện ảnh Anime Nhật Bản, chú trọng ánh sáng, bầu trời và biểu cảm.',
    },
  },
  cinematic: {
    id: 'cinematic',
    name: 'Điện ảnh Thực tế 4K (Cinematic)',
    badge: 'Realistic 4K',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '16:9',
    characterStyleBlock:
      'Photorealistic 4K cinematic film footage, shot on ARRI Alexa 65 with anamorphic lens, shallow depth of field, natural skin textures, dramatic volumetric lighting, rich color grading, smooth gimbal camera movement.',
    directorGuidance:
      'Mỗi scene được mô tả như một cú máy điện ảnh thực tế (góc máy cận/trung/toàn, tiêu cự ống kính, ánh sáng tự nhiên và chuyển động máy quay mượt mà).',
    directorGuidanceByMarket: {
      US: 'Photorealistic 4K cinematic footage with shallow depth of field, award-winning film cinematography.',
      JP: '映画クオリティの実写風4Kシネマティックスタイル。自然光と滑らかなカメラワーク。',
      VI: 'Mỗi scene như một cú máy điện ảnh thực tế (góc cận/toàn, ánh sáng tự nhiên, chuyển động mượt mà).',
    },
  },
};

const VALID_KINDS = Object.keys(STYLE_PRESETS);

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

function getStylePreset(kind) {
  const preset = STYLE_PRESETS[kind];
  if (!preset) {
    throw new Error(`Unknown kind: ${kind}. Expected one of: ${VALID_KINDS.join(', ')}`);
  }
  return preset;
}

function listStylePresets() {
  return Object.values(STYLE_PRESETS);
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
  switch (aspectRatio) {
    case '16:9':
      return { width: 1920, height: 1080 };
    case '9:16':
      return { width: 1080, height: 1920 };
    default:
      throw new Error(`Unknown aspect ratio: ${aspectRatio}. Expected 16:9 or 9:16.`);
  }
}

module.exports = {
  STYLE_PRESETS,
  VALID_KINDS,
  MARKET_PRESETS,
  getStylePreset,
  listStylePresets,
  getMarketPreset,
  getDimensions,
};
