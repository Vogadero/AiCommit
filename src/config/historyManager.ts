import * as vscode from 'vscode';
import { Logger } from '../utils';

export interface HistoryEntry {
  message: string;
  model: string;
  timestamp: number;
  date: string;
  diffHash: string;
  fileCount: number;
}

const STORAGE_KEY = 'aicommit.history';
const MAX_HISTORY = 100;

export class HistoryManager {
  private entries: HistoryEntry[] = [];

  constructor(
    private logger: Logger,
    private context: vscode.ExtensionContext,
  ) {
    this.load();
  }

  private load(): void {
    try {
      const data = this.context.globalState.get<string>(STORAGE_KEY, '');
      if (data) {
        this.entries = JSON.parse(data);
        this.logger.debug(`已加载 ${this.entries.length} 条生成历史`);
      }
    } catch (e) {
      this.logger.warn(`加载生成历史失败: ${(e as Error).message}`);
      this.entries = [];
    }
  }

  private save(): void {
    try {
      this.context.globalState.update(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (e) {
      this.logger.warn(`保存生成历史失败: ${(e as Error).message}`);
    }
  }

  add(entry: Omit<HistoryEntry, 'date'>): void {
    const cfg = vscode.workspace.getConfiguration('aicommit');
    if (!cfg.get<boolean>('saveHistory', false)) {
      return;
    }

    const historyEntry: HistoryEntry = {
      ...entry,
      date: new Date().toISOString().split('T')[0],
    };

    this.entries.unshift(historyEntry);

    if (this.entries.length > MAX_HISTORY) {
      this.entries = this.entries.slice(0, MAX_HISTORY);
    }

    this.save();
    this.logger.debug(`已保存生成历史 (共 ${this.entries.length} 条)`);
  }

  getAll(): HistoryEntry[] {
    return [...this.entries];
  }

  getRecent(count: number): HistoryEntry[] {
    return this.entries.slice(0, count);
  }

  getByDate(date: string): HistoryEntry[] {
    return this.entries.filter(e => e.date === date);
  }

  search(query: string): HistoryEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(e =>
      e.message.toLowerCase().includes(q) ||
      e.model.toLowerCase().includes(q)
    );
  }

  clear(): void {
    this.entries = [];
    this.save();
    this.logger.info('已清空生成历史');
  }

  async pickAndApply(): Promise<string | undefined> {
    if (this.entries.length === 0) {
      vscode.window.showInformationMessage('AI Commit: 暂无生成历史');
      return undefined;
    }

    const items: vscode.QuickPickItem[] = this.entries.map((e, i) => {
      const time = new Date(e.timestamp).toLocaleString();
      const firstLine = e.message.split('\n')[0];
      return {
        label: `$(git-commit) ${firstLine}`,
        description: `${e.model} · ${time}`,
        detail: e.message,
        index: i,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择一条历史 commit message',
      title: 'AI Commit: 生成历史',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected && (selected as any).index !== undefined) {
      return this.entries[(selected as any).index].message;
    }

    return undefined;
  }
}
