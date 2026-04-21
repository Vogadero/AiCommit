import { Logger } from '../utils';
import { AiCommitConfig } from '../config';

export interface PipelineResult {
  content: string;
  candidates: string[];
  warnings: string[];
}

export class ResponsePipeline {
  constructor(private logger: Logger) {}

  process(rawContent: string, config: AiCommitConfig): PipelineResult {
    let content = rawContent;
    const warnings: string[] = [];

    content = this.cleanMarkdown(content);
    content = this.extractXml(content);
    const candidates = this.parseCandidates(content);
    content = this.truncateLineLength(content, config.maxLength);
    content = this.cleanTrailingWhitespace(content);

    if (candidates.length === 0) {
      warnings.push('无法解析候选方案，使用原始输出');
      return { content: rawContent.trim(), candidates: [rawContent.trim()], warnings };
    }

    return { content: candidates[0], candidates, warnings };
  }

  private cleanMarkdown(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/```[\w]*\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    return cleaned;
  }

  private extractXml(text: string): string {
    const commitMatch = text.match(/<commit>([\s\S]*?)<\/commit>/);
    if (commitMatch) {
      this.logger.debug('从 XML <commit> 标签中提取内容');
      return commitMatch[1].trim();
    }
    return text;
  }

  private parseCandidates(text: string): string[] {
    const candidatePattern = /---CANDIDATE\s*\d*---([\s\S]*?)(?=---CANDIDATE\s*\d*---|---END---|$)/g;
    const matches: string[] = [];
    let match;

    while ((match = candidatePattern.exec(text)) !== null) {
      const candidate = match[1].trim();
      if (candidate) {
        matches.push(candidate);
      }
    }

    if (matches.length > 0) {
      return matches;
    }

    const simpleParts = text.split('---CANDIDATE---').map(s => s.trim()).filter(Boolean);
    if (simpleParts.length > 0) {
      return simpleParts;
    }

    const trimmed = text.trim();
    if (trimmed) {
      return [trimmed];
    }

    return [];
  }

  private truncateLineLength(text: string, maxLength: number): string {
    const lines = text.split('\n');
    const processed = lines.map((line, index) => {
      if (index === 0 && line.length > maxLength) {
        return line.substring(0, maxLength - 3) + '...';
      }
      return line;
    });
    return processed.join('\n');
  }

  private cleanTrailingWhitespace(text: string): string {
    let cleaned = text.replace(/[ \t]+$/gm, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();
    return cleaned;
  }
}
