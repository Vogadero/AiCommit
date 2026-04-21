import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../utils';

export interface ProjectConfig {
  promptTemplate?: string;
  commitFormat?: string;
  commitLanguage?: string;
  diffSource?: 'staged' | 'unstaged';
  candidatesCount?: number;
  maxLength?: number;
  activeModelGroup?: string;
}

const CONFIG_FILE = '.aicommitrc.json';

export class ProjectConfigLoader {
  private cachedConfig: ProjectConfig | null = null;
  private cachedPath: string | null = null;
  private watcher: vscode.FileSystemWatcher | null = null;

  constructor(private logger: Logger) {}

  startWatching(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = vscode.workspace.createFileSystemWatcher(`**/${CONFIG_FILE}`);
    this.watcher.onDidCreate(() => this.invalidateCache());
    this.watcher.onDidChange(() => this.invalidateCache());
    this.watcher.onDidDelete(() => this.invalidateCache());
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
  }

  private invalidateCache(): void {
    this.cachedConfig = null;
    this.cachedPath = null;
    this.logger.debug('项目级配置缓存已失效');
  }

  load(): ProjectConfig {
    if (this.cachedConfig && this.cachedPath) {
      return this.cachedConfig;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return {};
    }

    const configPath = path.join(workspaceRoot, CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content) as ProjectConfig;
      this.cachedConfig = config;
      this.cachedPath = configPath;
      this.logger.info(`已加载项目级配置: ${configPath}`);
      return config;
    } catch (e) {
      this.logger.warn(`加载项目级配置失败: ${(e as Error).message}`);
      return {};
    }
  }

  getActiveModelGroup(): string | undefined {
    return this.load().activeModelGroup;
  }

  getOverrides(): Partial<Record<string, any>> {
    const config = this.load();
    const overrides: Partial<Record<string, any>> = {};

    if (config.promptTemplate) overrides['promptTemplate'] = config.promptTemplate;
    if (config.commitFormat) overrides['format'] = config.commitFormat;
    if (config.commitLanguage) overrides['commitLanguage'] = config.commitLanguage;
    if (config.diffSource) overrides['diffSource'] = config.diffSource;
    if (config.candidatesCount) overrides['candidateCount'] = config.candidatesCount;
    if (config.maxLength) overrides['maxLength'] = config.maxLength;

    return overrides;
  }
}
