/**
 * Strip a model's internal reasoning/thinking blocks from a reply so they
 * never leak to the UI. Handles:
 *   - <think>...</think>  (DeepSeek, MiniMax reasoning)
 *   - <thinking>...</thinking>
 *   - <|begin_of_thought|>...<|end_of_thought|>
 *   - [THINK]...[/THINK]
 * plus any leading whitespace/newlines left behind.
 */
export function stripThinking(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/<think[\s\S]*?<\/think>/gi, '');
  out = out.replace(/<thinking[\s\S]*?<\/thinking>/gi, '');
  out = out.replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/g, '');
  out = out.replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, '');
  // Unclosed <think at start of reply → drop everything from that tag onward.
  out = out.replace(/<think[\s\S]*$/i, '');
  return out.trim();
}
