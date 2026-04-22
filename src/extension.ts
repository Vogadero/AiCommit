import * as vscode from 'vscode';
import { Logger, LogLevel } from './utils';
import { ConfigManager, HistoryManager, ProjectConfigLoader } from './config';
import { GitService } from './git';
import { AiService, PromptBuilder, TokenTracker } from './ai';
import { CommandManager, StatusBarManager, ScmButtonProvider, ConfigPanel } from './ui';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('AI Commit');
  const logger = new Logger(outputChannel);

  const configManager = new ConfigManager(logger);
  configManager.setSecretStorage(context.secrets);
  logger.setLevel(configManager.resolveLogLevel());

  logger.info('AI Commit 插件激活');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const gitService = new GitService(logger, workspaceRoot);
  const aiService = new AiService(logger);
  const promptBuilder = new PromptBuilder(logger);
  const tokenTracker = new TokenTracker(logger, context);
  const historyManager = new HistoryManager(logger, context);
  const projectConfigLoader = new ProjectConfigLoader(logger);
  projectConfigLoader.startWatching();
  configManager.setProjectConfigLoader(projectConfigLoader);
  const statusBar = new StatusBarManager(logger, tokenTracker);
  const scmButton = new ScmButtonProvider(logger);

  const commandManager = new CommandManager(
    logger,
    configManager,
    gitService,
    aiService,
    promptBuilder,
    statusBar,
    scmButton,
    tokenTracker,
    historyManager,
  );
  commandManager.register(context);

  const activeGroupName = configManager.getActiveGroupName();
  if (activeGroupName) {
    statusBar.updateGroupName(activeGroupName);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('aicommit.openConfig', () => {
      statusBar.showConfigBar();
      ConfigPanel.createOrShow(context.extensionUri, logger, configManager, aiService, tokenTracker, historyManager, statusBar);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicommit.exportUsage', async () => {
      const records = tokenTracker.getAllRecords();
      if (records.length === 0) {
        vscode.window.showInformationMessage('AI Commit: 暂无用量数据');
        return;
      }
      const formatChoice = await vscode.window.showQuickPick(
        [
          { label: 'JSON', description: '结构化数据格式', value: 'json' },
          { label: 'CSV', description: '表格数据格式，可用 Excel 打开', value: 'csv' },
        ],
        { placeHolder: '选择导出格式', title: 'AI Commit: 导出用量数据' },
      );
      if (!formatChoice) {
        return;
      }

      const format = formatChoice.value;
      const filters: Record<string, string[]> = format === 'csv'
        ? { 'CSV': ['csv'] }
        : { 'JSON': ['json'] };
      const defaultName = format === 'csv'
        ? 'aicommit-usage.csv'
        : 'aicommit-usage.json';

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultName),
        filters,
      });
      if (uri) {
        let content: string;
        if (format === 'csv') {
          content = generateCsv(records);
        } else {
          content = JSON.stringify(records, null, 2);
        }
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        vscode.window.showInformationMessage(`AI Commit: 用量数据已导出至 ${uri.fsPath}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicommit.useHistory', async () => {
      const message = await historyManager.pickAndApply();
      if (message) {
        try {
          const gitExtension = vscode.extensions.getExtension('vscode.git');
          if (!gitExtension?.isActive) {
            await gitExtension?.activate();
          }
          const gitApi = gitExtension?.exports?.getAPI(1);
          if (gitApi && gitApi.repositories && gitApi.repositories.length > 0) {
            const repoPath = gitService.getLastCheckRepoPath();
            let repo = gitApi.repositories[0];
            if (repoPath && gitApi.repositories.length > 1) {
              const matched = gitApi.repositories.find((r: any) =>
                r.rootUri?.fsPath && r.rootUri.fsPath.toLowerCase() === repoPath.toLowerCase()
              );
              if (matched) {
                repo = matched;
              }
            }
            repo.inputBox.value = message;
            vscode.window.showInformationMessage('AI Commit: 已从历史记录填入 commit 信息');
          } else {
            await vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('AI Commit: 已复制到剪贴板，请手动粘贴到 commit 输入框');
          }
        } catch {
          await vscode.env.clipboard.writeText(message);
          vscode.window.showInformationMessage('AI Commit: 已复制到剪贴板，请手动粘贴到 commit 输入框');
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicommit.clearHistory', async () => {
      const confirmed = await vscode.window.showWarningMessage(
        '确认清空所有生成历史记录？此操作不可撤销。',
        '确认清空',
        '取消',
      );
      if (confirmed === '确认清空') {
        historyManager.clear();
        vscode.window.showInformationMessage('AI Commit: 已清空生成历史');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aicommit.exportDiagnosticLog', async () => {
      const content = logger.getLogContent();
      if (!content) {
        vscode.window.showInformationMessage('AI Commit: 暂无诊断日志');
        return;
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('aicommit-diagnostic-log.txt'),
        filters: { 'Text': ['txt'] },
      });
      if (uri) {
        try {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
          vscode.window.showInformationMessage(`AI Commit: 诊断日志已导出至 ${uri.fsPath}`);
        } catch (e) {
          vscode.window.showErrorMessage(`AI Commit: 导出失败 - ${(e as Error).message}`);
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aicommit')) {
        logger.setLevel(configManager.resolveLogLevel());
        logger.info('配置已更新');
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      statusBar.hideConfigBar();
      logger.info('工作区已切换，隐藏配置栏图标');
    }),
  );

  context.subscriptions.push(outputChannel, statusBar, scmButton);
}

export function deactivate(): void {
}

function generateCsv(records: any[]): string {
  const headers = ['date', 'modelGroup', 'model', 'promptTokens', 'completionTokens', 'cachedTokens', 'totalTokens', 'cost', 'inputCost', 'outputCost', 'cacheReadCost', 'timestamp'];
  const lines: string[] = [headers.join(',')];

  for (const r of records) {
    const row = [
      r.date,
      r.modelGroup || '',
      r.model,
      r.promptTokens,
      r.completionTokens,
      r.cachedTokens || 0,
      r.totalTokens,
      r.cost.toFixed(6),
      (r.costBreakdown?.inputCost || 0).toFixed(6),
      (r.costBreakdown?.outputCost || 0).toFixed(6),
      (r.costBreakdown?.cacheReadCost || 0).toFixed(6),
      r.timestamp,
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
