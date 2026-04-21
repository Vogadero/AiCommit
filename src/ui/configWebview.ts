import * as vscode from 'vscode';
import { Logger, AiCommitError, ErrorCode, getUserMessage } from '../utils';
import { AiService, TestConnectionResult, PromptBuilder, BUILTIN_TEMPLATES, TokenTracker } from '../ai';
import { ConfigManager, AiCommitConfig, HistoryManager } from '../config';

interface ModelItem {
  id: string;
  owned_by?: string;
}

export class ConfigPanel {
  public static currentPanel: ConfigPanel | undefined;
  public static readonly viewType = 'aicommit.config';

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    logger: Logger,
    configManager: ConfigManager,
    aiService: AiService,
    tokenTracker: TokenTracker,
    historyManager: HistoryManager,
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ConfigPanel.currentPanel) {
      ConfigPanel.currentPanel.panel.reveal(column);
      ConfigPanel.currentPanel.sendCurrentConfig();
      return;
    }

    ConfigPanel.currentPanel = new ConfigPanel(
      extensionUri,
      logger,
      configManager,
      aiService,
      tokenTracker,
      historyManager,
      column,
    );
  }

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private logger: Logger,
    private configManager: ConfigManager,
    private aiService: AiService,
    private tokenTracker: TokenTracker,
    private historyManager: HistoryManager,
    column: vscode.ViewColumn | undefined,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      ConfigPanel.viewType,
      'AI Commit 配置',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'images', 'icon.png');
    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      await this.handleMessage(msg);
    });

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public dispose(): void {
    ConfigPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private async handleMessage(msg: { type: string; data?: any }): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.sendCurrentConfig();
        break;
      case 'fetchModels':
        await this.handleFetchModels(msg.data);
        break;
      case 'testConnection':
        await this.handleTestConnection(msg.data);
        break;
      case 'saveConfig':
        await this.handleSaveConfig(msg.data);
        break;
      case 'exportUsage':
        vscode.commands.executeCommand('aicommit.exportUsage');
        break;
      case 'refreshPromptPreview':
        this.sendPromptPreviews();
        break;
      case 'refreshUsageStats':
        this.sendUsageStats();
        break;
      case 'addGroup':
        await this.handleAddGroup();
        break;
      case 'switchGroup':
        await this.handleSwitchGroup(msg.data);
        break;
      case 'deleteGroup':
        await this.handleDeleteGroup(msg.data);
        break;
      case 'editGroup':
        await this.handleEditGroup(msg.data);
        break;
      case 'viewHistory':
        await this.handleViewHistory();
        break;
      case 'clearHistory':
        await this.handleClearHistory();
        break;
    }
  }

  private async sendPromptPreviews(): Promise<void> {
    const config = await this.configManager.getConfigAsync();
    const promptPreviews: Record<string, { name: string; description: string; content: string }> = {};
    for (const tpl of BUILTIN_TEMPLATES) {
      promptPreviews[tpl.id] = {
        name: tpl.name,
        description: tpl.description,
        content: tpl.buildSystemPrompt(config),
      };
    }
    promptPreviews['custom'] = {
      name: '自定义模板',
      description: '使用您定义的 Prompt 内容',
      content: '请在下方「自定义 Prompt」文本框中输入您的模板内容。\n\n支持占位符: {format}, {candidateCount}, {maxLength}, {temperature}, {maxTokens}, {autoDetectScope}',
    };
    this.panel.webview.postMessage({
      type: 'promptPreviewsData',
      data: { promptPreviews },
    });
  }

  private sendUsageStats(): void {
    const today = this.tokenTracker.getTodaySummary();
    const week = this.tokenTracker.getWeekSummary();
    const month = this.tokenTracker.getMonthSummary();
    const dailyChart = this.tokenTracker.getDailyStats(14);
    this.panel.webview.postMessage({
      type: 'usageStatsData',
      data: { today, week, month, dailyChart },
    });
  }

  private async sendCurrentConfig(): Promise<void> {
    const config = await this.configManager.getConfigAsync();
    this.panel.webview.postMessage({
      type: 'initConfig',
      data: {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        format: config.format,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        maxLength: config.maxLength,
        candidateCount: config.candidateCount,
        autoDetectScope: config.autoDetectScope,
        diffTruncateThreshold: config.diffTruncateThreshold,
        enabled: config.enabled,
        customFormatTemplate: config.customFormatTemplate,
        saveHistory: config.saveHistory,
        logLevel: config.logLevel,
        promptTemplate: config.promptTemplate,
        customPromptTemplate: config.customPromptTemplate,
        enableProjectContext: config.enableProjectContext,
        customModelPricing: formatModelPricing(
          vscode.workspace.getConfiguration('aicommit').get<Record<string, { input: number; output: number }>>('customModelPricing', {})
        ),
        dailyBudget: vscode.workspace.getConfiguration('aicommit').get<number>('dailyBudget', 0),
        monthlyBudget: vscode.workspace.getConfiguration('aicommit').get<number>('monthlyBudget', 0),
        currency: vscode.workspace.getConfiguration('aicommit').get<string>('currency', 'USD'),
        exchangeRate: vscode.workspace.getConfiguration('aicommit').get<number>('exchangeRate', 7.2),
        diffSource: config.diffSource,
        commitLanguage: config.commitLanguage,
        enableStreaming: config.enableStreaming,
        proxy: config.proxy,
        modelGroups: config.modelGroups,
        activeModelGroup: config.activeModelGroup,
      },
    });
    this.sendPromptPreviews();
    this.sendUsageStats();
  }

  private postMessage(type: string, data: any): void {
    this.panel.webview.postMessage({ type, data });
  }

  private async handleFetchModels(data: { baseUrl: string; apiKey: string }): Promise<void> {
    if (!data.baseUrl || !data.apiKey) {
      this.postMessage('fetchModelsResult', { success: false, error: '请先填写 Base URL 和 API Key' });
      return;
    }

    this.postMessage('fetchModelsLoading', true);

    try {
      const tempConfig: AiCommitConfig = {
        ...await this.configManager.getConfigAsync(),
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
      };

      const models = await this.aiService.fetchModels(tempConfig);

      this.postMessage('fetchModelsResult', {
        success: true,
        models: models.map((m: ModelItem) => ({
          id: m.id,
          owned_by: m.owned_by || '',
        })),
      });
    } catch (error) {
      const errorInfo = classifyError(error);
      this.postMessage('fetchModelsResult', errorInfo);
    }

    this.postMessage('fetchModelsLoading', false);
  }

  private async handleTestConnection(data: { baseUrl: string; apiKey: string; model: string }): Promise<void> {
    if (!data.baseUrl || !data.apiKey || !data.model) {
      this.postMessage('testConnectionResult', {
        success: false,
        message: '请先填写 Base URL、API Key 和模型名称',
      });
      return;
    }

    this.postMessage('testConnectionLoading', true);

    try {
      const tempConfig: AiCommitConfig = {
        ...await this.configManager.getConfigAsync(),
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        model: data.model,
      };

      const result: TestConnectionResult = await this.aiService.testConnection(tempConfig);
      this.postMessage('testConnectionResult', result);
    } catch (error) {
      const errorInfo = classifyError(error);
      this.postMessage('testConnectionResult', {
        success: false,
        message: errorInfo.error,
        errorType: errorInfo.errorType,
      });
    }

    this.postMessage('testConnectionLoading', false);
  }

  private async handleAddGroup(): Promise<void> {
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
      await this.sendCurrentConfig();
    } catch (e) {
      vscode.window.showErrorMessage(`AI Commit: ${(e as Error).message}`);
    }
  }

  private async handleSwitchGroup(data: { name: string }): Promise<void> {
    try {
      await this.configManager.setActiveGroup(data.name);
      vscode.window.showInformationMessage(`AI Commit: 已切换到配置组 "${data.name}"`);
      await this.sendCurrentConfig();
    } catch (e) {
      vscode.window.showErrorMessage(`AI Commit: ${(e as Error).message}`);
    }
  }

  private async handleDeleteGroup(data: { name: string }): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `确认删除配置组 "${data.name}"？此操作不可撤销。`,
      '确认删除',
      '取消',
    );
    if (confirmed !== '确认删除') {
      return;
    }

    try {
      await this.configManager.removeModelGroup(data.name);
      vscode.window.showInformationMessage(`AI Commit: 已删除配置组 "${data.name}"`);
      await this.sendCurrentConfig();
    } catch (e) {
      vscode.window.showErrorMessage(`AI Commit: ${(e as Error).message}`);
    }
  }

  private async handleEditGroup(data: { name: string }): Promise<void> {
    const groups = this.configManager.getModelGroups();
    const group = groups.find(g => g.name === data.name);
    if (!group) {
      vscode.window.showErrorMessage(`AI Commit: 配置组 "${data.name}" 不存在`);
      return;
    }

    const newName = await vscode.window.showInputBox({
      prompt: '修改配置组名称',
      value: group.name,
      placeHolder: '如: GPT-4o, DeepSeek, 公司私有部署',
    });
    if (newName === undefined) {
      return;
    }
    if (!newName.trim()) {
      vscode.window.showWarningMessage('AI Commit: 配置组名称不能为空');
      return;
    }

    const newModel = await vscode.window.showInputBox({
      prompt: '修改模型名称',
      value: group.model,
      placeHolder: '如: gpt-4o, deepseek-chat',
    });
    if (newModel === undefined) {
      return;
    }
    if (!newModel.trim()) {
      vscode.window.showWarningMessage('AI Commit: 模型名称不能为空');
      return;
    }

    const currentApiKey = await this.configManager.getGroupApiKey(group.name);
    const newApiKey = await vscode.window.showInputBox({
      prompt: '修改 API 密钥（留空保持不变）',
      password: true,
      placeHolder: currentApiKey ? '留空保持当前密钥不变' : 'sk-... 或 ${env:API_KEY_NAME}',
    });

    const newBaseUrl = await vscode.window.showInputBox({
      prompt: '修改 API 基础 URL',
      value: group.baseUrl,
      placeHolder: 'https://api.openai.com/v1',
    });
    if (newBaseUrl === undefined) {
      return;
    }

    const newTemperature = await vscode.window.showInputBox({
      prompt: '修改温度 (0-2)',
      value: String(group.temperature),
      placeHolder: '0.7',
    });

    const newMaxTokens = await vscode.window.showInputBox({
      prompt: '修改最大 Tokens',
      value: String(group.maxTokens),
      placeHolder: '500',
    });

    try {
      const updates: Partial<Omit<import('../config').ModelGroup, 'name'>> & { name?: string } = {
        model: newModel.trim(),
        baseUrl: newBaseUrl.trim() || 'https://api.openai.com/v1',
      };

      if (newName.trim() !== group.name) {
        updates.name = newName.trim();
      }

      if (newTemperature !== undefined) {
        const temp = parseFloat(newTemperature);
        if (!isNaN(temp) && temp >= 0 && temp <= 2) {
          updates.temperature = temp;
        }
      }

      if (newMaxTokens !== undefined) {
        const tokens = parseInt(newMaxTokens, 10);
        if (!isNaN(tokens) && tokens >= 50 && tokens <= 4000) {
          updates.maxTokens = tokens;
        }
      }

      await this.configManager.updateModelGroup(
        group.name,
        updates,
        newApiKey !== undefined && newApiKey !== '' ? newApiKey : undefined,
      );

      vscode.window.showInformationMessage(`AI Commit: 已更新配置组 "${group.name}"`);
      await this.sendCurrentConfig();
    } catch (e) {
      vscode.window.showErrorMessage(`AI Commit: ${(e as Error).message}`);
    }
  }

  private async handleViewHistory(): Promise<void> {
    const message = await this.historyManager.pickAndApply();
    if (message) {
      try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension?.isActive) {
          await gitExtension?.activate();
        }
        const gitApi = gitExtension?.exports?.getAPI(1);
        if (gitApi && gitApi.repositories && gitApi.repositories.length > 0) {
          const repo = gitApi.repositories[0];
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
  }

  private async handleClearHistory(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      '确认清空所有生成历史记录？此操作不可撤销。',
      '确认清空',
      '取消',
    );
    if (confirmed === '确认清空') {
      this.historyManager.clear();
      vscode.window.showInformationMessage('AI Commit: 已清空生成历史');
    }
  }

  private async handleSaveConfig(data: Record<string, any>): Promise<void> {
    try {
      if (data.apiKey !== undefined) {
        await this.configManager.setApiKey(data.apiKey);
      }

      const cfg = vscode.workspace.getConfiguration('aicommit');
      const updates: Thenable<void>[] = [];

      const fieldMap: Record<string, string> = {
        baseUrl: 'baseUrl',
        model: 'model',
        format: 'format',
        temperature: 'temperature',
        maxTokens: 'maxTokens',
        maxLength: 'maxLength',
        candidateCount: 'candidateCount',
        autoDetectScope: 'autoDetectScope',
        diffTruncateThreshold: 'diffTruncateThreshold',
        enabled: 'enabled',
        customFormatTemplate: 'customFormatTemplate',
        saveHistory: 'saveHistory',
        logLevel: 'logLevel',
        promptTemplate: 'promptTemplate',
        customPromptTemplate: 'customPromptTemplate',
        enableProjectContext: 'enableProjectContext',
        dailyBudget: 'dailyBudget',
        monthlyBudget: 'monthlyBudget',
        currency: 'currency',
        exchangeRate: 'exchangeRate',
        diffSource: 'diffSource',
        commitLanguage: 'commitLanguage',
        enableStreaming: 'enableStreaming',
        proxy: 'proxy',
        modelGroups: 'modelGroups',
        activeModelGroup: 'activeModelGroup',
      };

      for (const [dataKey, configKey] of Object.entries(fieldMap)) {
        if (data[dataKey] !== undefined) {
          updates.push(cfg.update(configKey, data[dataKey], vscode.ConfigurationTarget.Global));
        }
      }

      if (data.customModelPricing !== undefined) {
        const pricingObj = parseModelPricing(data.customModelPricing);
        updates.push(cfg.update('customModelPricing', pricingObj, vscode.ConfigurationTarget.Global));
      }

      await Promise.all(updates.map(t => Promise.resolve(t)));

      this.postMessage('saveConfigResult', { success: true });
      vscode.window.showInformationMessage('AI Commit: 配置已保存');
      this.logger.info('配置已通过配置面板保存');
    } catch (error) {
      this.postMessage('saveConfigResult', { success: false, error: (error as Error).message });
      vscode.window.showErrorMessage(`AI Commit: 保存失败 - ${(error as Error).message}`);
    }
  }

  private getHtmlForWebview(): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>AI Commit 配置</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--fg);
      background: var(--bg);
      line-height: 1.6;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 32px 80px;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .page-header .logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .page-header h1 {
      font-size: 20px;
      font-weight: 600;
    }

    .page-header p {
      font-size: 12px;
      opacity: 0.6;
      margin-top: 2px;
    }

    .page-header .header-right {
      margin-left: auto;
      flex-shrink: 0;
    }

    .theme-toggle {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--fg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
    }

    .theme-toggle:hover {
      border-color: var(--focus-border);
      background: var(--btn-secondary-hover, rgba(128,128,128,0.15));
    }

    .theme-toggle svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
      opacity: 0.75;
      transition: opacity 0.2s;
    }

    .theme-toggle:hover svg {
      opacity: 1;
    }

    body.theme-light {
      --bg: #ffffff;
      --fg: #1e1e1e;
      --input-bg: #ffffff;
      --input-fg: #1e1e1e;
      --input-border: #d0d0d0;
      --btn-bg: #0078d4;
      --btn-fg: #ffffff;
      --btn-hover: #006abc;
      --btn-secondary-bg: #f0f0f0;
      --btn-secondary-fg: #3b3b3b;
      --btn-secondary-hover: #e0e0e0;
      --error-fg: #d32f2f;
      --success-fg: #2e7d32;
      --warning-fg: #f57c00;
      --border: #e0e0e0;
      --focus-border: #0078d4;
      --card-bg: #f8f8f8;
    }

    body.theme-dark {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #cccccc);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, transparent);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --btn-secondary-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --btn-secondary-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --btn-secondary-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
      --error-fg: var(--vscode-errorForeground, #f44747);
      --success-fg: #4ec9b0;
      --warning-fg: #cca700;
      --border: var(--vscode-panel-border, rgba(128,128,128,0.35));
      --focus-border: var(--vscode-focusBorder, #007fd4);
      --card-bg: var(--vscode-editorWidget-background, rgba(30,30,30,0.6));
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .two-col .card.full-width {
      grid-column: 1 / -1;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px 20px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-title .icon {
      font-size: 16px;
    }

    .form-group {
      margin-bottom: 14px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 5px;
      color: var(--fg);
    }

    label .required {
      color: var(--error-fg);
      margin-left: 2px;
    }

    label .hint {
      font-weight: 400;
      opacity: 0.55;
      font-size: 11px;
      margin-left: 4px;
    }

    .input-wrapper {
      position: relative;
    }

    input, select {
      width: 100%;
      padding: 6px 10px;
      font-size: 13px;
      font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace);
      color: var(--input-fg);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      outline: none;
      transition: border-color 0.15s;
    }

    input:focus, select:focus {
      border-color: var(--focus-border);
    }

    input.invalid, select.invalid {
      border-color: var(--error-fg) !important;
    }

    input.valid {
      border-color: var(--success-fg);
    }

    .validation-msg {
      font-size: 11px;
      margin-top: 3px;
      min-height: 0;
      transition: all 0.15s;
    }

    .validation-msg:empty { min-height: 0; margin-top: 0; }
    .validation-msg.error { color: var(--error-fg); }
    .validation-msg.success { color: var(--success-fg); }
    .validation-msg.warning { color: var(--warning-fg); }

    .input-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .input-row .form-group {
      flex: 1;
      min-width: 0;
    }

    .password-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .password-row input {
      flex: 1;
      min-width: 0;
    }

    .password-row button {
      flex-shrink: 0;
    }

    .model-combobox {
      position: relative;
    }

    .model-combobox input {
      width: 100%;
    }

    .model-combobox-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 220px;
      overflow-y: auto;
      background: var(--input-bg);
      border: 1px solid var(--focus-border);
      border-top: none;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      z-index: 1000;
      display: none;
    }

    .model-combobox-dropdown.show {
      display: block;
    }

    .model-combobox-dropdown .dropdown-search {
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 11px;
      opacity: 0.5;
    }

    .model-combobox-item {
      padding: 6px 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: background 0.1s;
    }

    .model-combobox-item:hover {
      background: var(--btn-secondary-hover, rgba(128,128,128,0.15));
    }

    .model-combobox-item.selected {
      background: rgba(108, 92, 231, 0.12);
    }

    .model-combobox-item .model-id {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .model-combobox-item .model-id mark {
      background: rgba(108, 92, 231, 0.25);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }

    .model-combobox-item .model-owner {
      font-size: 10px;
      opacity: 0.45;
      flex-shrink: 0;
    }

    .model-tags {
      display: flex;
      gap: 3px;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .model-tag {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }

    .model-tag-language { background: rgba(78, 201, 176, 0.15); color: #4ec9b0; }
    .model-tag-code { background: rgba(108, 92, 231, 0.15); color: #a78bfa; }
    .model-tag-vision { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
    .model-tag-audio { background: rgba(244, 114, 182, 0.15); color: #f472b6; }
    .model-tag-search { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
    .model-tag-reasoning { background: rgba(248, 113, 113, 0.15); color: #f87171; }
    .model-tag-embedding { background: rgba(163, 163, 163, 0.15); color: #a3a3a3; }
    .model-tag-image { background: rgba(52, 211, 153, 0.15); color: #34d399; }
    .model-tag-video { background: rgba(251, 146, 60, 0.15); color: #fb923c; }
    .model-tag-tts { background: rgba(192, 132, 252, 0.15); color: #c084fc; }
    .model-tag-chat { background: rgba(45, 212, 191, 0.15); color: #2dd4bf; }

    .model-btn-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }

    .inline-btn {
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      background: var(--input-bg);
      color: var(--fg);
      flex-shrink: 0;
      height: 30px;
      transition: background 0.15s, border-color 0.15s;
    }

    .inline-btn:hover:not(:disabled) {
      background: var(--btn-secondary-hover);
      border-color: var(--focus-border);
    }

    .inline-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .inline-btn svg {
      flex-shrink: 0;
      opacity: 0.8;
    }

    .inline-btn:hover:not(:disabled) svg {
      opacity: 1;
    }

    .export-btn {
      padding: 6px;
      border-radius: 30px;
      height: 25px;
    }

    .test-btn {
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      background: var(--btn-bg);
      color: var(--btn-fg);
      flex-shrink: 0;
      height: 30px;
      transition: background 0.15s;
    }

    .test-btn:hover:not(:disabled) {
      background: var(--btn-hover);
    }

    .test-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .test-result-box {
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      margin-top: 10px;
      display: none;
      word-break: break-word;
      line-height: 1.5;
    }

    .test-result-box.show { display: block; }
    .test-result-box.success {
      background: rgba(78, 201, 176, 0.08);
      border: 1px solid rgba(78, 201, 176, 0.25);
      color: var(--success-fg);
    }
    .test-result-box.error {
      background: rgba(244, 71, 71, 0.08);
      border: 1px solid rgba(244, 71, 71, 0.25);
      color: var(--error-fg);
    }

    .test-result-box .result-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .test-result-box .result-detail {
      opacity: 0.85;
      font-size: 11px;
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .save-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg);
      border-top: 1px solid var(--border);
      padding: 12px 32px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      z-index: 100;
    }

    .save-bar .unsaved-badge {
      font-size: 11px;
      color: var(--warning-fg);
      display: none;
      align-items: center;
      gap: 4px;
      margin-right: auto;
    }

    .save-bar .unsaved-badge.show { display: inline-flex; }

    .save-btn {
      padding: 7px 24px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--btn-bg);
      color: var(--btn-fg);
      transition: background 0.15s;
    }

    .save-btn:hover:not(:disabled) { background: var(--btn-hover); }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .reset-btn {
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      background: transparent;
      color: var(--fg);
      transition: background 0.15s;
    }

    .reset-btn:hover { background: var(--input-bg); }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
    }

    .toggle-row label {
      margin-bottom: 0;
    }

    .toggle-row .toggle-desc {
      font-size: 11px;
      opacity: 0.55;
    }

    .checkbox-wrapper {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }

    .checkbox-wrapper input[type="checkbox"] {
      opacity: 0;
      width: 100%;
      height: 100%;
      position: absolute;
      z-index: 1;
      cursor: pointer;
      margin: 0;
    }

    .checkbox-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--border);
      border-radius: 20px;
      transition: 0.2s;
    }

    .checkbox-slider:before {
      content: "";
      position: absolute;
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }

    .checkbox-wrapper input:checked + .checkbox-slider {
      background: var(--btn-bg);
    }

    .checkbox-wrapper input:checked + .checkbox-slider:before {
      transform: translateX(16px);
    }

    .range-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .range-row input[type="range"] {
      flex: 1;
      padding: 0;
      border: none;
      background: transparent;
      height: 4px;
    }

    .range-row .range-value {
      font-size: 12px;
      font-weight: 600;
      min-width: 36px;
      text-align: right;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .format-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .format-option {
      flex: 1 1 calc(25% - 8px);
      min-width: 100px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      background: transparent;
      user-select: none;
      -webkit-user-select: none;
      text-align: center;
    }

    .format-option:hover {
      border-color: var(--focus-border);
    }

    .format-option.selected {
      border-color: var(--btn-bg);
      background: rgba(108, 92, 231, 0.08);
    }

    .format-option .format-name {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .format-option .format-desc {
      font-size: 10px;
      opacity: 0.55;
    }

    .help-link {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .help-link:hover {
      text-decoration: underline;
    }

    .retry-link {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: underline;
      font-size: 11px;
    }

    .field-desc {
      font-size: 11px;
      opacity: 0.5;
      margin-bottom: 5px;
      line-height: 1.4;
    }

    .field-desc code {
      background: rgba(128,128,128,0.15);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
    }

    .format-detail {
      font-size: 10px;
      opacity: 0.45;
      margin-top: 2px;
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 28px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M3 5l3 3 3-3'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }

    .no-results {
      padding: 10px;
      text-align: center;
      opacity: 0.5;
      font-size: 12px;
    }

    .help-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      color: var(--fg);
      opacity: 0.4;
      cursor: help;
      margin-left: 4px;
      flex-shrink: 0;
      vertical-align: middle;
      border: 1px solid currentColor;
      line-height: 1;
      transition: opacity 0.15s;
    }

    .help-icon:hover {
      opacity: 0.8;
    }

    label .help-icon {
      margin-left: 6px;
    }

    .toggle-row .help-icon {
      margin-left: 4px;
    }

    textarea {
      width: 100%;
      padding: 6px 10px;
      font-size: 12px;
      font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace);
      color: var(--input-fg);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      outline: none;
      transition: border-color 0.15s;
      resize: vertical;
      min-height: 110px;
    }

    textarea:focus {
      border-color: var(--focus-border);
    }

    .prompt-preview-box {
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    .prompt-preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--btn-secondary-hover, rgba(128,128,128,0.1));
      border-bottom: 1px solid var(--border);
    }

    .prompt-preview-name {
      font-weight: 600;
      font-size: 12px;
      color: var(--fg);
      white-space: nowrap;
    }

    .prompt-preview-desc {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .prompt-preview-content {
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.7;
      max-height: 320px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--fg);
      opacity: 0.85;
    }

    .prompt-preview-content::-webkit-scrollbar {
      width: 6px;
    }

    .prompt-preview-content::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .usage-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }

    .usage-stats-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .usage-stats-header label {
      margin-bottom: 0;
    }

    .usage-stats-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .usage-stat-item {
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .usage-stat-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .usage-stat-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: 6px 6px 0 0;
    }

    .usage-stat-item.today::before {
      background: linear-gradient(90deg, #0078d4, #00bcf2);
    }

    .usage-stat-item.week::before {
      background: linear-gradient(90deg, #6c5ce7, #a855f7);
    }

    .usage-stat-item.month::before {
      background: linear-gradient(90deg, #f59e0b, #ef4444);
    }

    .usage-stat-label {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.5;
      margin-bottom: 4px;
    }

    .usage-stat-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--fg);
      font-variant-numeric: tabular-nums;
      animation: fadeInUp 0.4s ease-out;
    }

    .usage-stat-cost {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.7;
      margin-top: 2px;
      animation: fadeInUp 0.4s ease-out 0.1s both;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .usage-chart-container {
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 14px 8px;
    }

    .usage-chart-label {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.5;
      margin-bottom: 10px;
    }

    .usage-chart-wrapper {
      position: relative;
    }

    .usage-chart-grid {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
    }

    .usage-chart-grid-line {
      border-top: 1px dashed var(--border);
      opacity: 0.5;
    }

    .usage-chart {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 110px;
      position: relative;
    }

    .usage-chart-bar-wrapper {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
    }

    .usage-chart-bar {
      width: 100%;
      min-width: 0;
      border-radius: 3px 3px 0 0;
      background: linear-gradient(180deg, var(--accent, #0078d4), rgba(0, 120, 212, 0.4));
      opacity: 0.75;
      transition: opacity 0.15s, transform 0.15s;
      position: relative;
      cursor: default;
    }

    .usage-chart-bar:hover {
      opacity: 1;
      transform: scaleY(1.02);
      transform-origin: bottom;
    }

    .usage-chart-bar[title]:hover::after {
      content: attr(title);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--fg);
      color: var(--bg);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      white-space: nowrap;
      z-index: 10;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      line-height: 1.4;
    }

    .usage-chart-bar[title]:hover::before {
      content: '';
      position: absolute;
      bottom: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--fg);
      z-index: 10;
    }

    .usage-chart-date {
      font-size: 9px;
      color: var(--fg);
      opacity: 0.4;
      margin-top: 4px;
      white-space: nowrap;
      text-align: center;
      line-height: 1;
    }

    .usage-chart-cost-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 110px;
      pointer-events: none;
      z-index: 5;
    }

    .usage-chart-legend {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }

    .usage-chart-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      color: var(--fg);
      opacity: 0.6;
    }

    .usage-chart-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .usage-chart-legend-dot.tokens {
      background: var(--accent, #0078d4);
    }

    .usage-chart-legend-dot.cost {
      background: #f59e0b;
    }

    .usage-summary-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-top: 10px;
      padding: 8px 12px;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .usage-summary-item {
      flex: 1;
      text-align: center;
    }

    .usage-summary-label {
      display: block;
      font-size: 10px;
      color: var(--fg);
      opacity: 0.45;
      margin-bottom: 2px;
    }

    .usage-summary-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
      font-variant-numeric: tabular-nums;
    }

    .usage-summary-divider {
      width: 1px;
      height: 24px;
      background: var(--border);
      flex-shrink: 0;
    }

    .budget-row {
      display: flex;
      gap: 12px;
    }

    .budget-field {
      flex: 1;
    }

    .budget-label {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.6;
      margin-bottom: 4px;
      display: block;
    }

    .input-with-unit {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .input-with-unit input {
      flex: 1;
    }

    .unit-symbol {
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
      opacity: 0.7;
    }

    .unit-suffix {
      font-size: 11px;
      color: var(--fg);
      opacity: 0.5;
      white-space: nowrap;
    }

    .budget-progress {
      margin-top: 8px;
    }

    .budget-bar {
      height: 6px;
      background: var(--input-bg);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .budget-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s, background 0.3s;
      background: var(--accent, #0078d4);
    }

    .budget-bar-fill.warning {
      background: #f0ad4e;
    }

    .budget-bar-fill.exceeded {
      background: #d9534f;
    }

    .budget-bar-label {
      font-size: 10px;
      color: var(--fg);
      opacity: 0.5;
      margin-top: 3px;
      text-align: right;
    }

    .currency-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .exchange-rate-field {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .exchange-rate-field .budget-label {
      margin-bottom: 0;
      white-space: nowrap;
    }

    .model-group-item {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: var(--input-bg);
      transition: border-color 0.15s;
    }

    .model-group-item.active {
      border-color: var(--accent, #0078d4);
      background: rgba(0, 120, 212, 0.06);
    }

    .model-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .model-group-name {
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .model-group-active-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--accent, #0078d4);
      color: #fff;
      font-weight: 500;
    }

    .model-group-model {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 2px;
    }

    .model-group-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .model-group-actions button {
      padding: 3px 8px;
      font-size: 11px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: transparent;
      color: var(--fg);
      cursor: pointer;
      transition: all 0.15s;
    }

    .model-group-actions button:hover {
      border-color: var(--focus-border);
      background: var(--btn-secondary-hover);
    }

    .model-group-actions .delete-btn:hover {
      border-color: #d9534f;
      color: #d9534f;
    }

    .model-group-actions .edit-btn:hover {
      border-color: var(--accent, #0078d4);
      color: var(--accent, #0078d4);
    }

    .history-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      justify-content: flex-end;
    }

    .history-view-btn {
      border-color: var(--focus-border);
      color: var(--accent, #0078d4);
    }

    .history-view-btn:hover {
      background: rgba(0, 120, 212, 0.1) !important;
    }

    .history-clear-btn {
      color: var(--error-fg);
      border-color: transparent;
    }

    .history-clear-btn:hover {
      border-color: var(--error-fg) !important;
      background: rgba(217, 83, 79, 0.08) !important;
    }
  </style>
</head>
<body class="theme-dark">
  <div class="container">
    <div class="page-header">
      <div class="logo">✨</div>
      <div>
        <h1>AI Commit 配置</h1>
        <p>配置 AI 大模型，自动生成 Git Commit 信息</p>
      </div>
      <div class="header-right">
        <button class="theme-toggle" id="themeToggle" title="切换亮色/暗色主题">
          <svg id="themeIconDark" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M9.598 1.591a.75.75 0 0 1 .785-.175 7 7 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.5 5.5 0 1 0 7.678-7.678z"/></svg>
          <svg id="themeIconLight" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="display:none"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm.75-6.75a.75.75 0 0 1-1.5 0V1.5a.75.75 0 0 1 1.5 0v2.25zm0 10.5a.75.75 0 0 1-1.5 0v-2.25a.75.75 0 0 1 1.5 0v2.25zm5.25-5.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 0 1.5h-2.25zm-10.5 0a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 0 1.5H3.5zm9.04-3.68a.75.75 0 0 1-1.06-1.06l1.59-1.59a.75.75 0 1 1 1.06 1.06l-1.59 1.59zM4.53 11.47a.75.75 0 0 1-1.06 1.06l-1.59-1.59a.75.75 0 1 1 1.06-1.06l1.59 1.59zm8.6 1.06a.75.75 0 1 1-1.06-1.06l1.59-1.59a.75.75 0 1 1 1.06 1.06l-1.59 1.59zM4.53 4.47a.75.75 0 0 1-1.06 1.06L1.88 3.94a.75.75 0 0 1 1.06-1.06l1.59 1.59z"/></svg>
        </button>
      </div>
    </div>

    <div class="two-col">
      <!-- AI 模型连接配置 -->
      <div class="card full-width">
        <div class="card-title"><span class="icon">🔌</span> AI 模型连接</div>
        <div class="two-col" style="gap:14px;">
          <div class="form-group">
            <label>Base URL <span class="required">*</span> <span class="help-icon" title="OpenAI 兼容 API 地址，需支持 /v1/chat/completions 协议&#10;默认值: https://api.openai.com/v1&#10;有效值: 有效的 HTTP/HTTPS URL&#10;&#10;常见服务商:&#10;• OpenAI: https://api.openai.com/v1&#10;• DeepSeek: https://api.deepseek.com/v1&#10;• 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1&#10;• Moonshot: https://api.moonshot.cn/v1&#10;• 智谱 AI: https://open.bigmodel.cn/api/paas/v4&#10;• 本地 Ollama: http://localhost:11434/v1">?</span></label>
            <input type="url" id="baseUrl" placeholder="https://api.openai.com/v1" title="API 基础 URL，不同服务商地址不同：&#10;• OpenAI: https://api.openai.com/v1&#10;• DeepSeek: https://api.deepseek.com/v1&#10;• 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1&#10;• Moonshot: https://api.moonshot.cn/v1&#10;• 智谱 AI: https://open.bigmodel.cn/api/paas/v4&#10;• 本地 Ollama: http://localhost:11434/v1" />
            <div class="validation-msg" id="baseUrlMsg"></div>
          </div>
          <div class="form-group">
            <label>API Key <span class="required">*</span> <span class="help-icon" title="访问 AI 服务的密钥，加密存储&#10;默认值: 无&#10;有效值: 密钥字符串或 \${env:VAR_NAME} 格式引用环境变量&#10;&#10;• 直接输入密钥字符串&#10;• 使用 \${env:VAR_NAME} 格式引用环境变量&#10;• 密钥通过 VSCode 加密存储，不会明文保存在 settings.json">?</span></label>
            <div class="password-row">
              <input type="password" id="apiKey" placeholder="sk-..." autocomplete="off" title="API 密钥，用于访问 AI 模型服务&#10;• 直接输入密钥字符串&#10;• 或使用 \${env:VAR_NAME} 格式引用环境变量&#10;• 密钥通过 VSCode 加密存储，不会明文保存在 settings.json" />
              <button class="inline-btn" id="toggleApiKeyBtn" title="显示/隐藏 API Key" type="button"><svg class="eye-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.3 0 8c1.7 2.7 4.5 5 8 5s6.3-2.3 8-5c-1.7-2.7-4.5-5-8-5zm0 8.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm0-5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg></button>
            </div>
            <div class="validation-msg" id="apiKeyMsg"></div>
          </div>
        </div>

        <div class="form-group">
          <label>模型名称 <span class="required">*</span> <span class="help-icon" title="AI 模型 ID&#10;默认值: gpt-4&#10;有效值: 任意模型 ID 字符串&#10;&#10;• 直接输入模型 ID&#10;• 或点击「获取列表」后从下拉选择&#10;• 下拉支持模糊搜索匹配">?</span></label>
          <div class="model-combobox" id="modelCombobox">
            <input type="text" id="modelInput" placeholder="输入模型名称或从下拉选择..." autocomplete="off" title="AI 模型名称&#10;• 直接输入模型 ID&#10;• 或点击「获取列表」后从下拉选择&#10;• 下拉支持模糊搜索匹配" />
            <div class="model-combobox-dropdown" id="modelDropdown"></div>
          </div>
          <div class="model-btn-row">
            <button class="inline-btn" id="fetchModelsBtn" title="从 API 获取可用模型列表（需先填写 Base URL 和 API Key）">
              <span id="fetchModelsIcon">⇣</span> 获取列表
            </button>
            <button class="test-btn" id="testBtn" disabled title="测试当前配置是否可用（需三项均填写）">
              ⏱ 测试连接
            </button>
          </div>
          <div class="validation-msg" id="modelMsg"></div>
        </div>

        <div class="test-result-box" id="testResult"></div>

        <div class="form-group" style="margin-top:12px;">
          <div class="usage-stats-header">
            <label>模型配置组 <span class="help-icon" title="配置多组 AI 模型参数，快速切换使用&#10;&#10;• 每组包含独立的模型名、API Key、Base URL、温度、最大 Tokens&#10;• API Key 加密存储在 SecretStorage 中&#10;• 当前活跃组会覆盖全局配置&#10;• 通过命令面板或状态栏点击可快速切换&#10;&#10;使用场景:&#10;• 工作项目用公司私有模型，个人项目用 OpenAI&#10;• 日常用低成本模型，重要提交用高质量模型&#10;• 主力模型额度耗尽时快速切换备用">?</span></label>
            <div class="usage-stats-actions">
              <button class="inline-btn" id="addGroupBtn" type="button" title="添加新的模型配置组"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5a.5.5 0 0 1 .5.5v5.5H14a.5.5 0 0 1 0 1H8.5V14a.5.5 0 0 1-1 0V8.5H2a.5.5 0 0 1 0-1h5.5V2A.5.5 0 0 1 8 1.5z"/></svg> 添加</button>
            </div>
          </div>
          <div id="modelGroupsList"></div>
          <div class="field-desc" id="noGroupsHint" style="margin-top:4px;">暂无配置组，点击「添加」创建。未配置组时使用上方的全局连接参数。</div>
        </div>
      </div>

      <!-- Commit 格式配置 -->
      <div class="card">
        <div class="card-title"><span class="icon">📝</span> Commit 格式</div>

        <div class="form-group">
          <label>格式类型 <span class="help-icon" title="Commit 信息的格式规范&#10;默认值: Bullet&#10;&#10;• Conventional: 标准 Conventional Commits，标题与正文间空行分隔&#10;• Gitmoji: 在 Conventional 基础上增加 Emoji 前缀&#10;• Bullet: AI Commit 内置风格，标题末尾冒号，正文要点式&#10;• 自定义: 使用自定义模板">?</span></label>
          <div class="format-options" id="formatOptions">
            <div class="format-option" data-value="conventional" title="Conventional Commits 标准格式&#10;标题与正文间空行分隔&#10;示例: feat(auth): 添加用户登录功能">
              <div class="format-name">Conventional</div>
              <div class="format-desc">type(scope): desc</div>
            </div>
            <div class="format-option" data-value="gitmoji" title="Gitmoji + Conventional 格式&#10;在标准格式前增加语义化 Emoji 前缀&#10;示例: ✨ feat(auth): 添加用户登录功能">
              <div class="format-name">Gitmoji</div>
              <div class="format-desc">✨ type(scope): desc</div>
            </div>
            <div class="format-option selected" data-value="bullet" title="Bullet 要点式格式（AI Commit 内置风格）&#10;标题末尾加冒号，正文每行一个变更点&#10;中间行 ; 结尾，末行 。结尾，无空行&#10;示例: feat(auth): 添加用户登录功能:&#10;- 实现基于 JWT 的用户登录认证;&#10;- 添加 Token 刷新机制。">
              <div class="format-name">Bullet</div>
              <div class="format-desc">type(scope): desc:</div>
            </div>
            <div class="format-option" data-value="custom" title="自定义格式&#10;使用自定义模板，支持占位符: &lt;type&gt;, &lt;scope&gt;, &lt;description&gt;, &lt;body&gt;">
              <div class="format-name">自定义</div>
              <div class="format-desc">自定义模板</div>
            </div>
          </div>
          <input type="hidden" id="formatInput" value="bullet" />
        </div>

        <div class="form-group" id="customFormatGroup" style="display:none;">
          <label>自定义格式模板 <span class="help-icon" title="自定义 commit 格式模板&#10;默认值: &lt;type&gt;(&lt;scope&gt;): &lt;description&gt;&#10;&#10;可用占位符:&#10;• &lt;type&gt;: 变更类型 (feat/fix/docs/...)&#10;• &lt;scope&gt;: 变更范围&#10;• &lt;description&gt;: 简短描述&#10;• &lt;body&gt;: 详细说明">?</span></label>
          <div class="field-desc" style="margin-bottom:8px;">快速选择预设:</div>
          <div class="format-options" id="customPresets">
            <div class="format-option selected" data-template="standard" title="标准 Conventional 格式">
              <div class="format-name">标准</div>
              <div class="format-desc">type(scope): desc</div>
            </div>
            <div class="format-option" data-template="bracket" title="方括号格式">
              <div class="format-name">方括号</div>
              <div class="format-desc">[type] scope: desc</div>
            </div>
            <div class="format-option" data-template="concise" title="无 Scope 格式">
              <div class="format-name">简洁</div>
              <div class="format-desc">type: desc</div>
            </div>
            <div class="format-option" data-template="scope-first" title="Scope 前置格式">
              <div class="format-name">Scope前置</div>
              <div class="format-desc">(scope) type: desc</div>
            </div>
          </div>
          <input type="text" id="customFormatTemplate" value="<type>(<scope>): <description>" />
          <div class="validation-msg" id="customPreview" style="margin-top:6px;"></div>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div>
              <label>自动检测 Scope <span class="help-icon" title="根据变更文件路径自动推断 scope&#10;默认值: 开启&#10;&#10;开启时: 自动根据受影响的模块/目录生成 scope&#10;关闭时: 不添加 scope">?</span></label>
            </div>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="autoDetectScope" checked />
              <span class="checkbox-slider"></span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Commit 语言 <span class="help-icon" title="AI 生成 commit 信息的撰写语言&#10;默认值: English&#10;&#10;• English: 使用英文撰写（默认）&#10;• Chinese: 使用中文撰写&#10;• Follow VSCode: 跟随 VSCode 显示语言&#10;&#10;此设置独立于插件 UI 语言，仅控制 AI 输出的语言">?</span></label>
          <select id="commitLanguage">
            <option value="English">English — 英文（默认）</option>
            <option value="Chinese">Chinese — 中文</option>
            <option value="Follow VSCode">Follow VSCode — 跟随 VSCode 语言</option>
          </select>
        </div>

        <div class="form-group">
          <label>标题最大长度 <span class="hint">— 字符</span> <span class="help-icon" title="Commit 标题行的最大字符数&#10;默认值: 72&#10;有效值: 30-120&#10;&#10;Conventional Commits 规范建议不超过 72 字符">?</span></label>
          <div class="range-row">
            <input type="range" id="maxLength" min="30" max="120" value="72" step="1" />
            <span class="range-value" id="maxLengthValue">72</span>
          </div>
        </div>
      </div>

      <!-- Prompt 模板 -->
      <div class="card">
        <div class="card-title"><span class="icon">🧠</span> Prompt 模板</div>

        <div class="form-group">
          <label>模板选择 <span class="help-icon" title="控制 AI 生成 commit 信息的风格和详细程度&#10;默认值: Bullet&#10;&#10;• Bullet: AI Commit 内置要点式风格（推荐）&#10;• Conventional Expert: 标准 Conventional Commits 专家&#10;• Concise: 简洁风格，只生成标题+简短正文&#10;• Detailed: 详细风格，包含动机/实现/风险评估&#10;• Semantic: 语义化风格，XML 结构化分析&#10;• Team: 团队协作风格，支持破坏性变更和 Issue 关联&#10;• 自定义: 使用自定义 Prompt 模板">?</span></label>
          <select id="promptTemplate">
            <option value="bullet">Bullet — 要点式（默认）</option>
            <option value="conventional-expert">Conventional Expert — 标准格式</option>
            <option value="concise">Concise — 简洁风格</option>
            <option value="detailed">Detailed — 详细风格</option>
            <option value="semantic">Semantic — 语义化风格</option>
            <option value="team">Team — 团队协作风格</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div class="form-group" id="customPromptGroup" style="display:none;">
          <label>自定义 Prompt <span class="help-icon" title="自定义 Prompt 模板内容&#10;仅在模板选择为「自定义」时生效&#10;&#10;支持占位符:&#10;• {format}: commit 格式类型&#10;• {candidateCount}: 候选方案数&#10;• {maxLength}: 标题最大长度&#10;• {temperature}: 温度&#10;• {maxTokens}: 最大 Tokens&#10;• {autoDetectScope}: 是否自动检测 Scope">?</span></label>
          <textarea id="customPromptTemplate" placeholder="输入自定义 Prompt 模板...&#10;&#10;支持占位符: {format}, {candidateCount}, {maxLength}, {temperature}, {maxTokens}, {autoDetectScope}"></textarea>
        </div>

        <div class="form-group">
          <label>Prompt 预览 <span class="help-icon" title="当前选中模板的 System Prompt 内容预览&#10;实际生成时还会附加 User Prompt（包含 diff 内容等）">?</span></label>
          <div id="promptPreview" class="prompt-preview-box">
            <div class="prompt-preview-header">
              <span class="prompt-preview-name" id="promptPreviewName">加载中...</span>
              <span class="prompt-preview-desc" id="promptPreviewDesc"></span>
            </div>
            <div class="prompt-preview-content" id="promptPreviewContent"></div>
          </div>
        </div>
      </div>

      <!-- Token 与费用 -->
      <div class="card">
        <div class="card-title"><span class="icon">💰</span> Token 与费用</div>

        <div class="form-group">
          <label>预算设置 <span class="help-icon" title="设置费用预算上限，防止意外超支&#10;设为 0 表示不限制&#10;&#10;• 达到 80% 时弹出 Warning 提醒&#10;• 达到 100% 时弹出 Error 通知，可选择继续或停止&#10;• 预算为软限制，不会强制阻断功能">?</span></label>
          <div class="budget-row">
            <div class="budget-field">
              <span class="budget-label">日预算</span>
              <div class="input-with-unit">
                <span class="unit-symbol" id="dailyBudgetUnit">$</span>
                <input type="number" id="dailyBudget" min="0" step="0.1" value="0" placeholder="0 = 不限制" />
              </div>
            </div>
            <div class="budget-field">
              <span class="budget-label">月预算</span>
              <div class="input-with-unit">
                <span class="unit-symbol" id="monthlyBudgetUnit">$</span>
                <input type="number" id="monthlyBudget" min="0" step="1" value="0" placeholder="0 = 不限制" />
              </div>
            </div>
          </div>
          <div class="budget-progress" id="budgetProgress" style="display:none;">
            <div class="budget-bar">
              <div class="budget-bar-fill" id="budgetBarFill"></div>
            </div>
            <div class="budget-bar-label" id="budgetBarLabel"></div>
          </div>
        </div>

        <div class="form-group">
          <label>货币显示 <span class="help-icon" title="选择费用显示的货币单位&#10;&#10;• USD: 以美元显示（默认）&#10;• CNY: 以人民币显示，使用下方汇率换算">?</span></label>
          <div class="currency-row">
            <select id="currency">
              <option value="USD">USD - 美元</option>
              <option value="CNY">CNY - 人民币</option>
            </select>
            <div class="exchange-rate-field" id="exchangeRateField" style="display:none;">
              <span class="budget-label">汇率</span>
              <div class="input-with-unit">
                <input type="number" id="exchangeRate" min="0.01" step="0.1" value="7.2" />
                <span class="unit-suffix">CNY/USD</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>自定义模型单价 <span class="help-icon" title="自定义模型单价（每 1K Tokens 的美元价格）&#10;优先级高于内置单价表&#10;&#10;格式: 模型名=输入单价,输出单价[,缓存读取单价]&#10;每行一个模型&#10;&#10;示例:&#10;my-model=0.001,0.002&#10;custom-gpt=0.003,0.01,0.0015&#10;&#10;费用类型说明:&#10;• 输入单价: Prompt Tokens 的费用&#10;• 输出单价: Completion Tokens 的费用&#10;• 缓存读取单价（可选）: 命中缓存的 Tokens 费用&#10;  部分模型（如 GPT-4o、Claude、DeepSeek）&#10;  支持缓存命中，费用通常为输入单价的 50%&#10;&#10;内置支持的模型（50+）:&#10;OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4,&#10;  gpt-3.5-turbo, o1, o1-mini, o3-mini, o4-mini&#10;DeepSeek: deepseek-chat, deepseek-reasoner, deepseek-v3&#10;Claude: claude-3.5-sonnet, claude-3.5-haiku,&#10;  claude-3-opus, claude-3-sonnet, claude-3-haiku&#10;通义: qwen-plus, qwen-turbo, qwen-max,&#10;  qwen-long, qwen-coder-plus, qwq-32b&#10;Moonshot: moonshot-v1-8k, moonshot-v1-32k,&#10;  moonshot-v1-128k&#10;智谱: glm-4, glm-4-flash, glm-4-plus,&#10;  glm-4-long, glm-4v, glm-z1-air/flash&#10;Gemini: gemini-2.5-pro, gemini-2.5-flash,&#10;  gemini-2.0-flash, gemini-1.5-pro/flash&#10;Mistral: mistral-large, mistral-small, codestral&#10;Llama: llama3.1-405b, llama3.1-70b, llama3.1-8b">?</span></label>
          <textarea id="customModelPricing" placeholder="模型名=输入单价,输出单价[,缓存读取单价]&#10;每行一个模型&#10;&#10;示例:&#10;my-model=0.001,0.002&#10;custom-gpt=0.003,0.01,0.0015"></textarea>
        </div>

        <div class="form-group">
          <div class="usage-stats-header">
            <label>用量统计 <span class="help-icon" title="Token 用量与费用累计统计&#10;&#10;• 今日: 当日 0 点至今的累计用量&#10;• 本周: 本周一至今的累计用量&#10;• 本月: 本月 1 日至今的累计用量&#10;• 趋势图: 近 14 天的每日 Token 消耗&#10;&#10;数据存储在 globalState 中，保留 90 天后自动清理&#10;悬停趋势图柱状条可查看具体日期的用量和费用">?</span></label>
            <div class="usage-stats-actions">
              <button class="inline-btn export-btn" id="exportUsageBtn" type="button" title="导出 Token 用量统计为 JSON 或 CSV 文件&#10;JSON: 结构化数据，适合程序处理&#10;CSV: 表格格式，可用 Excel 打开"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h5.586a.75.75 0 0 1 .53.22l4.414 4.414c.141.14.22.331.22.53v7.586A1.75 1.75 0 0 1 12.75 15h-9A1.75 1.75 0 0 1 2 13.25V2.75zm6.5 0v3.5c0 .414.336.75.75.75h3.5v6.25a.25.25 0 0 1-.25.25h-9a.25.25 0 0 1-.25-.25V2.75a.25.25 0 0 1 .25-.25h5zm1.5 0v3h3v-.19L10.19 2.75H10z"/><path d="M5.5 10.5a.5.5 0 0 1 .5-.5h1v-1a.5.5 0 0 1 1 0v1h1a.5.5 0 0 1 0 1H8v1a.5.5 0 0 1-1 0v-1H6a.5.5 0 0 1-.5-.5z"/></svg>导出</button>
            </div>
          </div>
          <div class="usage-stats-grid">
            <div class="usage-stat-item today">
              <div class="usage-stat-label">今日</div>
              <div class="usage-stat-value" id="todayTokens">-</div>
              <div class="usage-stat-cost" id="todayCost">-</div>
            </div>
            <div class="usage-stat-item week">
              <div class="usage-stat-label">本周</div>
              <div class="usage-stat-value" id="weekTokens">-</div>
              <div class="usage-stat-cost" id="weekCost">-</div>
            </div>
            <div class="usage-stat-item month">
              <div class="usage-stat-label">本月</div>
              <div class="usage-stat-value" id="monthTokens">-</div>
              <div class="usage-stat-cost" id="monthCost">-</div>
            </div>
          </div>
          <div class="usage-chart-container" id="usageChartContainer">
            <div class="usage-chart-label">近 14 天用量趋势</div>
            <div class="usage-chart-wrapper">
              <div class="usage-chart-grid">
                <div class="usage-chart-grid-line"></div>
                <div class="usage-chart-grid-line"></div>
                <div class="usage-chart-grid-line"></div>
                <div class="usage-chart-grid-line"></div>
              </div>
              <svg class="usage-chart-cost-line" id="usageCostLine"></svg>
              <div class="usage-chart" id="usageChart"></div>
            </div>
            <div class="usage-chart-legend">
              <div class="usage-chart-legend-item"><span class="usage-chart-legend-dot tokens"></span> Token 用量</div>
              <div class="usage-chart-legend-item"><span class="usage-chart-legend-dot cost"></span> 费用趋势</div>
            </div>
          </div>
          <div class="usage-summary-bar" id="usageSummaryBar">
            <div class="usage-summary-item">
              <span class="usage-summary-label">日均用量</span>
              <span class="usage-summary-value" id="avgDailyTokens">-</span>
            </div>
            <div class="usage-summary-divider"></div>
            <div class="usage-summary-item">
              <span class="usage-summary-label">总调用次数</span>
              <span class="usage-summary-value" id="totalCallCount">-</span>
            </div>
            <div class="usage-summary-divider"></div>
            <div class="usage-summary-item">
              <span class="usage-summary-label">日均费用</span>
              <span class="usage-summary-value" id="avgDailyCost">-</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 高级设置（含生成参数） -->
      <div class="card">
        <div class="card-title"><span class="icon">🔧</span> 高级设置</div>

        <div class="form-group">
          <label>温度 <span class="hint">— 0=确定性 2=创造性</span> <span class="help-icon" title="AI 生成的随机性/创造性程度&#10;默认值: 0.7&#10;有效值: 0-2&#10;&#10;• 0: 最确定性，适合格式化输出&#10;• 0.7: 平衡确定性和多样性（推荐）&#10;• 2: 最随机，可能产生意外结果">?</span></label>
          <div class="range-row">
            <input type="range" id="temperature" min="0" max="2" value="0.7" step="0.1" />
            <span class="range-value" id="temperatureValue">0.7</span>
          </div>
        </div>

        <div class="form-group">
          <label>最大 Tokens <span class="help-icon" title="AI 响应的最大 Token 数&#10;默认值: 500&#10;有效值: 50-4000&#10;&#10;控制 AI 生成内容的最大长度。Token 数越大，生成的 commit 信息可能越长。">?</span></label>
          <input type="number" id="maxTokens" value="500" min="50" max="4000" step="50" />
        </div>

        <div class="form-group">
          <label>候选方案数 <span class="hint">— 一次几条</span> <span class="help-icon" title="一次生成的候选 commit 信息数量&#10;默认值: 2&#10;有效值: 1-5&#10;&#10;生成多条候选方案供选择，数量越多消耗 Token 越多。">?</span></label>
          <div class="range-row">
            <input type="range" id="candidateCount" min="1" max="5" value="2" step="1" />
            <span class="range-value" id="candidateCountValue">2</span>
          </div>
        </div>

        <div class="form-group">
          <label>Diff 截断阈值 <span class="hint">— 行数</span> <span class="help-icon" title="代码变更 diff 的最大行数&#10;默认值: 3000&#10;有效值: 500-10000&#10;&#10;超出此阈值的 diff 会被智能截断，以避免超出 AI 模型的上下文窗口。">?</span></label>
          <input type="number" id="diffTruncateThreshold" value="3000" min="500" max="10000" step="500" />
          <div class="field-desc" style="margin-top:4px;">可在项目根目录创建 <code>.aicommitignore</code> 文件排除敏感文件（语法同 <code>.gitignore</code>）</div>
        </div>

        <div class="form-group">
          <label>Diff 来源 <span class="help-icon" title="选择分析哪种代码变更&#10;默认值: 暂存区（staged）&#10;&#10;• 暂存区（staged）: 分析 git diff --cached 的变更&#10;  生成后可直接提交，适合正常工作流&#10;• 工作区（unstaged）: 分析 git diff 的变更&#10;  适用于暂存前预览 commit message 的场景&#10;&#10;注意: 使用「工作区」时，生成的 commit message 仅供参考&#10;仍需暂存后才能提交">?</span></label>
          <select id="diffSource">
            <option value="staged">暂存区（staged）— 默认</option>
            <option value="unstaged">工作区（unstaged）</option>
          </select>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div>
              <label>启用插件 <span class="help-icon" title="启用或禁用 AI Commit 插件&#10;默认值: 开启&#10;&#10;关闭后所有命令和 SCM 按钮将不可用">?</span></label>
              <div class="toggle-desc">关闭后所有命令和 SCM 按钮将不可用</div>
            </div>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="enabled" checked />
              <span class="checkbox-slider"></span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div>
              <label>流式响应 <span class="help-icon" title="启用流式响应（Streaming）&#10;默认值: 开启&#10;&#10;• 开启（默认）: AI 生成时逐步显示结果，首字显示时间 &lt; 1 秒&#10;  请求发送 stream: true 参数，解析 SSE 事件流&#10;• 关闭: 等待 AI 完整响应后一次性显示&#10;&#10;流式响应显著改善等待体验，建议保持开启&#10;若遇到兼容性问题（如部分私有部署不支持 SSE）可关闭">?</span></label>
              <div class="toggle-desc">AI 生成时逐步显示结果，改善等待体验</div>
            </div>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="enableStreaming" checked />
              <span class="checkbox-slider"></span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div>
              <label>项目上下文增强 <span class="help-icon" title="启用项目上下文增强&#10;默认值: 关闭&#10;&#10;开启后，生成 commit 信息时会自动附加:&#10;• 项目名称（从 Git remote 提取）&#10;• 最近5条提交记录（供 AI 参考风格）&#10;&#10;优势:&#10;• AI 生成的 commit 风格更一致&#10;• scope 检测更准确&#10;&#10;注意:&#10;• 会略微增加 Token 消耗&#10;• 适合已有提交历史的项目">?</span></label>
              <div class="toggle-desc">附加项目名称和最近提交记录给 AI 参考</div>
            </div>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="enableProjectContext" />
              <span class="checkbox-slider"></span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div>
              <label>保存生成历史 <span class="help-icon" title="保存每次生成的 commit 信息到本地历史&#10;默认值: 关闭&#10;&#10;开启后可在历史记录中回溯之前生成的 commit 信息">?</span></label>
              <div class="toggle-desc">每次生成的 commit message 保存到本地历史</div>
            </div>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="saveHistory" />
              <span class="checkbox-slider"></span>
            </div>
          </div>
          <div class="history-actions">
            <button class="inline-btn history-view-btn" id="viewHistoryBtn" type="button" title="查看并选择历史生成的 commit 信息"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5.75.75 0 0 1 1.5 0 8 8 0 1 1-3.68-6.75l.18.13V1a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75H9.25a.75.75 0 0 1 0-1.5h1.69A6.48 6.48 0 0 0 8 1.5z"/></svg> 查看历史</button>
            <button class="inline-btn history-clear-btn" id="clearHistoryBtn" type="button" title="清空所有生成历史记录"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75zM11 3V1.75A1.75 1.75 0 0 0 9.25 0h-2.5A1.75 1.75 0 0 0 5 1.75V3H2.75a.75.75 0 0 0 0 1.5h.9l.49 8.6a1.75 1.75 0 0 0 1.74 1.65h4.24a1.75 1.75 0 0 0 1.74-1.65l.49-8.6h.9a.75.75 0 0 0 0-1.5H11zm-5.35 9.12L5.2 4.5h5.6l-.45 7.62a.25.25 0 0 1-.25.23H5.9a.25.25 0 0 1-.25-.23z"/></svg> 清空历史</button>
          </div>
        </div>

        <div class="form-group">
          <label>代理设置 <span class="help-icon" title="配置代理地址，用于访问 AI API&#10;默认值: 空（不使用代理）&#10;&#10;格式示例:&#10;• HTTP 代理: http://proxy.example.com:8080&#10;• HTTPS 代理: https://proxy.example.com:8080&#10;• SOCKS5 代理: socks5://proxy.example.com:1080&#10;• 带认证: http://user:pass@proxy:8080 或 socks5://user:pass@proxy:1080&#10;&#10;留空则不使用代理&#10;也可通过环境变量 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY 配置">?</span></label>
          <input type="text" id="proxy" value="" placeholder="http://proxy:8080 或 socks5://proxy:1080（留空不使用代理）" />
        </div>

        <div class="form-group">
          <label>日志级别 <span class="help-icon" title="插件日志输出的详细程度&#10;默认值: info&#10;&#10;• error: 仅输出错误信息&#10;• warn: 输出错误和警告&#10;• info: 输出一般信息（推荐）&#10;• debug: 输出全部调试信息（排查问题时使用）">?</span></label>
          <select id="logLevel">
            <option value="error">error — 仅错误</option>
            <option value="warn">warn — 错误和警告</option>
            <option value="info" selected>info — 一般信息（推荐）</option>
            <option value="debug">debug — 全部调试信息</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- 底部保存栏 -->
  <div class="save-bar">
    <span class="unsaved-badge" id="unsavedBadge">● 配置已修改，请保存</span>
    <button class="reset-btn" id="resetBtn">重置</button>
    <button class="save-btn" id="saveBtn">保存配置</button>
  </div>

  <script type="text/javascript" nonce="${nonce}">
    (function() {
      function showError(msg) {
        try {
          var d = document.createElement('div');
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#d32f2f;color:#fff;padding:8px 16px;z-index:99999;font-size:12px;white-space:pre-wrap;';
          d.textContent = 'JS Error: ' + msg;
          document.body.appendChild(d);
        } catch(e) {}
      }
      window.onerror = function(msg, url, line) { showError(msg + ' (line ' + line + ')'); return false; };
      try {
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);

    let isDirty = false;
    let isTesting = false;
    let isFetching = false;
    let allModels = [];

    const els = {
      baseUrl: $('baseUrl'),
      baseUrlMsg: $('baseUrlMsg'),
      apiKey: $('apiKey'),
      apiKeyMsg: $('apiKeyMsg'),
      toggleApiKeyBtn: $('toggleApiKeyBtn'),
      modelInput: $('modelInput'),
      modelMsg: $('modelMsg'),
      modelCombobox: $('modelCombobox'),
      modelDropdown: $('modelDropdown'),
      fetchModelsBtn: $('fetchModelsBtn'),
      fetchModelsIcon: $('fetchModelsIcon'),
      testBtn: $('testBtn'),
      testResult: $('testResult'),
      formatInput: $('formatInput'),
      formatOptions: $('formatOptions'),
      autoDetectScope: $('autoDetectScope'),
      maxLength: $('maxLength'),
      maxLengthValue: $('maxLengthValue'),
      temperature: $('temperature'),
      temperatureValue: $('temperatureValue'),
      maxTokens: $('maxTokens'),
      candidateCount: $('candidateCount'),
      candidateCountValue: $('candidateCountValue'),
      diffTruncateThreshold: $('diffTruncateThreshold'),
      enabled: $('enabled'),
      customFormatGroup: $('customFormatGroup'),
      customFormatTemplate: $('customFormatTemplate'),
      customPresets: $('customPresets'),
      customPreview: $('customPreview'),
      saveHistory: $('saveHistory'),
      enableProjectContext: $('enableProjectContext'),
      logLevel: $('logLevel'),
      promptTemplate: $('promptTemplate'),
      customPromptGroup: $('customPromptGroup'),
      customPromptTemplate: $('customPromptTemplate'),
      promptPreview: $('promptPreview'),
      customModelPricing: $('customModelPricing'),
      exportUsageBtn: $('exportUsageBtn'),
      dailyBudget: $('dailyBudget'),
      monthlyBudget: $('monthlyBudget'),
      dailyBudgetUnit: $('dailyBudgetUnit'),
      monthlyBudgetUnit: $('monthlyBudgetUnit'),
      budgetProgress: $('budgetProgress'),
      budgetBarFill: $('budgetBarFill'),
      budgetBarLabel: $('budgetBarLabel'),
      currency: $('currency'),
      exchangeRateField: $('exchangeRateField'),
      exchangeRate: $('exchangeRate'),
      diffSource: $('diffSource'),
      commitLanguage: $('commitLanguage'),
      enableStreaming: $('enableStreaming'),
      proxy: $('proxy'),
      addGroupBtn: $('addGroupBtn'),
      modelGroupsList: $('modelGroupsList'),
      noGroupsHint: $('noGroupsHint'),
      viewHistoryBtn: $('viewHistoryBtn'),
      clearHistoryBtn: $('clearHistoryBtn'),
      saveBtn: $('saveBtn'),
      resetBtn: $('resetBtn'),
      unsavedBadge: $('unsavedBadge'),
      themeToggle: $('themeToggle'),
    };

    function applyTheme(theme) {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add('theme-' + theme);
      const darkIcon = document.getElementById('themeIconDark');
      const lightIcon = document.getElementById('themeIconLight');
      if (darkIcon && lightIcon) {
        darkIcon.style.display = theme === 'dark' ? '' : 'none';
        lightIcon.style.display = theme === 'light' ? '' : 'none';
      }
      els.themeToggle.title = theme === 'light' ? '切换到暗色主题' : '切换到亮色主题';
      try { localStorage.setItem('aicommit-theme', theme); } catch {}
    }

    (function initTheme() {
      let saved = 'dark';
      try { saved = localStorage.getItem('aicommit-theme') || 'dark'; } catch {}
      applyTheme(saved);
    })();

    els.themeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.contains('theme-light');
      applyTheme(isLight ? 'dark' : 'light');
    });

    function markDirty() {
      isDirty = true;
      els.unsavedBadge.classList.add('show');
      updateTestBtnState();
    }

    function validateBaseUrl() {
      const val = els.baseUrl.value.trim();
      els.baseUrl.classList.remove('invalid', 'valid');
      els.baseUrlMsg.textContent = '';
      els.baseUrlMsg.className = 'validation-msg';
      if (!val) { els.baseUrl.classList.add('invalid'); els.baseUrlMsg.textContent = 'Base URL 不能为空'; els.baseUrlMsg.classList.add('error'); return false; }
      try { new URL(val); } catch { els.baseUrl.classList.add('invalid'); els.baseUrlMsg.textContent = '无效的 URL 格式'; els.baseUrlMsg.classList.add('error'); return false; }
      if (!val.startsWith('http://') && !val.startsWith('https://')) { els.baseUrl.classList.add('invalid'); els.baseUrlMsg.textContent = 'URL 必须以 http:// 或 https:// 开头'; els.baseUrlMsg.classList.add('error'); return false; }
      els.baseUrl.classList.add('valid');
      return true;
    }

    function validateApiKey() {
      const val = els.apiKey.value.trim();
      els.apiKey.classList.remove('invalid', 'valid');
      els.apiKeyMsg.textContent = '';
      els.apiKeyMsg.className = 'validation-msg';
      if (!val) { els.apiKey.classList.add('invalid'); els.apiKeyMsg.textContent = 'API Key 不能为空'; els.apiKeyMsg.classList.add('error'); return false; }
      if (val.startsWith('$\\{env:')) { els.apiKeyMsg.textContent = 'ℹ 将从环境变量读取密钥'; els.apiKeyMsg.classList.add('warning'); }
      else if (val.length < 8) { els.apiKey.classList.add('invalid'); els.apiKeyMsg.textContent = 'API Key 长度似乎过短'; els.apiKeyMsg.classList.add('warning'); return true; }
      els.apiKey.classList.add('valid');
      return true;
    }

    function validateModel() {
      const val = els.modelInput.value.trim();
      els.modelInput.classList.remove('invalid', 'valid');
      els.modelMsg.textContent = '';
      els.modelMsg.className = 'validation-msg';
      if (!val) { els.modelInput.classList.add('invalid'); els.modelMsg.textContent = '模型名称不能为空'; els.modelMsg.classList.add('error'); return false; }
      els.modelInput.classList.add('valid');
      return true;
    }

    function updateTestBtnState() {
      const hasUrl = els.baseUrl.value.trim() !== '';
      const hasKey = els.apiKey.value.trim() !== '';
      const hasModel = els.modelInput.value.trim() !== '';
      els.testBtn.disabled = !hasUrl || !hasKey || !hasModel || isTesting;
    }

    els.baseUrl.addEventListener('input', () => { markDirty(); validateBaseUrl(); updateTestBtnState(); });
    els.baseUrl.addEventListener('blur', validateBaseUrl);
    els.apiKey.addEventListener('input', () => { markDirty(); validateApiKey(); updateTestBtnState(); });
    els.apiKey.addEventListener('blur', validateApiKey);

    els.toggleApiKeyBtn.addEventListener('click', () => {
      if (els.apiKey.type === 'password') {
        els.apiKey.type = 'text';
        els.toggleApiKeyBtn.innerHTML = '<svg class="eye-off-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2.1 1.7L1 2.8l2.4 2.4C1.8 6.5.5 8.2 0 8c1.7 2.7 4.5 5 8 5 .9 0 1.8-.2 2.6-.5l2.6 2.6 1.1-1.1-12.2-12.3zm5.9 9.8a3.5 3.5 0 0 1-3.4-3.4l3.4 3.4zm2-1.2a3.5 3.5 0 0 0-2.6-2.6l2.6 2.6zM8 3c-.5 0-1 .1-1.5.2l1.7 1.7C10.8 5.3 13 7 14.5 8c-.7 1.1-1.7 2.1-2.9 2.9l1.1 1.1c1.5-1 2.8-2.4 3.3-4-1.7-2.7-4.5-5-8-5z"/></svg>';
      } else {
        els.apiKey.type = 'password';
        els.toggleApiKeyBtn.innerHTML = '<svg class="eye-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.3 0 8c1.7 2.7 4.5 5 8 5s6.3-2.3 8-5c-1.7-2.7-4.5-5-8-5zm0 8.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm0-5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>';
      }
    });

    els.modelInput.addEventListener('input', () => {
      markDirty();
      validateModel();
      updateTestBtnState();
      filterModels();
    });

    els.modelInput.addEventListener('focus', () => {
      if (allModels.length > 0) { showDropdown(); filterModels(); }
    });

    els.modelInput.addEventListener('blur', () => {
      setTimeout(() => hideDropdown(), 150);
    });

    document.addEventListener('click', (e) => {
      if (!els.modelCombobox.contains(e.target)) { hideDropdown(); }
    });

    function showDropdown() {
      els.modelDropdown.classList.add('show');
      els.modelInput.style.borderBottomLeftRadius = '0';
      els.modelInput.style.borderBottomRightRadius = '0';
    }

    function hideDropdown() {
      els.modelDropdown.classList.remove('show');
      els.modelInput.style.borderBottomLeftRadius = '';
      els.modelInput.style.borderBottomRightRadius = '';
    }

    function fuzzyMatch(text, query) {
      const t = text.toLowerCase();
      const q = query.toLowerCase();
      if (t.includes(q)) return true;
      let qi = 0;
      for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) qi++;
      }
      return qi === q.length;
    }

    function highlightMatch(text, query) {
      if (!query) return text;
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return text;
      return text.substring(0, idx) + '<mark>' + text.substring(idx, idx + query.length) + '</mark>' + text.substring(idx + query.length);
    }

    function filterModels() {
      if (allModels.length === 0) return;
      const query = els.modelInput.value.trim();
      const filtered = query ? allModels.filter(m => fuzzyMatch(m.id, query)) : allModels;
      renderDropdown(filtered, query);
      if (filtered.length > 0) { showDropdown(); } else { hideDropdown(); }
    }

    function renderDropdown(models, query) {
      els.modelDropdown.innerHTML = '';
      if (models.length === 0) {
        els.modelDropdown.innerHTML = '<div class="no-results">无匹配模型</div>';
        return;
      }
      const currentVal = els.modelInput.value.trim();
      models.forEach(m => {
        const item = document.createElement('div');
        item.className = 'model-combobox-item' + (m.id === currentVal ? ' selected' : '');
        const tags = getModelTags(m.id);
        let tagsHtml = '';
        if (tags.length > 0) {
          tagsHtml = '<div class="model-tags">' + tags.map(t =>
            '<span class="model-tag model-tag-' + t.type + '">' + t.label + '</span>'
          ).join('') + '</div>';
        }
        const idHtml = query ? highlightMatch(m.id, query) : m.id;
        item.innerHTML = '<span class="model-id">' + idHtml + '</span>' +
          (m.owned_by ? '<span class="model-owner">' + m.owned_by + '</span>' : '') +
          tagsHtml;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          els.modelInput.value = m.id;
          hideDropdown();
          markDirty();
          validateModel();
          updateTestBtnState();
        });
        els.modelDropdown.appendChild(item);
      });
    }

    function selectFormat(el) {
      if (!el || !el.dataset.value) return;
      document.querySelectorAll('#formatOptions .format-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      els.formatInput.value = el.dataset.value;
      els.customFormatGroup.style.display = el.dataset.value === 'custom' ? 'block' : 'none';
      markDirty();
    }

    function selectCustomPreset(el) {
      if (!el || !el.dataset.template) return;
      document.querySelectorAll('#customPresets .format-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      const tpl = CUSTOM_PRESET_TEMPLATES[el.dataset.template] || el.dataset.template;
      els.customFormatTemplate.value = tpl;
      updateCustomPreview();
      markDirty();
    }

    document.querySelectorAll('#formatOptions .format-option').forEach(el => {
      el.addEventListener('click', () => selectFormat(el));
    });

    document.querySelectorAll('#customPresets .format-option').forEach(el => {
      el.addEventListener('click', () => selectCustomPreset(el));
    });

    let promptPreviewsData = {};

    const CUSTOM_PRESET_TEMPLATES = {
      'standard': '<type>(<scope>): <description>',
      'bracket': '[<type>] <scope>: <description>',
      'concise': '<type>: <description>',
      'scope-first': '(<scope>) <type>: <description>',
    };

    els.customFormatTemplate.addEventListener('input', () => {
      const val = els.customFormatTemplate.value;
      els.customPresets.querySelectorAll('.format-option').forEach(o => {
        const tpl = CUSTOM_PRESET_TEMPLATES[o.dataset.template] || o.dataset.template;
        o.classList.toggle('selected', tpl === val);
      });
      updateCustomPreview();
      markDirty();
    });

    function updateCustomPreview() {
      const tpl = els.customFormatTemplate.value;
      const preview = tpl
        .replace(/<type>/g, 'feat')
        .replace(/<scope>/g, 'auth')
        .replace(/<description>/g, '添加用户登录功能')
        .replace(/<body>/g, '- 实现基于 JWT 的用户登录认证;');
      const previewEl = $('customPreview');
      if (previewEl) {
        previewEl.textContent = '预览: ' + preview;
        previewEl.className = 'validation-msg success';
      }
    }

    els.maxLength.addEventListener('input', () => { els.maxLengthValue.textContent = els.maxLength.value; markDirty(); });
    els.temperature.addEventListener('input', () => { els.temperatureValue.textContent = els.temperature.value; markDirty(); });
    els.candidateCount.addEventListener('input', () => { els.candidateCountValue.textContent = els.candidateCount.value; markDirty(); });
    els.maxTokens.addEventListener('input', markDirty);
    els.diffTruncateThreshold.addEventListener('input', markDirty);
    els.autoDetectScope.addEventListener('change', markDirty);
    els.enabled.addEventListener('change', markDirty);
    els.customFormatTemplate.addEventListener('input', markDirty);
    els.saveHistory.addEventListener('change', markDirty);
    els.enableProjectContext.addEventListener('change', markDirty);
    els.logLevel.addEventListener('change', markDirty);
    els.diffSource.addEventListener('change', markDirty);
    els.commitLanguage.addEventListener('change', markDirty);
    els.enableStreaming.addEventListener('change', markDirty);
    els.proxy.addEventListener('input', markDirty);
    els.addGroupBtn.addEventListener('click', () => handleAddGroup());
    els.viewHistoryBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'viewHistory' });
    });
    els.clearHistoryBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
    });

    els.promptTemplate.addEventListener('change', () => {
      els.customPromptGroup.style.display = els.promptTemplate.value === 'custom' ? 'block' : 'none';
      updatePromptPreview();
      markDirty();
    });

    els.customPromptTemplate.addEventListener('input', () => { markDirty(); updatePromptPreview(); });

    function updatePromptPreview() {
      const id = els.promptTemplate.value;
      const nameEl = document.getElementById('promptPreviewName');
      const descEl = document.getElementById('promptPreviewDesc');
      const contentEl = document.getElementById('promptPreviewContent');
      if (id === 'custom' && els.customPromptTemplate.value.trim()) {
        if (nameEl) nameEl.textContent = '\u81EA\u5B9A\u4E49\u6A21\u677F';
        if (descEl) descEl.textContent = '';
        if (contentEl) contentEl.textContent = els.customPromptTemplate.value;
      } else if (promptPreviewsData[id]) {
        const data = promptPreviewsData[id];
        if (nameEl) nameEl.textContent = data.name || '';
        if (descEl) descEl.textContent = data.description ? '- ' + data.description : '';
        if (contentEl) contentEl.textContent = data.content || '';
      } else {
        if (nameEl) nameEl.textContent = '\u52A0\u8F7D\u4E2D...';
        if (descEl) descEl.textContent = '';
        if (contentEl) contentEl.textContent = '';
        vscode.postMessage({ type: 'refreshPromptPreview' });
      }
    }

    updatePromptPreview();
    els.customModelPricing.addEventListener('input', markDirty);

    els.exportUsageBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportUsage' });
    });

    els.currency.addEventListener('change', () => {
      const isCNY = els.currency.value === 'CNY';
      els.exchangeRateField.style.display = isCNY ? 'flex' : 'none';
      const symbol = isCNY ? '\u00A5' : '$';
      els.dailyBudgetUnit.textContent = symbol;
      els.monthlyBudgetUnit.textContent = symbol;
      markDirty();
      vscode.postMessage({ type: 'refreshUsageStats' });
    });

    els.dailyBudget.addEventListener('input', () => { markDirty(); updateBudgetProgress(); });
    els.monthlyBudget.addEventListener('input', () => { markDirty(); updateBudgetProgress(); });
    els.exchangeRate.addEventListener('input', () => { markDirty(); });

    function formatCost(usd) {
      const isCNY = els.currency.value === 'CNY';
      const rate = parseFloat(els.exchangeRate.value) || 7.2;
      if (isCNY) {
        return '\u00A5' + (usd * rate).toFixed(4);
      }
      return '$' + usd.toFixed(4);
    }

    function formatTokens(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    }

    function updateBudgetProgress() {
      const dailyBudget = parseFloat(els.dailyBudget.value) || 0;
      const monthlyBudget = parseFloat(els.monthlyBudget.value) || 0;
      if (dailyBudget <= 0 && monthlyBudget <= 0) {
        els.budgetProgress.style.display = 'none';
        return;
      }
      els.budgetProgress.style.display = 'block';
      let pct = 0;
      let label = '';
      if (monthlyBudget > 0 && currentUsageStats && currentUsageStats.month) {
        pct = Math.min(currentUsageStats.month.totalCost / monthlyBudget * 100, 100);
        label = '\u6708\u9884\u7B97: ' + formatCost(currentUsageStats.month.totalCost) + ' / ' + formatCost(monthlyBudget) + ' (' + Math.round(pct) + '%)';
      } else if (dailyBudget > 0 && currentUsageStats && currentUsageStats.today) {
        pct = Math.min(currentUsageStats.today.totalCost / dailyBudget * 100, 100);
        label = '\u65E5\u9884\u7B97: ' + formatCost(currentUsageStats.today.totalCost) + ' / ' + formatCost(dailyBudget) + ' (' + Math.round(pct) + '%)';
      }
      els.budgetBarFill.style.width = pct + '%';
      els.budgetBarFill.className = 'budget-bar-fill' + (pct >= 100 ? ' exceeded' : pct >= 80 ? ' warning' : '');
      els.budgetBarLabel.textContent = label;
    }

    let currentUsageStats = null;
    let currentModelGroups = [];
    let currentActiveGroup = '';

    function renderModelGroups(groups, activeName) {
      currentModelGroups = groups || [];
      currentActiveGroup = activeName || '';
      const container = els.modelGroupsList;
      const hint = els.noGroupsHint;

      if (!currentModelGroups.length) {
        container.innerHTML = '';
        hint.style.display = '';
        return;
      }

      hint.style.display = 'none';
      container.innerHTML = currentModelGroups.map((g, i) => {
        const isActive = g.name === currentActiveGroup;
        return '<div class="model-group-item' + (isActive ? ' active' : '') + '" data-index="' + i + '">' +
          '<div class="model-group-header">' +
            '<div>' +
              '<div class="model-group-name">' +
                (isActive ? '<span class="model-group-active-badge">当前</span> ' : '') +
                g.name +
              '</div>' +
              '<div class="model-group-model">' + g.model + ' · ' + g.baseUrl + '</div>' +
            '</div>' +
            '<div class="model-group-actions">' +
              (isActive ? '' : '<button class="activate-btn" data-index="' + i + '" title="切换到此配置组">切换</button>') +
              '<button class="edit-btn" data-index="' + i + '" title="编辑此配置组">编辑</button>' +
              '<button class="delete-btn" data-index="' + i + '" title="删除此配置组">删除</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      container.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          const group = currentModelGroups[idx];
          if (group) {
            handleSwitchGroup(group.name);
          }
        });
      });

      container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          const group = currentModelGroups[idx];
          if (group) {
            handleDeleteGroup(group.name);
          }
        });
      });

      container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          const group = currentModelGroups[idx];
          if (group) {
            handleEditGroup(group.name);
          }
        });
      });
    }

    function handleAddGroup() {
      vscode.postMessage({
        type: 'addGroup',
      });
    }

    function handleSwitchGroup(name) {
      vscode.postMessage({
        type: 'switchGroup',
        data: { name },
      });
    }

    function handleDeleteGroup(name) {
      vscode.postMessage({
        type: 'deleteGroup',
        data: { name },
      });
    }

    function handleEditGroup(name) {
      vscode.postMessage({
        type: 'editGroup',
        data: { name },
      });
    }

    function renderUsageStats(stats) {
      currentUsageStats = stats;
      if (!stats) return;
      if (stats.today) {
        document.getElementById('todayTokens').textContent = formatTokens(stats.today.totalTokens);
        document.getElementById('todayCost').textContent = formatCost(stats.today.totalCost) + ' (' + stats.today.count + '\u6B21)';
      }
      if (stats.week) {
        document.getElementById('weekTokens').textContent = formatTokens(stats.week.totalTokens);
        document.getElementById('weekCost').textContent = formatCost(stats.week.totalCost) + ' (' + stats.week.count + '\u6B21)';
      }
      if (stats.month) {
        document.getElementById('monthTokens').textContent = formatTokens(stats.month.totalTokens);
        document.getElementById('monthCost').textContent = formatCost(stats.month.totalCost) + ' (' + stats.month.count + '\u6B21)';
      }
      if (stats.dailyChart && stats.dailyChart.length > 0) {
        const chart = document.getElementById('usageChart');
        const costLineSvg = document.getElementById('usageCostLine');
        const maxTokens = Math.max(...stats.dailyChart.map(d => d.tokens), 1);
        const maxCost = Math.max(...stats.dailyChart.map(d => d.cost), 0.0001);
        chart.innerHTML = '';
        stats.dailyChart.forEach((d, idx) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'usage-chart-bar-wrapper';
          const bar = document.createElement('div');
          bar.className = 'usage-chart-bar';
          const height = Math.max((d.tokens / maxTokens) * 100, d.tokens > 0 ? 4 : 0);
          bar.style.height = height + '%';
          const dateLabel = d.date.substring(5);
          bar.title = dateLabel + '  ' + formatTokens(d.tokens) + ' tokens · ' + formatCost(d.cost);
          const dateEl = document.createElement('div');
          dateEl.className = 'usage-chart-date';
          dateEl.textContent = (idx % 2 === 0 || stats.dailyChart.length <= 7) ? dateLabel : '';
          wrapper.appendChild(bar);
          wrapper.appendChild(dateEl);
          chart.appendChild(wrapper);
        });
        if (costLineSvg) {
          const chartHeight = 110;
          const barWidth = 100 / stats.dailyChart.length;
          const points = stats.dailyChart.map((d, i) => {
            const x = (i + 0.5) * barWidth;
            const y = chartHeight - Math.max((d.cost / maxCost) * (chartHeight - 10), d.cost > 0 ? 4 : 0);
            return x + ',' + y;
          });
          costLineSvg.setAttribute('viewBox', '0 0 100 ' + chartHeight);
          costLineSvg.setAttribute('preserveAspectRatio', 'none');
          costLineSvg.innerHTML = '<polyline points="' + points.join(' ') + '" fill="none" stroke="#f59e0b" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>' +
            stats.dailyChart.map((d, i) => {
              const x = (i + 0.5) * barWidth;
              const y = chartHeight - Math.max((d.cost / maxCost) * (chartHeight - 10), d.cost > 0 ? 4 : 0);
              return '<circle cx="' + x + '" cy="' + y + '" r="1" fill="#f59e0b" opacity="0.8"/>';
            }).join('');
        }
      }
      if (stats.dailyChart && stats.dailyChart.length > 0) {
        const totalTokens = stats.dailyChart.reduce((s, d) => s + d.tokens, 0);
        const totalCost = stats.dailyChart.reduce((s, d) => s + d.cost, 0);
        const totalCount = stats.dailyChart.reduce((s, d) => s + (d.count || 0), 0);
        const days = stats.dailyChart.length;
        const avgDailyEl = document.getElementById('avgDailyTokens');
        const totalCallEl = document.getElementById('totalCallCount');
        const avgCostEl = document.getElementById('avgDailyCost');
        if (avgDailyEl) avgDailyEl.textContent = formatTokens(Math.round(totalTokens / days));
        if (totalCallEl) totalCallEl.textContent = totalCount + ' \u6B21';
        if (avgCostEl) avgCostEl.textContent = formatCost(totalCost / days);
      }
      updateBudgetProgress();
    }

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'retry-fetch') {
        els.fetchModelsBtn.click();
      } else if (action === 'retry-test') {
        els.testBtn.click();
      }
    });

    els.fetchModelsBtn.addEventListener('click', () => {
      if (isFetching) return;
      if (!validateBaseUrl() || !validateApiKey()) return;
      isFetching = true;
      els.fetchModelsBtn.disabled = true;
      els.fetchModelsIcon.innerHTML = '<span class="spinner"></span>';
      vscode.postMessage({ type: 'fetchModels', data: { baseUrl: els.baseUrl.value.trim(), apiKey: els.apiKey.value.trim() } });
    });

    els.testBtn.addEventListener('click', () => {
      if (isTesting) return;
      if (!validateBaseUrl() || !validateApiKey() || !validateModel()) return;
      isTesting = true;
      els.testBtn.disabled = true;
      els.testBtn.innerHTML = '<span class="spinner"></span> 测试中...';
      els.testResult.className = 'test-result-box';
      els.testResult.textContent = '';
      vscode.postMessage({ type: 'testConnection', data: { baseUrl: els.baseUrl.value.trim(), apiKey: els.apiKey.value.trim(), model: els.modelInput.value.trim() } });
    });

    els.saveBtn.addEventListener('click', () => {
      const v1 = validateBaseUrl();
      const v2 = validateApiKey();
      const v3 = validateModel();
      if (!v1 || !v2 || !v3) return;
      els.saveBtn.disabled = true;
      els.saveBtn.textContent = '保存中...';
      vscode.postMessage({
        type: 'saveConfig',
        data: {
          baseUrl: els.baseUrl.value.trim(),
          apiKey: els.apiKey.value.trim(),
          model: els.modelInput.value.trim(),
          format: els.formatInput.value,
          temperature: parseFloat(els.temperature.value),
          maxTokens: parseInt(els.maxTokens.value),
          maxLength: parseInt(els.maxLength.value),
          candidateCount: parseInt(els.candidateCount.value),
          autoDetectScope: els.autoDetectScope.checked,
          diffTruncateThreshold: parseInt(els.diffTruncateThreshold.value),
          enabled: els.enabled.checked,
          customFormatTemplate: els.customFormatTemplate.value.trim(),
          saveHistory: els.saveHistory.checked,
          logLevel: els.logLevel.value,
          promptTemplate: els.promptTemplate.value,
          customPromptTemplate: els.customPromptTemplate.value,
          enableProjectContext: els.enableProjectContext.checked,
          customModelPricing: els.customModelPricing.value,
          dailyBudget: parseFloat(els.dailyBudget.value) || 0,
          monthlyBudget: parseFloat(els.monthlyBudget.value) || 0,
          currency: els.currency.value,
          exchangeRate: parseFloat(els.exchangeRate.value) || 7.2,
          diffSource: els.diffSource.value,
          commitLanguage: els.commitLanguage.value,
          enableStreaming: els.enableStreaming.checked,
          proxy: els.proxy.value.trim(),
        },
      });
    });

    els.resetBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'ready' });
    });

    function getModelTags(modelId) {
      const id = modelId.toLowerCase();
      const tags = [];
      if (/embed/i.test(id)) { tags.push({ type: 'embedding', label: '嵌入' }); return tags; }
      if (/tts/i.test(id)) { tags.push({ type: 'tts', label: '语音合成' }); return tags; }
      if (/whisper/i.test(id)) { tags.push({ type: 'audio', label: '语音' }); return tags; }
      if (/dall-e|dalle|image|img/i.test(id)) { tags.push({ type: 'image', label: '图像' }); return tags; }
      if (/sora|video/i.test(id)) { tags.push({ type: 'video', label: '视频' }); return tags; }
      if (/moderate/i.test(id)) { return tags; }
      tags.push({ type: 'language', label: '语言' });
      if (/gpt-4o|gpt-4-turbo|vision|claude-3|gemini|qwen-vl|qwen2-vl/i.test(id)) { tags.push({ type: 'vision', label: '视觉' }); }
      if (/audio|gpt-4o-audio/i.test(id)) { tags.push({ type: 'audio', label: '音频' }); }
      if (/coder|code|deepseek-coder|codestral/i.test(id)) { tags.push({ type: 'code', label: '代码' }); }
      if (/search|web/i.test(id)) { tags.push({ type: 'search', label: '搜索' }); }
      if (/reason|think|deepseek-reasoner|o1-|o3-|o4-/i.test(id)) { tags.push({ type: 'reasoning', label: '深度思考' }); }
      if (/chat|turbo|gpt-3\\.5|gpt-4|claude|gemini|qwen|deepseek|moonshot|glm/i.test(id)) {
        if (!tags.some(t => t.type === 'code')) { tags.push({ type: 'chat', label: '对话' }); }
      }
      return tags;
    }

    function getErrorIcon(errorType) {
      switch (errorType) {
        case 'auth': return '🔑';
        case 'quota': return '💰';
        case 'rate': return '⏳';
        case 'network': return '🌐';
        case 'timeout': return '⏱';
        default: return '✗';
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'initConfig': {
          const d = msg.data;
          els.baseUrl.value = d.baseUrl || '';
          els.apiKey.value = d.apiKey || '';
          els.modelInput.value = d.model || '';
          els.formatInput.value = d.format || 'bullet';
          els.autoDetectScope.checked = d.autoDetectScope !== false;
          els.maxLength.value = d.maxLength || 72;
          els.maxLengthValue.textContent = d.maxLength || 72;
          els.temperature.value = d.temperature ?? 0.7;
          els.temperatureValue.textContent = d.temperature ?? 0.7;
          els.maxTokens.value = d.maxTokens || 500;
          els.candidateCount.value = d.candidateCount || 2;
          els.candidateCountValue.textContent = d.candidateCount || 2;
          els.diffTruncateThreshold.value = d.diffTruncateThreshold || 3000;
          els.enabled.checked = d.enabled !== false;
          els.customFormatTemplate.value = d.customFormatTemplate || '<type>(<scope>): <description>';
          els.saveHistory.checked = d.saveHistory === true;
          els.enableProjectContext.checked = d.enableProjectContext === true;
          els.logLevel.value = d.logLevel || 'info';
          els.promptTemplate.value = d.promptTemplate || 'bullet';
          els.customPromptGroup.style.display = els.promptTemplate.value === 'custom' ? 'block' : 'none';
          els.customPromptTemplate.value = d.customPromptTemplate || '';
          els.customModelPricing.value = d.customModelPricing || '';
          els.dailyBudget.value = d.dailyBudget ?? 0;
          els.monthlyBudget.value = d.monthlyBudget ?? 0;
          els.currency.value = d.currency || 'USD';
          els.exchangeRate.value = d.exchangeRate ?? 7.2;
          els.diffSource.value = d.diffSource || 'staged';
          els.commitLanguage.value = d.commitLanguage || 'English';
          els.enableStreaming.checked = d.enableStreaming !== false;
          els.proxy.value = d.proxy || '';
          renderModelGroups(d.modelGroups, d.activeModelGroup);
          const isCNY = els.currency.value === 'CNY';
          els.exchangeRateField.style.display = isCNY ? 'flex' : 'none';
          els.dailyBudgetUnit.textContent = isCNY ? '\u00A5' : '$';
          els.monthlyBudgetUnit.textContent = isCNY ? '\u00A5' : '$';
          const currentFormat = d.format || 'bullet';
          els.formatOptions.querySelectorAll('.format-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === currentFormat);
          });
          els.customFormatGroup.style.display = currentFormat === 'custom' ? 'block' : 'none';
          const currentTpl = d.customFormatTemplate || '<type>(<scope>): <description>';
          els.customPresets.querySelectorAll('.format-option').forEach(o => {
            const tpl = CUSTOM_PRESET_TEMPLATES[o.dataset.template] || o.dataset.template;
            o.classList.toggle('selected', tpl === currentTpl);
          });
          updatePromptPreview();
          isDirty = false;
          els.unsavedBadge.classList.remove('show');
          updateTestBtnState();
          break;
        }

        case 'promptPreviewsData': {
          if (msg.data && msg.data.promptPreviews) {
            promptPreviewsData = msg.data.promptPreviews;
            updatePromptPreview();
          }
          break;
        }

        case 'usageStatsData': {
          if (msg.data) {
            renderUsageStats(msg.data);
          }
          break;
        }

        case 'fetchModelsLoading':
          if (!msg.data) { isFetching = false; els.fetchModelsBtn.disabled = false; els.fetchModelsIcon.textContent = '⇣'; }
          break;

        case 'fetchModelsResult':
          isFetching = false;
          els.fetchModelsBtn.disabled = false;
          els.fetchModelsIcon.textContent = '⇣';
          if (msg.data.success) {
            const models = msg.data.models || [];
            allModels = models;
            if (models.length > 0) {
              els.modelMsg.textContent = '✓ 已获取 ' + models.length + ' 个可用模型，点击输入框选择';
              els.modelMsg.className = 'validation-msg success';
              filterModels();
            } else {
              allModels = [];
              els.modelMsg.textContent = '模型列表为空，请手动输入模型名称';
              els.modelMsg.className = 'validation-msg warning';
              hideDropdown();
            }
          } else {
            allModels = [];
            const errorIcon = getErrorIcon(msg.data.errorType);
            els.modelMsg.innerHTML = errorIcon + ' ' + msg.data.error + ' <span class="retry-link" data-action="retry-fetch">重试</span>';
            els.modelMsg.className = 'validation-msg error';
            hideDropdown();
          }
          break;

        case 'testConnectionLoading':
          if (!msg.data) { isTesting = false; els.testBtn.disabled = false; els.testBtn.innerHTML = '⏱ 测试连接'; updateTestBtnState(); }
          break;

        case 'testConnectionResult':
          isTesting = false;
          els.testBtn.disabled = false;
          els.testBtn.innerHTML = '⏱ 测试连接';
          updateTestBtnState();
          if (msg.data.success) {
            els.testResult.className = 'test-result-box show success';
            els.testResult.innerHTML = '<div class="result-title">✓ 连接成功</div><div class="result-detail">' + msg.data.message + '</div>';
          } else {
            const errorIcon = getErrorIcon(msg.data.errorType);
            const retryHtml = ' <span class="retry-link" data-action="retry-test">重试</span>';
            els.testResult.className = 'test-result-box show error';
            els.testResult.innerHTML = '<div class="result-title">' + errorIcon + ' 连接失败</div><div class="result-detail">' + msg.data.message + retryHtml + '</div>';
          }
          break;

        case 'saveConfigResult':
          els.saveBtn.disabled = false;
          els.saveBtn.innerHTML = '保存配置';
          if (msg.data.success) { isDirty = false; els.unsavedBadge.classList.remove('show'); }
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
    document.body.setAttribute('data-js-loaded', 'true');
      } catch(err) { showError(err.message + ' (stack: ' + (err.stack || '').substring(0, 200) + ')'); }
    })();
  <\/script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function parseModelPricing(text: string): Record<string, { input: number; output: number; cacheRead?: number }> {
  const result: Record<string, { input: number; output: number; cacheRead?: number }> = {};
  if (!text) { return result; }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { continue; }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) { continue; }
    const name = trimmed.substring(0, eqIdx).trim();
    const prices = trimmed.substring(eqIdx + 1).split(',').map(s => parseFloat(s.trim()));
    if (name && prices.length >= 2 && !isNaN(prices[0]) && !isNaN(prices[1])) {
      const entry: { input: number; output: number; cacheRead?: number } = { input: prices[0], output: prices[1] };
      if (prices.length >= 3 && !isNaN(prices[2])) {
        entry.cacheRead = prices[2];
      }
      result[name] = entry;
    }
  }
  return result;
}

function formatModelPricing(obj: Record<string, { input: number; output: number; cacheRead?: number }>): string {
  if (!obj || typeof obj !== 'object') { return ''; }
  return Object.entries(obj)
    .map(([name, pricing]) => {
      let line = `${name}=${pricing.input},${pricing.output}`;
      if (pricing.cacheRead !== undefined && pricing.cacheRead !== null) {
        line += `,${pricing.cacheRead}`;
      }
      return line;
    })
    .join('\n');
}

function classifyError(error: unknown): { success: false; error: string; errorType: string } {
  if (error instanceof AiCommitError) {
    const userMsg = getUserMessage(error);
    switch (error.code) {
      case ErrorCode.API_AUTH_FAILED:
        return { success: false, error: userMsg + '。请检查 API Key 是否正确。', errorType: 'auth' };
      case ErrorCode.API_QUOTA_EXCEEDED:
        return { success: false, error: userMsg + '。请登录服务商控制台查看余额。', errorType: 'quota' };
      case ErrorCode.API_RATE_LIMITED:
        return { success: false, error: userMsg + '。请等待片刻后重试。', errorType: 'rate' };
      case ErrorCode.NETWORK_ERROR:
        return { success: false, error: userMsg + '。请检查 Base URL 是否正确、网络是否可用。', errorType: 'network' };
      case ErrorCode.NETWORK_TIMEOUT:
        return { success: false, error: userMsg + '。可能是网络不稳定或服务器响应慢，请重试。', errorType: 'timeout' };
      default:
        return { success: false, error: userMsg, errorType: 'unknown' };
    }
  }
  return { success: false, error: (error as Error).message, errorType: 'unknown' };
}
