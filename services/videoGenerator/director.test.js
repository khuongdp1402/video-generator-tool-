// services/videoGenerator/director.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDirectorPrompt,
  normalizeScenes,
  enforceSceneGoalAlignment,
  validateSceneGoalAlignment,
} = require('./director');

test('story prompt embeds the raw script and asks for JSON only', () => {
  const prompt = buildDirectorPrompt('Ngày xửa ngày xưa có một chú thỏ.', 'story');
  assert.match(prompt, /Ngày xửa ngày xưa có một chú thỏ\./);
  assert.match(prompt, /DUY NHẤT.*JSON/is);
  assert.doesNotMatch(prompt, /pencil|crayon/i);
});

test('handdrawn prompt embeds the hand-drawn style block', () => {
  const prompt = buildDirectorPrompt('Giải thích quang hợp.', 'handdrawn');
  assert.match(prompt, /blue pencil|crayon/i);
  assert.match(prompt, /Giải thích quang hợp\./);
});

test('psych_split prompt asks for bilingual textEn and normalizeScenes uses split_media when layoutMode=split', () => {
  const prompt = buildDirectorPrompt('Thói quen cãi lại là sự bào mòn cảm xúc.', 'psych_split');
  assert.match(prompt, /textEn/);
  assert.match(prompt, /Lành Tâm/);
  const scenes = normalizeScenes(
    [{ text: 'Có một kiểu người', textEn: 'Some people, no matter what', imagePrompt: 'a', videoPrompt: 'b' }],
    { layoutMode: 'split' }
  );
  assert.equal(scenes[0].type, 'split_media');
  assert.equal(scenes[0].textEn, 'Some people, no matter what');
});

test('rejects an empty script', () => {
  assert.throws(() => buildDirectorPrompt('   ', 'story'), /kịch bản/i);
});

test('builds US and JP market-specific director prompts', () => {
  const usPrompt = buildDirectorPrompt('Focus on compound habits every day.', 'story', 'US');
  assert.match(usPrompt, /American English/i);
  assert.match(usPrompt, /en-US/);

  const jpPrompt = buildDirectorPrompt('毎日の小さな習慣が人生を変える。', 'handdrawn', 'JP');
  assert.match(jpPrompt, /日本語/);
  assert.match(jpPrompt, /ja-JP/);
});

test('enforceSceneGoalAlignment and validateSceneGoalAlignment support image_to_video, text_to_video, video_to_video, and image_stitch', () => {
  const rawScene = {
    id: 1,
    text: 'Người trưởng thành chọn sự điềm tĩnh thay vì tranh cãi.',
    highlightWords: ['điềm tĩnh', 'trưởng thành'],
    imagePrompt: 'A calm man sitting by a window',
    videoPrompt: 'Slow push in as rain falls outside',
  };

  for (const mode of ['image_to_video', 'text_to_video', 'video_to_video', 'image_stitch']) {
    const check = validateSceneGoalAlignment(rawScene, {
      kind: 'psych_split',
      generationMode: mode,
      title: 'SỨC MẠNH CỦA SỰ ĐIỀM TĨNH',
      aspectRatio: '9:16',
    });
    assert.equal(check.valid, true);
    assert.equal(check.score, 100);
    assert.equal(check.generationMode, mode);
    assert.match(check.alignedVideoPrompt, /SỨC MẠNH CỦA SỰ ĐIỀM TĨNH/);
    assert.match(check.alignedVideoPrompt, new RegExp(`mode=${mode}`));
  }
});


