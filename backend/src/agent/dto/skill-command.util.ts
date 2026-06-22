export function parseSkillCommand(message: string): { slug: string; task: string } | null {
  const m = message.match(/^\/skill(?::|\s+)(\S+)\s+([\s\S]+)$/);
  if (!m) return null;
  const task = m[2].trim();
  if (!task) return null;
  return { slug: m[1], task };
}
