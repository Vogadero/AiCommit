import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../utils';
import { AiCommitError, ErrorCode } from '../utils';
import { IgnoreFileHandler } from '../utils/ignoreFile';

export interface GitCheckResult {
  isGitRepo: boolean;
  hasStagedChanges: boolean;
  hasMergeConflicts: boolean;
  repoPath?: string;
  unstagedCount?: number;
  unstagedFiles?: string[];
}

export class GitService {
  private lastCheckRepoPath: string | undefined;
  private ignoreHandler: IgnoreFileHandler;

  constructor(
    private logger: Logger,
    private workspaceRoot: string | undefined,
  ) {
    this.ignoreHandler = new IgnoreFileHandler(logger);
  }

  getLastCheckRepoPath(): string | undefined {
    return this.lastCheckRepoPath;
  }

  private async getGitApi(): Promise<any | null> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) {
        return null;
      }
      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }
      return gitExtension.exports?.getAPI(1) || null;
    } catch {
      return null;
    }
  }

  private pathsEqual(a: string, b: string): boolean {
    if (process.platform === 'win32') {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  private pathStartsWith(childPath: string, parentPath: string): boolean {
    const sep = path.sep;
    const fullParent = parentPath.endsWith(sep) ? parentPath : parentPath + sep;
    if (process.platform === 'win32') {
      return childPath.toLowerCase().startsWith(fullParent.toLowerCase());
    }
    return childPath.startsWith(fullParent);
  }

  private async getActiveRepoPath(): Promise<string> {
    const gitApi = await this.getGitApi();

    if (gitApi && gitApi.repositories.length > 0) {
      this.logger.debug(`VSCode Git API 共检测到 ${gitApi.repositories.length} 个仓库: ${gitApi.repositories.map((r: any) => r.rootUri?.fsPath).join(', ')}`);

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const filePath = activeEditor.document.uri.fsPath;
        for (const repo of gitApi.repositories) {
          const repoRoot = repo.rootUri?.fsPath;
          if (repoRoot && this.pathStartsWith(filePath, repoRoot)) {
            this.logger.debug(`通过活动编辑器匹配仓库路径: ${repoRoot}`);
            return repoRoot;
          }
        }
      }

      if (this.workspaceRoot) {
        for (const repo of gitApi.repositories) {
          const repoRoot = repo.rootUri?.fsPath;
          if (repoRoot && this.pathsEqual(repoRoot, this.workspaceRoot)) {
            this.logger.debug(`通过工作区根目录匹配仓库路径: ${repoRoot}`);
            return repoRoot;
          }
        }

        for (const repo of gitApi.repositories) {
          const repoRoot = repo.rootUri?.fsPath;
          if (repoRoot && this.pathStartsWith(this.workspaceRoot, repoRoot)) {
            this.logger.debug(`工作区位于仓库子目录，使用仓库路径: ${repoRoot}`);
            return repoRoot;
          }
        }
      }

      const repo = gitApi.repositories[0];
      const repoRoot = repo.rootUri?.fsPath;
      if (repoRoot) {
        this.logger.debug(`使用第一个仓库路径: ${repoRoot}`);
        return repoRoot;
      }
    }

    if (this.workspaceRoot) {
      this.logger.debug(`使用工作区根目录: ${this.workspaceRoot}`);
      return this.workspaceRoot;
    }

    throw new AiCommitError(ErrorCode.NOT_GIT_REPO, '未打开工作区');
  }

  private execGit(args: string[], cwd?: string): Promise<string> {
    this.logger.debug(`执行 git ${args.join(' ')} (cwd: ${cwd || 'default'})`);

    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          if (error.code === 'ENOENT') {
            reject(new AiCommitError(ErrorCode.GIT_NOT_FOUND, 'Git 未安装或不在 PATH 中'));
            return;
          }
          const errMsg = stderr?.trim() || error.message;
          this.logger.error(`git ${args.join(' ')} 失败: ${errMsg}`);
          reject(new Error(errMsg));
          return;
        }
        resolve(stdout);
      });
    });
  }

  private async findRepoWithStagedChanges(): Promise<string | null> {
    const gitApi = await this.getGitApi();
    if (!gitApi || gitApi.repositories.length <= 1) {
      return null;
    }

    for (const repo of gitApi.repositories) {
      const repoRoot = repo.rootUri?.fsPath;
      if (!repoRoot) {
        continue;
      }

      const indexChanges = repo.state.indexChanges;
      if (indexChanges.length > 0) {
        this.logger.info(`多仓库场景: 找到有暂存变更的仓库 ${repoRoot} (${indexChanges.length} 个暂存文件)`);
        return repoRoot;
      }

      try {
        const stagedFiles = await this.execGit(['diff', '--cached', '--name-only'], repoRoot);
        if (stagedFiles.trim().length > 0) {
          this.logger.info(`多仓库场景: 通过 git CLI 找到有暂存变更的仓库 ${repoRoot}`);
          return repoRoot;
        }
      } catch {
      }
    }

    return null;
  }

  async checkGitStatus(): Promise<GitCheckResult> {
    const cwd = await this.getActiveRepoPath();
    this.lastCheckRepoPath = cwd;

    try {
      const gitDir = await this.execGit(['rev-parse', '--git-dir'], cwd);
      this.logger.debug(`git 仓库 .git 路径: ${gitDir.trim()}`);
    } catch {
      return { isGitRepo: false, hasStagedChanges: false, hasMergeConflicts: false };
    }

    try {
      const toplevel = await this.execGit(['rev-parse', '--show-toplevel'], cwd);
      this.logger.debug(`git 仓库根目录 (show-toplevel): ${toplevel.trim()}`);
    } catch {
    }

    const statusOutput = await this.execGit(['status', '--short'], cwd);
    this.logger.debug(`git status --short 原始输出 (cwd: ${cwd}):\n${statusOutput || '(空)'}`);

    const stagedFiles = await this.execGit(['diff', '--cached', '--name-only'], cwd);
    const stagedFileList = stagedFiles.trim().split('\n').filter(Boolean);
    const hasStagedChangesCli = stagedFileList.length > 0;

    this.logger.debug(`git CLI 检测: 暂存文件 ${stagedFileList.length} 个 (cwd: ${cwd})${stagedFileList.length > 0 ? ', 文件: ' + stagedFileList.join(', ') : ''}`);

    if (hasStagedChangesCli) {
      let hasMergeConflicts = false;
      try {
        const unmerged = await this.execGit(['ls-files', '--unmerged'], cwd);
        hasMergeConflicts = unmerged.trim().length > 0;
      } catch {
      }
      return { isGitRepo: true, hasStagedChanges: true, hasMergeConflicts, repoPath: cwd };
    }

    const gitApi = await this.getGitApi();
    if (gitApi && gitApi.repositories.length > 0) {
      for (const repo of gitApi.repositories) {
        const repoRoot = repo.rootUri?.fsPath;
        const indexChanges = repo.state.indexChanges;
        const workingTreeChanges = repo.state.workingTreeChanges;
        this.logger.debug(`VSCode Git API 仓库 ${repoRoot}: ${indexChanges.length} 个暂存变更, ${workingTreeChanges.length} 个工作区变更`);
      }

      const matchedRepo = gitApi.repositories.find((r: any) => r.rootUri?.fsPath && this.pathsEqual(r.rootUri.fsPath, cwd)) || gitApi.repositories[0];
      const indexChanges = matchedRepo.state.indexChanges;

      if (indexChanges.length > 0) {
        this.logger.info(`git CLI 未检测到暂存变更，但 VSCode Git API 检测到 ${indexChanges.length} 个 — 以 API 结果为准`);
        const mergeChanges = matchedRepo.state.mergeChanges;
        return { isGitRepo: true, hasStagedChanges: true, hasMergeConflicts: mergeChanges.length > 0, repoPath: cwd };
      }
    }

    if (gitApi && gitApi.repositories.length > 1) {
      const repoWithStaged = await this.findRepoWithStagedChanges();
      if (repoWithStaged) {
        this.logger.info(`当前仓库 ${cwd} 无暂存变更，自动切换到有暂存变更的仓库: ${repoWithStaged}`);
        this.lastCheckRepoPath = repoWithStaged;
        return this.checkStatusForRepo(repoWithStaged);
      }
    }

    let unstagedCount = 0;
    let unstagedFiles: string[] = [];
    const statusLines = statusOutput.trim().split('\n').filter(Boolean);
    for (const line of statusLines) {
      const statusCode = line.substring(0, 2);
      const hasIndex = statusCode[0] !== ' ' && statusCode[0] !== '?';
      const hasWorkTree = statusCode[1] !== ' ' && statusCode[1] !== '?';
      if (!hasIndex && (hasWorkTree || statusCode[0] === '?')) {
        unstagedCount++;
        const fileName = line.substring(3).trim();
        unstagedFiles.push(fileName);
      }
    }

    this.logger.debug(`未暂存文件诊断: ${unstagedCount} 个未暂存变更${unstagedFiles.length > 0 ? ', 文件: ' + unstagedFiles.join(', ') : ''}`);

    return { isGitRepo: true, hasStagedChanges: false, hasMergeConflicts: false, repoPath: cwd, unstagedCount, unstagedFiles };
  }

  private async checkStatusForRepo(repoPath: string): Promise<GitCheckResult> {
    const stagedFiles = await this.execGit(['diff', '--cached', '--name-only'], repoPath);
    const stagedFileList = stagedFiles.trim().split('\n').filter(Boolean);

    if (stagedFileList.length === 0) {
      return { isGitRepo: true, hasStagedChanges: false, hasMergeConflicts: false, repoPath };
    }

    let hasMergeConflicts = false;
    try {
      const unmerged = await this.execGit(['ls-files', '--unmerged'], repoPath);
      hasMergeConflicts = unmerged.trim().length > 0;
    } catch {
    }

    return { isGitRepo: true, hasStagedChanges: true, hasMergeConflicts, repoPath };
  }

  async getStagedDiff(diffSource: 'staged' | 'unstaged' = 'staged'): Promise<string> {
    const check = await this.checkGitStatus();
    if (!check.isGitRepo) {
      throw new AiCommitError(ErrorCode.NOT_GIT_REPO, '当前工作区不是 Git 仓库');
    }
    if (check.hasMergeConflicts) {
      throw new AiCommitError(ErrorCode.MERGE_CONFLICT, '存在未解决的合并冲突');
    }

    if (diffSource === 'unstaged') {
      const diff = await this.execGit(['diff'], check.repoPath);
      if (!diff.trim()) {
        throw new AiCommitError(ErrorCode.STAGING_EMPTY, '工作区无未暂存变更');
      }
      return this.applyIgnoreFilter(diff, check.repoPath);
    }

    if (!check.hasStagedChanges) {
      const detail = check.unstagedCount && check.unstagedCount > 0
        ? `${check.unstagedCount} 个文件有变更但未暂存`
        : undefined;
      throw new AiCommitError(ErrorCode.STAGING_EMPTY, '暂存区无变更', detail);
    }

    const diff = await this.execGit(['diff', '--cached'], check.repoPath);
    return this.applyIgnoreFilter(diff, check.repoPath);
  }

  private applyIgnoreFilter(diff: string, repoPath: string | undefined): string {
    if (repoPath) {
      this.ignoreHandler.load(repoPath);
      if (this.ignoreHandler.getRuleCount() > 0) {
        const ignoredFiles = this.ignoreHandler.getIgnoredFiles(diff);
        if (ignoredFiles.length > 0) {
          this.logger.info(`.aicommitignore 过滤了 ${ignoredFiles.length} 个文件: ${ignoredFiles.join(', ')}`);
          return this.ignoreHandler.filterDiff(diff);
        }
      }
    }
    return diff;
  }

  async stageAll(): Promise<void> {
    const cwd = await this.getActiveRepoPath();
    await this.execGit(['add', '.'], cwd);
    this.logger.info('已暂存所有变更');
  }

  async commit(message: string): Promise<void> {
    const cwd = await this.getActiveRepoPath();
    const safeMessage = message.replace(/"/g, '\\"');
    await this.execGit(['commit', '-m', safeMessage], cwd);
    this.logger.info('提交成功');
  }

  async amendCommit(message: string): Promise<void> {
    const cwd = await this.getActiveRepoPath();
    const safeMessage = message.replace(/"/g, '\\"');
    await this.execGit(['commit', '--amend', '-m', safeMessage], cwd);
    this.logger.info('Amend 提交成功');
  }

  async getHeadDiff(): Promise<string> {
    const cwd = await this.getActiveRepoPath();
    try {
      const diff = await this.execGit(['diff', 'HEAD~1', 'HEAD'], cwd);
      return diff;
    } catch {
      try {
        const diff = await this.execGit(['show', '--format=', 'HEAD'], cwd);
        return diff;
      } catch {
        return '';
      }
    }
  }

  async hasCommits(): Promise<boolean> {
    const cwd = await this.getActiveRepoPath();
    try {
      const result = await this.execGit(['log', '--oneline', '-1'], cwd);
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  async getRecentCommits(count: number = 5): Promise<string> {
    try {
      const cwd = await this.getActiveRepoPath();
      const log = await this.execGit([
        'log', `--max-count=${count}`, '--pretty=format:%s',
      ], cwd);
      return log;
    } catch {
      return '';
    }
  }

  async getProjectName(): Promise<string> {
    try {
      const cwd = await this.getActiveRepoPath();
      const remoteUrl = await this.execGit(['config', '--get', 'remote.origin.url'], cwd);
      const match = remoteUrl.match(/([^\/]+?)(\.git)?$/);
      return match?.[1] || '';
    } catch {
      return '';
    }
  }
}
