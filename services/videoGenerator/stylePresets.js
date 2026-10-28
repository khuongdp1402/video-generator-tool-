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
  },
  story: {
    id: 'story',
    name: 'Hoạt hình 3D Pixar / Disney',
    badge: '3D Story',
    defaultLayout: 'fullscreen',
    defaultAspectRatio: '9:16',
    characterStyleBlock:
      'Cute 3D Pixar/Disney animation style, cinematic lighting, warm colorful ' +
      'palette, expressive characters, high quality 3D render, 16:9 or 9:16 as specified.',
    directorGuidance:
      'Mỗi scene mô tả một khoảnh khắc rõ ràng trong câu chuyện, nhân vật nhất quán xuyên suốt.',
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
  },
};

const VALID_KINDS = Object.keys(STYLE_PRESETS);

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

function listStylePresets() {
  return Object.values(STYLE_PRESETS);
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
  VALID_KINDS,
  getStylePreset,
  listStylePresets,
  getDimensions,
};
