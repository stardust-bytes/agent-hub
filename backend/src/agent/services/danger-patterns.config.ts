export type BlockRuleCategory =
  | 'interpreters' | 'package_runners' | 'shells'
  | 'eval' | 'network' | 'cloud_clis'
  | 'git_destructive' | 'irreversible'
  | 'write_scripts' | 'permission_bypass';

export interface BlockRule {
  category: BlockRuleCategory;
  description: string;
  tools: string[];
  patterns: RegExp[];
}

export const BLOCK_RULES: BlockRule[] = [
  {
    category: 'interpreters',
    description: 'Running script interpreters directly',
    tools: ['bash'],
    patterns: [/\bpython[3]?\b/, /\bnode\b/, /\bdeno\b/, /\bruby\b/, /\bphp\b/, /\blua\b/],
  },
  {
    category: 'package_runners',
    description: 'Running package manager scripts',
    tools: ['bash'],
    patterns: [/\bnpx\b/, /\bbunx\b/, /\bnpm run\b/, /\byarn run\b/],
  },
  {
    category: 'shells',
    description: 'Opening interactive shells',
    tools: ['bash'],
    patterns: [/\bsh\b/, /\bssh\b/, /\bzsh\b/, /\bfish\b/],
  },
  {
    category: 'eval',
    description: 'Dynamic code execution',
    tools: ['bash'],
    patterns: [/\beval\b/, /\bexec\b/, /\bsudo\b/],
  },
  {
    category: 'network',
    description: 'Network requests that could exfiltrate data',
    tools: ['bash'],
    patterns: [/\bcurl\b/, /\bwget\b/],
  },
  {
    category: 'cloud_clis',
    description: 'Cloud infrastructure commands',
    tools: ['bash'],
    patterns: [/\bkubectl\b/, /\baws\b/, /\bgcloud\b/, /\bgh\b/],
  },
  {
    category: 'git_destructive',
    description: 'Destructive git operations',
    tools: ['bash'],
    patterns: [/git push --force/, /git branch -D/, /git reset --hard (origin|HEAD)/],
  },
  {
    category: 'irreversible',
    description: 'Irreversible local destruction',
    tools: ['bash'],
    patterns: [/\brm -rf\s+\/$/, /\bDROP TABLE\b/, /\bformat\b/],
  },
  {
    category: 'write_scripts',
    description: 'Writing executable scripts',
    tools: ['write_file'],
    patterns: [/\.(sh|bat|ps1)$/i],
  },
  {
    category: 'permission_bypass',
    description: 'Attempts to bypass permission controls',
    tools: ['spawn_subagent'],
    patterns: [/\bbypass\b/i, /\boverride\b/i, /\badmin\b/i, /\bskip (permission|security)\b/i],
  },
];

export function getEnabledPatterns(disabledCategories: string[] = []): BlockRule[] {
  return BLOCK_RULES.filter(r => !disabledCategories.includes(r.category));
}

export function matchDangerPattern(
  toolName: string,
  toolInput: string,
  rules: BlockRule[],
): BlockRule | null {
  for (const rule of rules) {
    if (!rule.tools.includes(toolName)) continue;
    for (const pattern of rule.patterns) {
      if (pattern.test(toolInput)) return rule;
    }
  }
  return null;
}
