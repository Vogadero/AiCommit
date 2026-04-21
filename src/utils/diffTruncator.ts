import { Logger } from './logger';
import { AiCommitError, ErrorCode } from './errors';

export interface FileDiffInfo {
  filePath: string;
  addedLines: number;
  removedLines: number;
}

export interface DiffStats {
  fileCount: number;
  additions: number;
  deletions: number;
  files: FileDiffInfo[];
}

export interface TruncatedDiff {
  content: string;
  wasTruncated: boolean;
  originalLines: number;
  stats: DiffStats;
}

export function truncateDiff(
  diff: string,
  threshold: number,
  logger: Logger,
): TruncatedDiff {
  const lines = diff.split('\n');
  const originalLines = lines.length;

  if (originalLines <= threshold) {
    const stats = parseDiffStats(diff);
    return {
      content: diff,
      wasTruncated: false,
      originalLines,
      stats,
    };
  }

  logger.warn(`Diff 超过阈值 (${originalLines} > ${threshold})，开始智能截断`);

  const fileGroups = groupDiffByFile(lines);
  const stats = parseDiffStats(diff);
  const resultLines: string[] = [];
  let currentLines = 0;

  for (const group of fileGroups) {
    if (currentLines + group.headerLines.length > threshold) {
      resultLines.push(...group.headerLines);
      resultLines.push(`  ... (省略 ${group.bodyLines.length} 行具体变更)`);
      currentLines += group.headerLines.length + 1;
    } else if (currentLines + group.headerLines.length + group.bodyLines.length <= threshold) {
      resultLines.push(...group.headerLines);
      resultLines.push(...group.bodyLines);
      currentLines += group.headerLines.length + group.bodyLines.length;
    } else {
      const remainingBudget = threshold - currentLines - group.headerLines.length;
      resultLines.push(...group.headerLines);
      if (remainingBudget > 0) {
        resultLines.push(...group.bodyLines.slice(0, remainingBudget));
        resultLines.push(`  ... (省略 ${group.bodyLines.length - remainingBudget} 行)`);
      } else {
        resultLines.push(`  ... (省略 ${group.bodyLines.length} 行具体变更)`);
      }
      currentLines = threshold;
      break;
    }
  }

  return {
    content: resultLines.join('\n'),
    wasTruncated: true,
    originalLines,
    stats,
  };
}

interface FileDiffGroup {
  headerLines: string[];
  bodyLines: string[];
}

function groupDiffByFile(lines: string[]): FileDiffGroup[] {
  const groups: FileDiffGroup[] = [];
  let currentGroup: FileDiffGroup | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = { headerLines: [line], bodyLines: [] };
    } else if (currentGroup) {
      if (
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@') ||
        line.startsWith('index ') ||
        line.startsWith('new file') ||
        line.startsWith('deleted file')
      ) {
        currentGroup.headerLines.push(line);
      } else {
        currentGroup.bodyLines.push(line);
      }
    } else {
      currentGroup = { headerLines: [line], bodyLines: [] };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

function parseDiffStats(diff: string): DiffStats {
  let fileCount = 0;
  let additions = 0;
  let deletions = 0;
  const files: FileDiffInfo[] = [];
  let currentFile = '';

  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/^diff --git a\/(.+?) b\//);
      if (match) {
        currentFile = match[1];
        files.push({ filePath: currentFile, addedLines: 0, removedLines: 0 });
      }
      fileCount++;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
      if (files.length > 0) {
        files[files.length - 1].addedLines++;
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
      if (files.length > 0) {
        files[files.length - 1].removedLines++;
      }
    }
  }

  return { fileCount, additions, deletions, files };
}

export function hashDiff(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
