import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

interface IgnoreRule {
  pattern: string;
  regex: RegExp;
  negated: boolean;
}

export class IgnoreFileHandler {
  private rules: IgnoreRule[] = [];
  private loaded = false;

  constructor(private logger: Logger) {}

  load(workspaceRoot: string): void {
    this.rules = [];
    this.loaded = false;

    const ignorePath = path.join(workspaceRoot, '.aicommitignore');
    if (!fs.existsSync(ignorePath)) {
      this.logger.debug('.aicommitignore 文件不存在，跳过过滤');
      this.loaded = true;
      return;
    }

    try {
      const content = fs.readFileSync(ignorePath, 'utf8');
      const lines = content.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
          continue;
        }

        const negated = line.startsWith('!');
        const pattern = negated ? line.substring(1) : line;
        const regex = this.patternToRegex(pattern);

        this.rules.push({ pattern, regex, negated });
      }

      this.logger.info(`已加载 .aicommitignore: ${this.rules.length} 条规则`);
    } catch (e) {
      this.logger.warn(`读取 .aicommitignore 失败: ${(e as Error).message}`);
    }

    this.loaded = true;
  }

  filterDiff(diff: string): string {
    if (!this.loaded || this.rules.length === 0) {
      return diff;
    }

    const fileGroups = this.splitDiffByFile(diff);
    const filteredGroups: string[] = [];
    let ignoredCount = 0;

    for (const group of fileGroups) {
      const filePath = this.extractFilePath(group);
      if (filePath && this.isIgnored(filePath)) {
        ignoredCount++;
        this.logger.debug(`.aicommitignore 过滤文件: ${filePath}`);
        continue;
      }
      filteredGroups.push(group);
    }

    if (ignoredCount > 0) {
      this.logger.info(`.aicommitignore 过滤了 ${ignoredCount} 个文件的 diff`);
    }

    return filteredGroups.join('\n');
  }

  getIgnoredFiles(diff: string): string[] {
    if (!this.loaded || this.rules.length === 0) {
      return [];
    }

    const fileGroups = this.splitDiffByFile(diff);
    const ignored: string[] = [];

    for (const group of fileGroups) {
      const filePath = this.extractFilePath(group);
      if (filePath && this.isIgnored(filePath)) {
        ignored.push(filePath);
      }
    }

    return ignored;
  }

  isIgnored(filePath: string): boolean {
    let ignored = false;

    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const rule of this.rules) {
      if (rule.negated) {
        if (rule.regex.test(normalizedPath)) {
          ignored = false;
        }
      } else {
        if (rule.regex.test(normalizedPath)) {
          ignored = true;
        }
      }
    }

    return ignored;
  }

  getRuleCount(): number {
    return this.rules.length;
  }

  private splitDiffByFile(diff: string): string[] {
    const groups: string[] = [];
    const lines = diff.split('\n');
    let currentGroup: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup.join('\n'));
        }
        currentGroup = [line];
      } else {
        currentGroup.push(line);
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup.join('\n'));
    }

    return groups;
  }

  private extractFilePath(fileDiff: string): string | null {
    const match = fileDiff.match(/^diff --git a\/(.+?) b\//m);
    return match ? match[1] : null;
  }

  private patternToRegex(pattern: string): RegExp {
    let re = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');

    if (re.startsWith('/')) {
      re = '^' + re;
    } else {
      re = '(^|/)' + re;
    }

    if (re.endsWith('/')) {
      re = re + '.*';
    } else {
      re = re + '(/.*)?$';
    }

    if (!re.endsWith('$')) {
      re = re + '$';
    }

    try {
      return new RegExp(re);
    } catch {
      this.logger.warn(`无效的 .aicommitignore 规则: ${pattern}`);
      return new RegExp('^$');
    }
  }
}
