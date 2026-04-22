import * as vscode from 'vscode';
import { Logger, LogLevel } from '../utils';

export interface ModelGroup {
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface AiCommitConfig {
  enabled: boolean;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  format: 'conventional' | 'gitmoji' | 'bullet' | 'custom';
  customFormatTemplate: string;
  maxLength: number;
  candidateCount: number;
  autoDetectScope: boolean;
  diffTruncateThreshold: number;
  saveHistory: boolean;
  logLevel: string;
  promptTemplate: string;
  customPromptTemplate: string;
  enableProjectContext: boolean;
  diffSource: 'staged' | 'unstaged';
  commitLanguage: string;
  enableStreaming: boolean;
  proxy: string;
  showStatusBarConfig: boolean;
  showStatusBarGroup: boolean;
  showStatusBarGenerate: boolean;
  activeModelGroup: string;
  modelGroups: ModelGroup[];
}

export class ConfigManager {
  private readonly SECTION = 'aicommit';
  private secretStorage: vscode.SecretStorage | null = null;
  private projectConfigLoader: import('./projectConfig').ProjectConfigLoader | null = null;

  constructor(private logger: Logger) {}

  setSecretStorage(secretStorage: vscode.SecretStorage): void {
    this.secretStorage = secretStorage;
  }

  setProjectConfigLoader(loader: import('./projectConfig').ProjectConfigLoader): void {
    this.projectConfigLoader = loader;
  }

  async getConfigAsync(): Promise<AiCommitConfig> {
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    const modelGroups = cfg.get<ModelGroup[]>('modelGroups', []);
    const activeGroupName = cfg.get<string>('activeModelGroup', '');

    const activeGroup = this.findActiveGroup(modelGroups, activeGroupName);
    let apiKey: string;
    let model: string;
    let baseUrl: string;
    let temperature: number;
    let maxTokens: number;

    if (activeGroup) {
      apiKey = await this.getGroupApiKey(activeGroup.name) || activeGroup.apiKey;
      model = activeGroup.model;
      baseUrl = activeGroup.baseUrl;
      temperature = activeGroup.temperature;
      maxTokens = activeGroup.maxTokens;
    } else {
      apiKey = await this.getApiKey();
      model = cfg.get<string>('model', 'gpt-4');
      baseUrl = cfg.get<string>('baseUrl', 'https://api.openai.com/v1');
      temperature = cfg.get<number>('temperature', 0.7);
      maxTokens = cfg.get<number>('maxTokens', 500);
    }

    const result: AiCommitConfig = {
      enabled: cfg.get<boolean>('enabled', true),
      model,
      apiKey,
      baseUrl,
      temperature,
      maxTokens,
      format: cfg.get<'conventional' | 'gitmoji' | 'bullet' | 'custom'>('format', 'bullet'),
      customFormatTemplate: cfg.get<string>('customFormatTemplate', '<type>(<scope>): <description>'),
      maxLength: cfg.get<number>('maxLength', 72),
      candidateCount: cfg.get<number>('candidateCount', 2),
      autoDetectScope: cfg.get<boolean>('autoDetectScope', true),
      diffTruncateThreshold: cfg.get<number>('diffTruncateThreshold', 3000),
      saveHistory: cfg.get<boolean>('saveHistory', false),
      logLevel: cfg.get<string>('logLevel', 'info'),
      promptTemplate: cfg.get<string>('promptTemplate', 'bullet'),
      customPromptTemplate: cfg.get<string>('customPromptTemplate', ''),
      enableProjectContext: cfg.get<boolean>('enableProjectContext', false),
      diffSource: cfg.get<'staged' | 'unstaged'>('diffSource', 'staged'),
      commitLanguage: cfg.get<string>('commitLanguage', 'English'),
      enableStreaming: cfg.get<boolean>('enableStreaming', true),
      proxy: cfg.get<string>('proxy', ''),
      showStatusBarConfig: cfg.get<boolean>('showStatusBarConfig', true),
      showStatusBarGroup: cfg.get<boolean>('showStatusBarGroup', true),
      showStatusBarGenerate: cfg.get<boolean>('showStatusBarGenerate', true),
      activeModelGroup: activeGroupName,
      modelGroups,
    };

    return this.applyProjectOverrides(result);
  }

  getConfig(): AiCommitConfig {
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    const modelGroups = cfg.get<ModelGroup[]>('modelGroups', []);
    const activeGroupName = cfg.get<string>('activeModelGroup', '');

    const activeGroup = this.findActiveGroup(modelGroups, activeGroupName);
    let apiKey: string;
    let model: string;
    let baseUrl: string;
    let temperature: number;
    let maxTokens: number;

    if (activeGroup) {
      const settingsKey = cfg.get<string>('apiKey', '');
      apiKey = this.resolveEnvApiKey(settingsKey) || settingsKey || activeGroup.apiKey;
      model = activeGroup.model;
      baseUrl = activeGroup.baseUrl;
      temperature = activeGroup.temperature;
      maxTokens = activeGroup.maxTokens;
    } else {
      const settingsApiKey = cfg.get<string>('apiKey', '');
      apiKey = this.resolveEnvApiKey(settingsApiKey) || settingsApiKey;
      model = cfg.get<string>('model', 'gpt-4');
      baseUrl = cfg.get<string>('baseUrl', 'https://api.openai.com/v1');
      temperature = cfg.get<number>('temperature', 0.7);
      maxTokens = cfg.get<number>('maxTokens', 500);
    }

    const config: AiCommitConfig = {
      enabled: cfg.get<boolean>('enabled', true),
      model,
      apiKey,
      baseUrl,
      temperature,
      maxTokens,
      format: cfg.get<'conventional' | 'gitmoji' | 'bullet' | 'custom'>('format', 'bullet'),
      customFormatTemplate: cfg.get<string>('customFormatTemplate', '<type>(<scope>): <description>'),
      maxLength: cfg.get<number>('maxLength', 72),
      candidateCount: cfg.get<number>('candidateCount', 2),
      autoDetectScope: cfg.get<boolean>('autoDetectScope', true),
      diffTruncateThreshold: cfg.get<number>('diffTruncateThreshold', 3000),
      saveHistory: cfg.get<boolean>('saveHistory', false),
      logLevel: cfg.get<string>('logLevel', 'info'),
      promptTemplate: cfg.get<string>('promptTemplate', 'bullet'),
      customPromptTemplate: cfg.get<string>('customPromptTemplate', ''),
      enableProjectContext: cfg.get<boolean>('enableProjectContext', false),
      diffSource: cfg.get<'staged' | 'unstaged'>('diffSource', 'staged'),
      commitLanguage: cfg.get<string>('commitLanguage', 'English'),
      enableStreaming: cfg.get<boolean>('enableStreaming', true),
      proxy: cfg.get<string>('proxy', ''),
      showStatusBarConfig: cfg.get<boolean>('showStatusBarConfig', true),
      showStatusBarGroup: cfg.get<boolean>('showStatusBarGroup', true),
      showStatusBarGenerate: cfg.get<boolean>('showStatusBarGenerate', true),
      activeModelGroup: activeGroupName,
      modelGroups,
    };

    return this.applyProjectOverrides(config);
  }

  private applyProjectOverrides(config: AiCommitConfig): AiCommitConfig {
    if (!this.projectConfigLoader) {
      return config;
    }

    const overrides = this.projectConfigLoader.getOverrides();
    if (Object.keys(overrides).length === 0) {
      return config;
    }

    this.logger.debug(`应用项目级配置覆盖: ${JSON.stringify(Object.keys(overrides))}`);
    return { ...config, ...overrides };
  }

  private findActiveGroup(groups: ModelGroup[], activeName: string): ModelGroup | null {
    if (!activeName || groups.length === 0) {
      return null;
    }
    const found = groups.find(g => g.name === activeName);
    if (found) {
      return found;
    }
    if (groups.length > 0) {
      this.logger.warn(`配置组 "${activeName}" 已不存在，回退到 "${groups[0].name}"`);
      const cfg = vscode.workspace.getConfiguration(this.SECTION);
      cfg.update('activeModelGroup', groups[0].name, vscode.ConfigurationTarget.Global);
      return groups[0];
    }
    return null;
  }

  getActiveGroupName(): string {
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    return cfg.get<string>('activeModelGroup', '');
  }

  getModelGroups(): ModelGroup[] {
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    return cfg.get<ModelGroup[]>('modelGroups', []);
  }

  async setActiveGroup(name: string): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    await cfg.update('activeModelGroup', name, vscode.ConfigurationTarget.Global);
    this.logger.info(`已切换到配置组: ${name}`);
  }

  async getGroupApiKey(groupName: string): Promise<string> {
    if (this.secretStorage) {
      const storedKey = await this.secretStorage.get(`aicommit.apiKey.${groupName}`);
      if (storedKey) {
        return storedKey;
      }
    }
    const groups = this.getModelGroups();
    const group = groups.find(g => g.name === groupName);
    if (group) {
      return this.resolveEnvApiKey(group.apiKey) || group.apiKey;
    }
    return '';
  }

  async setGroupApiKey(groupName: string, key: string): Promise<void> {
    if (this.secretStorage) {
      await this.secretStorage.store(`aicommit.apiKey.${groupName}`, key);
    }
    const groups = this.getModelGroups();
    const idx = groups.findIndex(g => g.name === groupName);
    if (idx >= 0) {
      groups[idx].apiKey = '';
      const cfg = vscode.workspace.getConfiguration(this.SECTION);
      await cfg.update('modelGroups', groups, vscode.ConfigurationTarget.Global);
    }
  }

  async addModelGroup(group: Omit<ModelGroup, 'apiKey'> & { apiKey?: string }): Promise<void> {
    const groups = this.getModelGroups();
    if (groups.some(g => g.name === group.name)) {
      throw new Error(`配置组 "${group.name}" 已存在`);
    }
    const apiKey = group.apiKey || '';
    const newGroup: ModelGroup = { ...group, apiKey: '' };
    groups.push(newGroup);
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    await cfg.update('modelGroups', groups, vscode.ConfigurationTarget.Global);
    if (apiKey && this.secretStorage) {
      await this.secretStorage.store(`aicommit.apiKey.${group.name}`, apiKey);
    }
    this.logger.info(`已添加配置组: ${group.name}`);
  }

  async removeModelGroup(name: string): Promise<void> {
    const groups = this.getModelGroups();
    const activeGroup = this.getActiveGroupName();
    const idx = groups.findIndex(g => g.name === name);
    if (idx < 0) {
      throw new Error(`配置组 "${name}" 不存在`);
    }
    groups.splice(idx, 1);
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    if (name === activeGroup) {
      if (groups.length > 0) {
        await cfg.update('activeModelGroup', groups[0].name, vscode.ConfigurationTarget.Global);
      } else {
        await cfg.update('activeModelGroup', '', vscode.ConfigurationTarget.Global);
      }
    }
    await cfg.update('modelGroups', groups, vscode.ConfigurationTarget.Global);
    if (this.secretStorage) {
      await this.secretStorage.delete(`aicommit.apiKey.${name}`);
    }
    this.logger.info(`已删除配置组: ${name}`);
  }

  async updateModelGroup(
    oldName: string,
    updates: Partial<Omit<ModelGroup, 'name'>> & { name?: string },
    newApiKey?: string,
  ): Promise<void> {
    const groups = this.getModelGroups();
    const idx = groups.findIndex(g => g.name === oldName);
    if (idx < 0) {
      throw new Error(`配置组 "${oldName}" 不存在`);
    }

    const newName = updates.name || oldName;
    if (newName !== oldName && groups.some(g => g.name === newName)) {
      throw new Error(`配置组 "${newName}" 已存在`);
    }

    if (newName !== oldName) {
      if (this.secretStorage) {
        const oldKey = await this.secretStorage.get(`aicommit.apiKey.${oldName}`);
        if (oldKey) {
          await this.secretStorage.store(`aicommit.apiKey.${newName}`, oldKey);
          await this.secretStorage.delete(`aicommit.apiKey.${oldName}`);
        }
      }
      const activeGroup = this.getActiveGroupName();
      if (activeGroup === oldName) {
        const cfg = vscode.workspace.getConfiguration(this.SECTION);
        await cfg.update('activeModelGroup', newName, vscode.ConfigurationTarget.Global);
      }
    }

    if (newApiKey !== undefined && this.secretStorage) {
      await this.secretStorage.store(`aicommit.apiKey.${newName}`, newApiKey);
    }

    groups[idx] = {
      ...groups[idx],
      ...updates,
      name: newName,
      apiKey: '',
    };

    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    await cfg.update('modelGroups', groups, vscode.ConfigurationTarget.Global);
    this.logger.info(`已更新配置组: ${oldName}${newName !== oldName ? ` → ${newName}` : ''}`);
  }

  async getApiKey(): Promise<string> {
    if (this.secretStorage) {
      const storedKey = await this.secretStorage.get('aicommit.apiKey');
      if (storedKey) {
        return storedKey;
      }
    }

    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    const settingsKey = cfg.get<string>('apiKey', '');
    return this.resolveEnvApiKey(settingsKey) || settingsKey;
  }

  async setApiKey(key: string): Promise<void> {
    if (this.secretStorage) {
      await this.secretStorage.store('aicommit.apiKey', key);
    }
    const cfg = vscode.workspace.getConfiguration(this.SECTION);
    await cfg.update('apiKey', '', vscode.ConfigurationTarget.Global);
  }

  resolveLogLevel(): LogLevel {
    const cfg = this.getConfig();
    switch (cfg.logLevel) {
      case 'error': return LogLevel.Error;
      case 'warn': return LogLevel.Warn;
      case 'info': return LogLevel.Info;
      case 'debug': return LogLevel.Debug;
      default: return LogLevel.Info;
    }
  }

  private resolveEnvApiKey(raw: string): string {
    if (!raw) {
      return '';
    }
    const envMatch = raw.match(/^\$\{env:(.+)\}$/);
    if (envMatch) {
      const envValue = process.env[envMatch[1]];
      if (envValue) {
        this.logger.debug(`从环境变量 ${envMatch[1]} 读取 API 密钥`);
        return envValue;
      }
      this.logger.warn(`环境变量 ${envMatch[1]} 未设置`);
      return '';
    }
    return '';
  }

  validateConfig(): string | null {
    const cfg = this.getConfig();
    return this.doValidate(cfg);
  }

  async validateConfigAsync(): Promise<string | null> {
    const cfg = await this.getConfigAsync();
    return this.doValidate(cfg);
  }

  private doValidate(cfg: AiCommitConfig): string | null {
    if (!cfg.enabled) {
      return 'AI Commit 插件已禁用';
    }
    if (!cfg.apiKey) {
      if (cfg.activeModelGroup) {
        return `配置组 "${cfg.activeModelGroup}" 的 API 密钥未设置。Settings Sync 不会同步 SecretStorage 中的密钥，请重新输入 API 密钥。`;
      }
      return 'API 密钥未配置，请通过配置面板（状态栏 ⚙ 图标）或设置 aicommit.apiKey 进行配置。\n\n提示：Settings Sync 不会同步 SecretStorage 中的密钥，在新设备上需重新输入。';
    }
    if (!cfg.baseUrl) {
      return 'API 基础 URL 未配置';
    }
    if (!cfg.model) {
      return 'AI 模型名称未配置';
    }
    return null;
  }
}
