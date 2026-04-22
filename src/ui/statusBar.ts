import * as vscode from 'vscode';
import { Logger } from '../utils';
import { TokenTracker } from '../ai';

export class StatusBarManager {
  public readonly statusBarItem: vscode.StatusBarItem;
  private readonly configBarItem: vscode.StatusBarItem;
  private readonly groupBarItem: vscode.StatusBarItem;
  private configBarShown = false;
  private currentGroupName: string = '';

  constructor(
    private logger: Logger,
    private tokenTracker: TokenTracker,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50,
    );
    this.statusBarItem.text = '$(sparkle) AI Commit';
    this.statusBarItem.tooltip = 'AI Commit - 点击生成 commit 信息';
    this.statusBarItem.command = 'aicommit.generate';

    this.groupBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      51,
    );
    this.groupBarItem.text = '';
    this.groupBarItem.tooltip = 'AI Commit - 点击切换模型配置组';
    this.groupBarItem.command = 'aicommit.switchModelGroup';
    this.groupBarItem.hide();

    this.configBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      49,
    );
    this.configBarItem.text = '$(gear)  AI Commit配置';
    this.configBarItem.tooltip = 'AI Commit - 打开配置面板';
    this.configBarItem.command = 'aicommit.openConfig';

    this.applyVisibility();
  }

  applyVisibility(showConfig?: boolean, showGroup?: boolean, showGenerate?: boolean): void {
    const cfg = vscode.workspace.getConfiguration('aicommit');
    const sc = showConfig !== undefined ? showConfig : cfg.get<boolean>('showStatusBarConfig', true);
    const sg = showGroup !== undefined ? showGroup : cfg.get<boolean>('showStatusBarGroup', true);
    const sm = showGenerate !== undefined ? showGenerate : cfg.get<boolean>('showStatusBarGenerate', true);

    if (sc) { this.configBarItem.show(); this.configBarShown = true; }
    else { this.configBarItem.hide(); this.configBarShown = false; }

    if (sm) { this.statusBarItem.show(); }
    else { this.statusBarItem.hide(); }

    if (sg && this.currentGroupName) { this.groupBarItem.show(); }
    else { this.groupBarItem.hide(); }
  }

  updateGroupName(name: string): void {
    this.currentGroupName = name;
    if (name) {
      this.groupBarItem.text = `$(server) ${name}`;
      this.groupBarItem.tooltip = `AI Commit - 当前配置组: ${name}\n点击切换配置组`;
      this.groupBarItem.show();
    } else {
      this.groupBarItem.text = '';
      this.groupBarItem.hide();
    }
  }

  getGroupName(): string {
    return this.currentGroupName;
  }

  showConfigBar(): void {
    if (!this.configBarShown) {
      this.configBarShown = true;
      this.configBarItem.show();
    }
    this.updateConfigBarTooltip();
  }

  hideConfigBar(): void {
    if (this.configBarShown) {
      this.configBarShown = false;
      this.configBarItem.hide();
    }
  }

  updateConfigBarTooltip(): void {
    this.configBarItem.tooltip = this.tokenTracker.getTooltipText();
  }

  setLoading(): void {
    this.statusBarItem.text = '$(loading~spin) AI Commit: 生成中...';
  }

  resetLoading(): void {
    this.statusBarItem.text = '$(sparkle) AI Commit';
    this.updateConfigBarTooltip();
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.configBarItem.dispose();
    this.groupBarItem.dispose();
  }
}
