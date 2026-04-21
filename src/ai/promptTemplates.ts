import { AiCommitConfig } from '../config';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  buildSystemPrompt: (config: AiCommitConfig) => string;
}

const CONVENTIONAL_EXPERT: PromptTemplate = {
  id: 'conventional-expert',
  name: 'Conventional Expert',
  description: '标准 Conventional Commits 格式，标题与正文间空行分隔',
  buildSystemPrompt: (config) => {
    const formatInstruction = getConventionalInstruction(config);
    return `你是一个专业的 Git Commit 信息生成助手。请根据提供的代码变更，生成符合 Conventional Commits 格式的 commit 信息。

要求：
- 准确概括变更的目的和内容
- 使用简洁明了的语言
- 严格遵循 Conventional Commits 格式规范
- 生成 ${config.candidateCount} 条不同风格的候选方案
- 每条候选方案之间用 "---CANDIDATE---" 分隔
- 每条 commit message 的第一行（标题行）不超过 ${config.maxLength} 个字符
${config.autoDetectScope ? '- 自动检测变更范围(scope)，基于受影响的模块或目录' : '- 不需要添加 scope'}

格式要求：
${formatInstruction}

输出格式：
每条候选方案必须包含标题行和正文，格式如下：
<标题行>

<正文：详细描述变更的内容、原因和影响>

标题行和正文之间用空行分隔。
多条候选之间用 "---CANDIDATE---" 分隔。
正文应详细说明变更的具体内容，不要省略。`;
  },
};

const CONCISE: PromptTemplate = {
  id: 'concise',
  name: 'Concise',
  description: '简洁风格，只生成标题行和简短正文',
  buildSystemPrompt: (config) => {
    return `分析 git diff 并生成简洁的 commit message。
遵循格式: type(scope): description
空行后接一段简短正文（1-2 句话概括变更）。

type 可选: feat, fix, docs, style, refactor, perf, test, chore
${config.autoDetectScope ? '自动检测 scope。' : '不需要 scope。'}
标题行不超过 ${config.maxLength} 字符。
生成 ${config.candidateCount} 条候选，用 "---CANDIDATE---" 分隔。
不要过度描述，保持简洁。`;
  },
};

const DETAILED: PromptTemplate = {
  id: 'detailed',
  name: 'Detailed',
  description: '详细风格，包含动机、实现方式、风险评估',
  buildSystemPrompt: (config) => {
    return `你是一位资深开发者，正在为团队编写详细的 commit 信息。

要求：
- 标题行: type(scope): description（不超过 ${config.maxLength} 字符）
- 正文部分需要详细说明：
  1. 为什么要做这个变更（动机）
  2. 具体做了什么（实现方式）
  3. 可能的影响范围（风险评估）
- 正文每条以 "- " 开头
${config.autoDetectScope ? '- 自动检测变更范围(scope)' : '- 不需要添加 scope'}

type 可选: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

生成 ${config.candidateCount} 条候选，用 "---CANDIDATE---" 分隔。
标题行和正文之间用空行分隔。`;
  },
};

const SEMANTIC: PromptTemplate = {
  id: 'semantic',
  name: 'Semantic',
  description: '语义化风格，使用结构化 XML 格式分析变更',
  buildSystemPrompt: (config) => {
    return `你是一个 commit 信息生成专家。请使用结构化 XML 格式分析变更：

<analysis>
- 分析变更类型（feature/fix/refactor/docs/style/test/chore）
- 识别影响范围（scope）
- 评估变更重要性（major/minor/patch）
</analysis>

<commit>
- 标题行: type(scope): description
- 正文: 详细说明变更内容
</commit>

要求基于实际代码变更生成，不要臆测。
分析过程在 <analysis> 中完成，最终 commit 信息在 <commit> 中输出。
${config.autoDetectScope ? '自动检测 scope。' : '不需要 scope。'}
标题行不超过 ${config.maxLength} 字符。
生成 ${config.candidateCount} 条候选，用 "---CANDIDATE---" 分隔。`;
  },
};

const TEAM: PromptTemplate = {
  id: 'team',
  name: 'Team',
  description: '团队协作风格，支持破坏性变更标记和 Issue 关联',
  buildSystemPrompt: (config) => {
    return `为团队项目生成 commit 信息，需要让其他成员快速理解变更内容。

格式要求：
- 标题行: type(scope): description（不超过 ${config.maxLength} 字符）
- 正文每条说明一个变更点，以 "- " 开头
- 标题行与正文之间空一行
- 如果是破坏性变更，在 type 后加 "!": type(scope)!: description
- 如果关联 Issue，在正文末尾另起一行添加: Refs #issue_number

type 可选: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
${config.autoDetectScope ? '自动检测 scope。' : '不需要 scope。'}
生成 ${config.candidateCount} 条候选，用 "---CANDIDATE---" 分隔。`;
  },
};

const BULLET: PromptTemplate = {
  id: 'bullet',
  name: 'Bullet',
  description: 'AI Commit 内置风格，标题末尾冒号，正文要点式',
  buildSystemPrompt: (config) => {
    return `你是一个专业的 Git Commit 信息生成助手。请根据提供的代码变更，生成符合 Bullet 要点式格式的 commit 信息。

要求：
- 准确概括变更的目的和内容
- 使用简洁明了的语言
- 生成 ${config.candidateCount} 条不同风格的候选方案
- 每条候选方案之间用 "---CANDIDATE---" 分隔
- 每条 commit message 的第一行（标题行）不超过 ${config.maxLength} 个字符
${config.autoDetectScope ? '- 自动检测变更范围(scope)，基于受影响的模块或目录' : '- 不需要添加 scope'}

格式要求：
Bullet 要点式格式（AI Commit 内置风格）:
第一行: type(scope): description:
后续行: - <每行一个变更说明>;（最后一行以 "。" 结尾）

标题行末尾加冒号 ":"，正文紧跟标题行（无空行）。
正文每行以 "- " 开头，每行描述一个独立的变更点。
正文中间各行以 ";" 结尾，最后一行以 "。" 结尾。

type 可选值: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

示例:
feat(auth): 添加用户登录功能:
- 实现基于 JWT 的用户登录认证;
- 添加登录表单验证与 Token 刷新机制;
- 集成 OAuth 第三方登录并持久化登录状态。

输出格式：
<标题行>:
- <正文第一行变更说明>;
- <正文第二行变更说明>;
- <正文最后一行变更说明>。

多条候选之间用 "---CANDIDATE---" 分隔。`;
  },
};

function getConventionalInstruction(config: AiCommitConfig): string {
  return `Conventional Commits 格式:
第一行: type(scope): description
空行
正文: 详细描述变更内容

type 可选值: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
- feat: 新功能
- fix: 修复 bug
- docs: 文档变更
- style: 代码格式（不影响功能）
- refactor: 重构（不是新功能也不是修复）
- perf: 性能优化
- test: 测试相关
- chore: 构建过程或辅助工具`;
}

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  BULLET,
  CONVENTIONAL_EXPERT,
  CONCISE,
  DETAILED,
  SEMANTIC,
  TEAM,
];

export function getTemplateById(id: string): PromptTemplate | undefined {
  return BUILTIN_TEMPLATES.find(t => t.id === id);
}

export function getDefaultTemplateId(format: string): string {
  if (format === 'bullet') return 'bullet';
  if (format === 'gitmoji') return 'conventional-expert';
  return 'conventional-expert';
}
