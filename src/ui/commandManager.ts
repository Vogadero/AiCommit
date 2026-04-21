import * as vscode from 'vscode';
import { Logger, AiCommitError, ErrorCode, getUserMessage } from '../utils';
import { GitService } from '../git';
import { AiService, PromptBuilder, CommitCandidate } from '../ai';
import { ConfigManager, AiCommitConfig, HistoryManager, ModelGroup } from '../config';
import { truncateDiff, hashDiff } from '../utils';
import { StatusBarManager } from './statusBar';
import { ScmButtonProvider } from './scmButton';
import { TokenTracker } from '../ai';

export class CommandManager {
  private lastDiffHash: string | null = null;
  private lastCandidates: CommitCandidate[] = [];
  private isGenerating = false;

  constructor(
    private logger: Logger,
    private configManager: ConfigManager,
    private gitService: GitService,
    private aiService: AiService,
    private promptBuilder: PromptBuilder,
    private statusBar: StatusBarManager,
    private scmButton: ScmButtonProvider,
    private tokenTracker: TokenTracker,
    private historyManager: HistoryManager,
  ) {}

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('aicommit.generate', () => this.generate()),
      vscode.commands.registerCommand('aicommit.generateAndCommit', () => this.generateAndCommit()),
      vscode.commands.registerCommand('aicommit.amendCommit', () => this.amendCommit()),
      vscode.commands.registerCommand('aicommit.switchModelGroup', () => this.switchModelGroup()),
      vscode.commands.registerCommand('aicommit.regenerate', () => this.regenerate()),
      vscode.commands.registerCommand('aicommit.cancelGeneration', () => this.cancelGeneration()),
      vscode.commands.registerCommand('aicommit.testConnection', () => this.testConnection()),
      vscode.commands.registerCommand('aicommit.selectModel', () => this.selectModel()),
    );
  }

  private async testConnection(): Promise<void> {
    this.statusBar.showConfigBar();

    const config = await this.configManager.getConfigAsync();

    if (!config.apiKey) {
      vscode.window.showErrorMessage('请先配置 API 密钥（aicommit.apiKey）');
      vscode.commands.executeCommand('workbench.action.openSettings', 'aicommit.apiKey');
      return;
    }

    if (!config.baseUrl) {
      vscode.window.showErrorMessage('请先配置 API 基础 URL（aicommit.baseUrl）');
      vscode.commands.executeCommand('workbench.action.openSettings', 'aicommit.baseUrl');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI Commit: 正在测试连接...',
        cancellable: false,
      },
      async () => {
        const result = await this.aiService.testConnection(config);

        if (result.success) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }

        this.logger.info(`测活结果: ${result.message}`);
      },
    );
  }

  private async switchModelGroup(): Promise<void> {
    const groups = this.configManager.getModelGroups();
    const activeName = this.configManager.getActiveGroupName();

    if (groups.length === 0) {
      const action = await vscode.window.showInformationMessage(
        '尚未配置任何模型配置组。是否现在添加？',
        '添加配置组',
        '取消',
      );
      if (action === '添加配置组') {
        await this.addModelGroup();
      }
      return;
    }

    const items: vscode.QuickPickItem[] = groups.map(g => ({
      label: g.name === activeName ? `$(check) ${g.name}` : `     ${g.name}`,
      description: g.model,
      detail: `${g.baseUrl} · 温度: ${g.temperature} · 最大Tokens: ${g.maxTokens}`,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择 AI 模型配置组',
      title: 'AI Commit: 切换模型配置组',
    });

    if (selected) {
      const name = selected.label.replace('$(check) ', '').trim();
      if (name !== activeName) {
        await this.configManager.setActiveGroup(name);
        this.statusBar.updateGroupName(name);
        vscode.window.showInformationMessage(`AI Commit: 已切换到配置组 "${name}"`);
      }
    }
  }

  private async addModelGroup(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: '输入配置组名称',
      placeHolder: '如: GPT-4o, DeepSeek, 公司私有部署',
    });
    if (!name) {
      return;
    }

    const model = await vscode.window.showInputBox({
      prompt: '输入模型名称',
      placeHolder: '如: gpt-4o, deepseek-chat',
    });
    if (!model) {
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: '输入 API 密钥',
      password: true,
      placeHolder: 'sk-... 或 ${env:API_KEY_NAME}',
    });

    const baseUrl = await vscode.window.showInputBox({
      prompt: '输入 API 基础 URL',
      value: 'https://api.openai.com/v1',
    });

    try {
      await this.configManager.addModelGroup({
        name,
        model,
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://api.openai.com/v1',
        temperature: 0.7,
        maxTokens: 500,
      });
      vscode.window.showInformationMessage(`AI Commit: 已添加配置组 "${name}"`);
    } catch (e) {
      vscode.window.showErrorMessage(`AI Commit: ${(e as Error).message}`);
    }
  }

  private async selectModel(): Promise<void> {
    this.statusBar.showConfigBar();

    const config = await this.configManager.getConfigAsync();

    if (!config.apiKey) {
      vscode.window.showErrorMessage('请先配置 API 密钥（aicommit.apiKey）');
      vscode.commands.executeCommand('workbench.action.openSettings', 'aicommit.apiKey');
      return;
    }

    if (!config.baseUrl) {
      vscode.window.showErrorMessage('请先配置 API 基础 URL（aicommit.baseUrl）');
      vscode.commands.executeCommand('workbench.action.openSettings', 'aicommit.baseUrl');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI Commit: 正在获取模型列表...',
        cancellable: false,
      },
      async () => {
        const models = await this.aiService.fetchModels(config);

        if (models.length === 0) {
          vscode.window.showWarningMessage(
            '未获取到模型列表。请检查 API URL 和密钥是否正确，或手动输入模型名称。',
          );

          vscode.commands.executeCommand('workbench.action.openSettings', 'aicommit.model');
          return;
        }

        const items: vscode.QuickPickItem[] = models.map(m => ({
          label: m.id,
          description: m.owned_by || '',
          detail: m.owned_by ? `提供方: ${m.owned_by}` : undefined,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `当前模型: ${config.model}，选择一个模型`,
          title: 'AI Commit: 选择 AI 模型',
        });

        if (selected && selected.label) {
          const cfg = vscode.workspace.getConfiguration('aicommit');
          await cfg.update('model', selected.label, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`AI Commit: 模型已切换为 "${selected.label}"`);
          this.logger.info(`模型切换为: ${selected.label}`);
        }
      },
    );
  }

  private async generate(): Promise<void> {
    this.statusBar.showConfigBar();

    if (this.isGenerating) {
      vscode.window.showWarningMessage('AI Commit: 正在生成中，请先取消当前生成');
      return;
    }

    const config = await this.configManager.getConfigAsync();
    const validationError = await this.configManager.validateConfigAsync();
    if (validationError) {
      vscode.window.showErrorMessage(validationError);
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      const budgetOk = await this.tokenTracker.handleBudgetAlert();
      if (!budgetOk) {
        return;
      }

      const diff = await this.gitService.getStagedDiff(config.diffSource);
      const truncated = truncateDiff(diff, config.diffTruncateThreshold, this.logger);

      if (truncated.wasTruncated) {
        const choice = await vscode.window.showWarningMessage(
          `变更内容较大（${truncated.originalLines} 行），已智能截断至 ${config.diffTruncateThreshold} 行`,
          '继续生成（使用截断内容）',
          '仅分析部分文件',
          '取消',
        );
        if (choice === '取消' || !choice) {
          return;
        }
        if (choice === '仅分析部分文件') {
          const files = truncated.stats.files;
          if (files.length > 0) {
            const selected = await vscode.window.showQuickPick(
              files.map(f => ({ label: f.filePath, description: `+${f.addedLines} -${f.removedLines} 行` })),
              { canPickMany: true, placeHolder: '选择要分析的文件', title: 'AI Commit: 选择分析文件' },
            );
            if (!selected || selected.length === 0) {
              return;
            }
          }
        }
      }

      const diffHash = hashDiff(truncated.content);
      if (diffHash === this.lastDiffHash && this.lastCandidates.length > 0) {
        this.logger.info('Diff 未变化，复用上次生成结果');
        await this.fillCommitInput(this.lastCandidates[0].message);
        this.showCandidatesQuickPick(this.lastCandidates);
        return;
      }

      const systemPrompt = this.promptBuilder.buildSystemPrompt(config);
      let projectName: string | undefined;
      let recentCommits: string | undefined;
      if (config.enableProjectContext) {
        projectName = await this.gitService.getProjectName();
        recentCommits = (await this.gitService.getRecentCommits(5)) || undefined;
      }
      const userPrompt = this.promptBuilder.buildUserPrompt(
        truncated.content,
        truncated.stats,
        projectName || '',
        recentCommits,
      );

      const result = await this.aiService.generate(config, systemPrompt, userPrompt);

      if (result.tokenUsage) {
        this.tokenTracker.record(
          config.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens,
          result.tokenUsage.cachedTokens,
          config.activeModelGroup,
        );
        this.statusBar.updateConfigBarTooltip();
      }

      this.lastDiffHash = diffHash;
      this.lastCandidates = result.candidates;

      this.historyManager.add({
        message: result.candidates[0].message,
        model: config.model,
        timestamp: Date.now(),
        diffHash,
        fileCount: truncated.stats.fileCount,
      });

      await this.fillCommitInput(result.candidates[0].message);

      if (result.candidates.length > 1) {
        this.showCandidatesQuickPick(result.candidates);
      }

      vscode.window.showInformationMessage('AI Commit: 已生成 commit 信息');
    } catch (error) {
      await this.handleError(error);
    } finally {
      this.isGenerating = false;
      this.hideLoading();
    }
  }
  private async generateAndCommit(): Promise<void> {
    this.statusBar.showConfigBar();

    if (this.isGenerating) {
      vscode.window.showWarningMessage('AI Commit: 正在生成中，请先取消当前生成');
      return;
    }

    const config = await this.configManager.getConfigAsync();
    const validationError = await this.configManager.validateConfigAsync();
    if (validationError) {
      vscode.window.showErrorMessage(validationError);
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      const budgetOk = await this.tokenTracker.handleBudgetAlert();
      if (!budgetOk) {
        return;
      }

      const diff = await this.gitService.getStagedDiff(config.diffSource);
      const truncated = truncateDiff(diff, config.diffTruncateThreshold, this.logger);

      const systemPrompt = this.promptBuilder.buildSystemPrompt(config);
      let projectName: string | undefined;
      let recentCommits: string | undefined;
      if (config.enableProjectContext) {
        projectName = await this.gitService.getProjectName();
        recentCommits = (await this.gitService.getRecentCommits(5)) || undefined;
      }
      const userPrompt = this.promptBuilder.buildUserPrompt(
        truncated.content,
        truncated.stats,
        projectName || '',
        recentCommits || undefined,
      );

      const result = await this.aiService.generate(config, systemPrompt, userPrompt);

      if (result.tokenUsage) {
        this.tokenTracker.record(
          config.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens,
          result.tokenUsage.cachedTokens,
          config.activeModelGroup,
        );
        this.statusBar.updateConfigBarTooltip();
      }

      const candidate = result.candidates[0];
      const message = candidate.message;

      this.historyManager.add({
        message,
        model: config.model,
        timestamp: Date.now(),
        diffHash: hashDiff(truncated.content),
        fileCount: truncated.stats.fileCount,
      });

      const confirmed = await vscode.window.showInformationMessage(
        `确认提交:\n${message}`,
        { modal: true },
        '确认提交',
      );

      if (confirmed === '确认提交') {
        await this.gitService.commit(message);
        vscode.window.showInformationMessage('AI Commit: 提交成功');
      }
    } catch (error) {
      await this.handleError(error);
    } finally {
      this.isGenerating = false;
      this.hideLoading();
    }
  }

  private async amendCommit(): Promise<void> {
    this.statusBar.showConfigBar();

    if (this.isGenerating) {
      vscode.window.showWarningMessage('AI Commit: 正在生成中，请先取消当前生成');
      return;
    }

    const hasCommits = await this.gitService.hasCommits();
    if (!hasCommits) {
      vscode.window.showErrorMessage('AI Commit: 当前分支无提交历史，无法执行 amend');
      return;
    }

    const config = await this.configManager.getConfigAsync();
    const validationError = await this.configManager.validateConfigAsync();
    if (validationError) {
      vscode.window.showErrorMessage(validationError);
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      const diff = await this.gitService.getHeadDiff();
      if (!diff.trim()) {
        vscode.window.showWarningMessage('AI Commit: 无法获取上次提交的 diff');
        return;
      }

      const truncated = truncateDiff(diff, config.diffTruncateThreshold, this.logger);
      const systemPrompt = this.promptBuilder.buildSystemPrompt(config);
      let projectName: string | undefined;
      let recentCommits: string | undefined;
      if (config.enableProjectContext) {
        projectName = await this.gitService.getProjectName();
        recentCommits = (await this.gitService.getRecentCommits(5)) || undefined;
      }
      const userPrompt = this.promptBuilder.buildUserPrompt(
        truncated.content,
        truncated.stats,
        projectName || '',
        recentCommits,
      );

      const result = await this.aiService.generate(config, systemPrompt, userPrompt);

      if (result.tokenUsage) {
        this.tokenTracker.record(
          config.model,
          result.tokenUsage.promptTokens,
          result.tokenUsage.completionTokens,
          result.tokenUsage.cachedTokens,
          config.activeModelGroup,
        );
        this.statusBar.updateConfigBarTooltip();
      }

      const message = result.candidates[0].message;

      this.historyManager.add({
        message,
        model: config.model,
        timestamp: Date.now(),
        diffHash: hashDiff(truncated.content),
        fileCount: truncated.stats.fileCount,
      });

      const confirmed = await vscode.window.showInformationMessage(
        `确认修改上次提交信息为:\n${message}`,
        { modal: true },
        '确认修改',
      );

      if (confirmed === '确认修改') {
        await this.gitService.amendCommit(message);
        vscode.window.showInformationMessage('AI Commit: 已修改上次提交信息');
      }
    } catch (error) {
      await this.handleError(error);
    } finally {
      this.isGenerating = false;
      this.hideLoading();
    }
  }

  private async regenerate(): Promise<void> {
    this.lastDiffHash = null;
    this.lastCandidates = [];
    await this.generate();
  }

  private cancelGeneration(): void {
    if (this.isGenerating) {
      this.aiService.cancel();
      this.isGenerating = false;
      this.hideLoading();
      vscode.window.showInformationMessage('AI Commit: 已取消生成');
    }
  }

  private async fillCommitInput(message: string): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension?.isActive) {
        await gitExtension?.activate();
      }
      const gitApi = gitExtension?.exports?.getAPI(1);
      if (!gitApi || !gitApi.repositories || gitApi.repositories.length === 0) {
        this.logger.warn('无法获取 VSCode Git API，尝试直接填入剪贴板');
        await vscode.env.clipboard.writeText(message);
        vscode.window.showInformationMessage('AI Commit: 已复制到剪贴板，请手动粘贴到 commit 输入框');
        return;
      }

      const repoPath = this.gitService.getLastCheckRepoPath();
      let repo = gitApi.repositories[0];
      if (repoPath && gitApi.repositories.length > 1) {
        const matched = gitApi.repositories.find((r: any) =>
          r.rootUri?.fsPath && r.rootUri.fsPath.toLowerCase() === repoPath.toLowerCase()
        );
        if (matched) {
          repo = matched;
          this.logger.debug(`填入匹配仓库的输入框: ${repoPath}`);
        }
      }

      repo.inputBox.value = message;
      this.logger.info(`已填入 SCM 输入框 (仓库: ${repo.rootUri?.fsPath})`);
    } catch (error) {
      this.logger.warn(`填入 SCM 输入框失败: ${(error as Error).message}，回退到剪贴板`);
      await vscode.env.clipboard.writeText(message);
      vscode.window.showInformationMessage('AI Commit: 已复制到剪贴板，请手动粘贴到 commit 输入框');
    }
  }

  private async showCandidatesQuickPick(candidates: CommitCandidate[]): Promise<void> {
    if (candidates.length <= 1) {
      return;
    }

    const items = candidates.map((c, i) => ({
      label: `$(git-commit) 候选 ${i + 1}`,
      description: c.message.split('\n')[0],
      detail: c.message,
      candidate: c,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择一个候选 commit message',
      title: 'AI Commit 候选方案',
    });

    if (selected) {
      await this.fillCommitInput(selected.candidate.message);
    }
  }

  private showLoading(): void {
    this.statusBar.setLoading();
    this.scmButton.setLoading();
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI Commit: 生成中...',
        cancellable: true,
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => {
          this.cancelGeneration();
        });
        while (this.isGenerating) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      },
    );
  }

  private hideLoading(): void {
    this.statusBar.resetLoading();
    this.scmButton.resetLoading();
  }

  private async handleError(error: unknown): Promise<void> {
    this.logger.error('生成失败', error);

    if (error instanceof AiCommitError) {
      switch (error.code) {
        case ErrorCode.STAGING_EMPTY: {
          const hasUnstaged = error.detail && error.detail.includes('未暂存');
          const actions = hasUnstaged
            ? ['暂存所有变更', '取消'] as const
            : ['取消'] as const;
          const choice = await vscode.window.showWarningMessage(
            getUserMessage(error),
            ...actions,
          );
          if (choice === '暂存所有变更') {
            try {
              await this.gitService.stageAll();
              vscode.window.showInformationMessage('已暂存所有变更，正在重新生成...');
              this.isGenerating = false;
              this.hideLoading();
              await this.generate();
              return;
            } catch (stageError) {
              vscode.window.showErrorMessage(`暂存失败: ${(stageError as Error).message}`);
            }
          }
          break;
        }
        case ErrorCode.NETWORK_TIMEOUT: {
          const choice = await vscode.window.showErrorMessage(getUserMessage(error), '重试', '取消');
          if (choice === '重试') {
            this.isGenerating = false;
            this.hideLoading();
            await this.generate();
            return;
          }
          break;
        }
        case ErrorCode.CANCELLED:
          break;
        default:
          vscode.window.showErrorMessage(getUserMessage(error));
      }
    } else {
      vscode.window.showErrorMessage(`AI Commit: ${(error as Error).message}`);
    }
  }
}
