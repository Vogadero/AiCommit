import * as vscode from 'vscode';
import { Logger } from '../utils';

export class ScmButtonProvider implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private isLoading = false;
  private gitApi: any = null;

  constructor(private logger: Logger) {
    this.init();
  }

  private async init(): Promise<void> {
    this.gitApi = await this.getGitApi();
    if (this.gitApi) {
      this.applyButtonsToAllRepos();
      this.disposables.push(
        this.gitApi.onDidOpenRepository((repo: any) => this.applyButton(repo)),
      );
      this.disposables.push(
        this.gitApi.onDidCloseRepository((repo: any) => {
          try { repo.inputBox.actionButton = undefined; } catch { /* ignore */ }
        }),
      );
    }
  }

  private async getGitApi(): Promise<any | null> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) { return null; }
      if (!gitExtension.isActive) { await gitExtension.activate(); }
      return gitExtension.exports?.getAPI(1) || null;
    } catch { return null; }
  }

  private getButtonConfig(): { label: string; tooltip: string; command: { title: string; command: string } } {
    if (this.isLoading) {
      return {
        label: '$(loading~spin) AI Commit',
        tooltip: 'AI Commit: 正在生成中...点击取消',
        command: { title: '取消生成', command: 'aicommit.cancelGeneration' },
      };
    }
    return {
      label: '$(sparkle) AI Commit',
      tooltip: 'AI Commit: 点击生成 AI Commit 信息',
      command: { title: '生成 Commit', command: 'aicommit.generate' },
    };
  }

  private applyButton(repo: any): void {
    try {
      repo.inputBox.actionButton = this.getButtonConfig();
    } catch { /* ignore */ }
  }

  private applyButtonsToAllRepos(): void {
    if (!this.gitApi) { return; }
    for (const repo of this.gitApi.repositories) {
      this.applyButton(repo);
    }
  }

  setLoading(): void {
    if (this.isLoading) { return; }
    this.isLoading = true;
    this.applyButtonsToAllRepos();
  }

  resetLoading(): void {
    if (!this.isLoading) { return; }
    this.isLoading = false;
    this.applyButtonsToAllRepos();
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
