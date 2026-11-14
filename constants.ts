// Legacy constants file. Most data now lives in Firestore via DataContext,
// which seeds defaults inline. This file only exports reusable static lists
// that are referenced by the admin UI.

/** Suggested tech tags for AI projects (shown in admin UI as quick-add chips). */
export const AI_TECH_SUGGESTIONS = [
  'OpenAI', 'Gemini', 'Claude', 'LLM', 'RAG', 'Vector Database',
  'AI Agents', 'Automation', 'AI APIs', 'Python', 'Node.js', 'TypeScript',
];
