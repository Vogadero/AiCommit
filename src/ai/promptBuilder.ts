import * as vscode from 'vscode';
import { Logger } from '../utils';
import { AiCommitConfig } from '../config';
import { DiffStats } from '../utils';
import { getTemplateById, BUILTIN_TEMPLATES, PromptTemplate } from './promptTemplates';
import { TokenUsageInfo } from './aiService';

export interface CommitCandidate {
  message: string;
  type: string;
  scope: string;
  description: string;
  body: string;
}

export interface AiGenerateResult {
  candidates: CommitCandidate[];
  rawResponse: string;
  tokenUsage?: TokenUsageInfo;
}

export class PromptBuilder {
  constructor(private logger: Logger) {}

  buildSystemPrompt(config: AiCommitConfig): string {
    const templateId = config.promptTemplate || 'bullet';
    const languageInstruction = this.getLanguageInstruction(config.commitLanguage);

    if (templateId === 'custom' && config.customPromptTemplate) {
      return this.renderCustomPrompt(config.customPromptTemplate, config) + '\n\n' + languageInstruction;
    }

    const template = getTemplateById(templateId);
    if (template) {
      const basePrompt = template.buildSystemPrompt(config);
      return basePrompt + '\n\n' + languageInstruction;
    }

    return this.buildDefaultPrompt(config) + '\n\n' + languageInstruction;
  }

  buildUserPrompt(
    diffContent: string,
    stats: DiffStats,
    projectName: string,
    recentCommits?: string,
  ): string {
    let prompt = '';
    if (projectName) {
      prompt += `项目名称: ${projectName}\n`;
    }
    prompt += `变更文件数: ${stats.fileCount}\n`;
    prompt += `变更统计: +${stats.additions} -${stats.deletions}\n\n`;

    if (recentCommits) {
      prompt += `最近的提交记录（供参考风格）:\n${recentCommits}\n\n`;
    }

    prompt += `代码变更内容:\n${diffContent}`;
    return prompt;
  }

  private renderCustomPrompt(template: string, config: AiCommitConfig): string {
    return template
      .replace(/\{format\}/g, config.format)
      .replace(/\{candidateCount\}/g, String(config.candidateCount))
      .replace(/\{maxLength\}/g, String(config.maxLength))
      .replace(/\{temperature\}/g, String(config.temperature))
      .replace(/\{maxTokens\}/g, String(config.maxTokens))
      .replace(/\{autoDetectScope\}/g, String(config.autoDetectScope))
      .replace(/\{language\}/g, this.getLanguageName(config.commitLanguage));
  }

  private getLanguageInstruction(commitLanguage: string): string {
    const langName = this.getLanguageName(commitLanguage);
    return `请使用${langName}撰写 commit 信息。`;
  }

  private getLanguageName(commitLanguage: string): string {
    switch (commitLanguage) {
      case 'Chinese':
      case '中文':
        return '中文';
      case 'Follow VSCode':
        const vscodeLang = vscode?.env?.language || 'en';
        return vscodeLang.startsWith('zh') ? '中文' : 'English';
      default:
        return 'English';
    }
  }

  private buildDefaultPrompt(config: AiCommitConfig): string {
    return `你是一个专业的 Git Commit 信息生成助手。请根据提供的代码变更，生成符合指定格式的 commit 信息。

要求：
- 准确概括变更的目的和内容
- 使用简洁明了的语言
- 生成 ${config.candidateCount} 条不同风格的候选方案
- 每条候选方案之间用 "---CANDIDATE---" 分隔
- 每条 commit message 的第一行不超过 ${config.maxLength} 个字符
${config.autoDetectScope ? '- 自动检测变更范围(scope)' : '- 不需要添加 scope'}

多条候选之间用 "---CANDIDATE---" 分隔。
正文应详细说明变更的具体内容，不要省略。`;
  }
}

export { BUILTIN_TEMPLATES, getTemplateById };
export type { PromptTemplate };
