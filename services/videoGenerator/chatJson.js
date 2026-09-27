// services/videoGenerator/chatJson.js

class JsonExtractionError extends Error {}

function extractJson(replyText) {
  const fenced = replyText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : findBracedSubstring(replyText);

  if (!candidate) {
    throw new JsonExtractionError('No JSON object found in reply text');
  }

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new JsonExtractionError(`Found a candidate block but it did not parse as JSON: ${err.message}`);
  }
}

function findBracedSubstring(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return text.slice(start, end + 1);
}

module.exports = { extractJson, JsonExtractionError };
