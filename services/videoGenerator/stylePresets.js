
const STYLE_PRESETS = {
  story: {
    characterStyleBlock:
      'Cute 3D Pixar/Disney animation style, cinematic lighting, warm colorful ' +
      'palette, expressive characters, high quality 3D render, 16:9 or 9:16 as specified.',
    directorGuidance:
      'Mỗi scene mô tả một khoảnh khắc rõ ràng trong câu chuyện, nhân vật nhất quán xuyên suốt.',
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

function getDimensions(aspectRatio) {
  const dims = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
  if (!dims) {
    throw new Error(`Unknown aspectRatio: ${aspectRatio}`);
  }
  return dims;
}

module.exports = { getStylePreset, getDimensions };
