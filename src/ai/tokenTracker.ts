import * as vscode from 'vscode';
import { Logger } from '../utils';

export interface TokenUsageRecord {
  date: string;
  model: string;
  modelGroup: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  cost: number;
  costBreakdown: {
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
  };
  timestamp: number;
}

export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  count: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export interface BudgetCheckResult {
  level: 'none' | 'warning' | 'exceeded';
  period: 'daily' | 'monthly';
  budget: number;
  current: number;
  percentage: number;
}

interface ModelPricing {
  input: number;
  output: number;
  cacheRead?: number;
}

const BUILTIN_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { input: 0.0025, output: 0.01, cacheRead: 0.00125 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, cacheRead: 0.000075 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01, cacheRead: 0.00125 },
  'gpt-4o-2024-05-13': { input: 0.005, output: 0.015, cacheRead: 0.0025 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
  'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  'o1': { input: 0.015, output: 0.06, cacheRead: 0.0075 },
  'o1-preview': { input: 0.015, output: 0.06, cacheRead: 0.0075 },
  'o1-mini': { input: 0.003, output: 0.012, cacheRead: 0.0015 },
  'o1-pro': { input: 0.15, output: 0.6, cacheRead: 0.075 },
  'o3-mini': { input: 0.0011, output: 0.0044, cacheRead: 0.00055 },
  'o4-mini': { input: 0.0011, output: 0.0044, cacheRead: 0.00055 },

  'deepseek-chat': { input: 0.00014, output: 0.00028, cacheRead: 0.000014 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219, cacheRead: 0.00014 },

  'claude-3.5-sonnet': { input: 0.003, output: 0.015, cacheRead: 0.003 },
  'claude-3.5-sonnet-20241022': { input: 0.003, output: 0.015, cacheRead: 0.003 },
  'claude-3.5-haiku': { input: 0.001, output: 0.005, cacheRead: 0.001 },
  'claude-3-opus': { input: 0.015, output: 0.075, cacheRead: 0.015 },
  'claude-3-sonnet': { input: 0.003, output: 0.015, cacheRead: 0.003 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125, cacheRead: 0.00025 },

  'qwen-plus': { input: 0.0004, output: 0.0012, cacheRead: 0.0002 },
  'qwen-turbo': { input: 0.00005, output: 0.0002, cacheRead: 0.000025 },
  'qwen-max': { input: 0.002, output: 0.006, cacheRead: 0.001 },
  'qwen-long': { input: 0.00005, output: 0.0002, cacheRead: 0.000025 },
  'qwen-coder-plus': { input: 0.00035, output: 0.00105, cacheRead: 0.000175 },
  'qwq-32b': { input: 0.00012, output: 0.00018, cacheRead: 0.00006 },
  'qvq-72b': { input: 0.0004, output: 0.0012, cacheRead: 0.0002 },

  'moonshot-v1-8k': { input: 0.012, output: 0.012 },
  'moonshot-v1-32k': { input: 0.024, output: 0.024 },
  'moonshot-v1-128k': { input: 0.06, output: 0.06 },

  'glm-4': { input: 0.001, output: 0.001 },
  'glm-4-flash': { input: 0.00001, output: 0.00001 },
  'glm-4-plus': { input: 0.005, output: 0.005 },
  'glm-4-long': { input: 0.0001, output: 0.0001 },
  'glm-4v': { input: 0.005, output: 0.005 },
  'glm-z1-air': { input: 0.0001, output: 0.0001 },
  'glm-z1-airx': { input: 0.0003, output: 0.0003 },
  'glm-z1-flash': { input: 0.00001, output: 0.00001 },

  'gemini-2.5-pro': { input: 0.00125, output: 0.005, cacheRead: 0.0003125 },
  'gemini-2.5-flash': { input: 0.00015, output: 0.0006, cacheRead: 0.0000375 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004, cacheRead: 0.000025 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005, cacheRead: 0.0003125 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003, cacheRead: 0.00001875 },

  'mistral-large': { input: 0.002, output: 0.006 },
  'mistral-medium': { input: 0.0027, output: 0.0081 },
  'mistral-small': { input: 0.0002, output: 0.0006 },
  'codestral': { input: 0.0003, output: 0.0009 },

  'llama3.1-405b': { input: 0.003, output: 0.009 },
  'llama3.1-70b': { input: 0.0006, output: 0.0019 },
  'llama3.1-8b': { input: 0.00005, output: 0.0001 },
  'deepseek-v3': { input: 0.00014, output: 0.00028, cacheRead: 0.000014 },
};

const STORAGE_KEY = 'aicommit.tokenUsage';
const BUDGET_ALERT_KEY = 'aicommit.budgetAlerted';
const MAX_DAYS = 90;

export class TokenTracker {
  private records: TokenUsageRecord[] = [];
  private lastUsage: TokenUsageRecord | null = null;

  constructor(
    private logger: Logger,
    private context: vscode.ExtensionContext,
  ) {
    this.load();
    this.cleanup();
  }

  private load(): void {
    try {
      const data = this.context.globalState.get<string>(STORAGE_KEY, '');
      if (data) {
        this.records = JSON.parse(data);
        this.logger.debug(`已加载 ${this.records.length} 条 Token 用量记录`);
      }
    } catch (e) {
      this.logger.warn(`加载 Token 用量记录失败: ${(e as Error).message}`);
      this.records = [];
    }
  }

  private save(): void {
    try {
      this.context.globalState.update(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      this.logger.warn(`保存 Token 用量记录失败: ${(e as Error).message}`);
    }
  }

  private cleanup(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const before = this.records.length;
    this.records = this.records.filter(r => r.date >= cutoffStr);
    if (this.records.length < before) {
      this.logger.debug(`清理了 ${before - this.records.length} 条过期 Token 用量记录`);
      this.save();
    }
  }

  record(
    model: string,
    promptTokens: number,
    completionTokens: number,
    cachedTokens: number = 0,
    modelGroup: string = '',
  ): TokenUsageRecord {
    const pricing = this.getPricing(model);
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    const cacheReadCost = cachedTokens > 0 && pricing.cacheRead
      ? (cachedTokens / 1000) * pricing.cacheRead
      : 0;
    const cost = inputCost + outputCost + cacheReadCost;
    const now = new Date();
    const record: TokenUsageRecord = {
      date: now.toISOString().split('T')[0],
      model,
      modelGroup,
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: promptTokens + completionTokens,
      cost,
      costBreakdown: {
        inputCost,
        outputCost,
        cacheReadCost,
      },
      timestamp: now.getTime(),
    };

    this.records.push(record);
    this.lastUsage = record;
    this.save();

    this.logger.info(`Token 用量: ${promptTokens}+${completionTokens}(cached:${cachedTokens})=${record.totalTokens}, 费用: $${cost.toFixed(6)}`);
    return record;
  }

  getLastUsage(): TokenUsageRecord | null {
    return this.lastUsage;
  }

  getSummaryByDate(date: string): UsageSummary {
    let totalTokens = 0;
    let totalCost = 0;
    let count = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;
    for (const r of this.records) {
      if (r.date === date) {
        totalTokens += r.totalTokens;
        totalCost += r.cost;
        promptTokens += r.promptTokens;
        completionTokens += r.completionTokens;
        cachedTokens += r.cachedTokens;
        count++;
      }
    }
    return { totalTokens, totalCost, count, promptTokens, completionTokens, cachedTokens };
  }

  getTodaySummary(): UsageSummary {
    const today = new Date().toISOString().split('T')[0];
    return this.getSummaryByDate(today);
  }

  getWeekSummary(): UsageSummary {
    const dates = this.getWeekDates();
    return this.aggregateDates(dates);
  }

  getMonthSummary(): UsageSummary {
    const dates = this.getMonthDates();
    return this.aggregateDates(dates);
  }

  private getWeekDates(): string[] {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (d <= now) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    return dates;
  }

  private getMonthDates(): string[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const dates: string[] = [];
    const d = new Date(firstDay);
    while (d <= now) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  private aggregateDates(dates: string[]): UsageSummary {
    const dateSet = new Set(dates);
    let totalTokens = 0;
    let totalCost = 0;
    let count = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;
    for (const r of this.records) {
      if (dateSet.has(r.date)) {
        totalTokens += r.totalTokens;
        totalCost += r.cost;
        promptTokens += r.promptTokens;
        completionTokens += r.completionTokens;
        cachedTokens += r.cachedTokens;
        count++;
      }
    }
    return { totalTokens, totalCost, count, promptTokens, completionTokens, cachedTokens };
  }

  getDailyStats(days: number): { date: string; tokens: number; cost: number; count: number }[] {
    const result: { date: string; tokens: number; cost: number; count: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const summary = this.getSummaryByDate(dateStr);
      result.push({ date: dateStr, tokens: summary.totalTokens, cost: summary.totalCost, count: summary.count });
    }
    return result;
  }

  checkBudget(): BudgetCheckResult[] {
    const cfg = vscode.workspace.getConfiguration('aicommit');
    const dailyBudget = cfg.get<number>('dailyBudget', 0);
    const monthlyBudget = cfg.get<number>('monthlyBudget', 0);
    const results: BudgetCheckResult[] = [];

    if (dailyBudget > 0) {
      const today = this.getTodaySummary();
      const percentage = today.totalCost / dailyBudget;
      if (percentage >= 1) {
        results.push({ level: 'exceeded', period: 'daily', budget: dailyBudget, current: today.totalCost, percentage });
      } else if (percentage >= 0.8) {
        results.push({ level: 'warning', period: 'daily', budget: dailyBudget, current: today.totalCost, percentage });
      }
    }

    if (monthlyBudget > 0) {
      const month = this.getMonthSummary();
      const percentage = month.totalCost / monthlyBudget;
      if (percentage >= 1) {
        results.push({ level: 'exceeded', period: 'monthly', budget: monthlyBudget, current: month.totalCost, percentage });
      } else if (percentage >= 0.8) {
        results.push({ level: 'warning', period: 'monthly', budget: monthlyBudget, current: month.totalCost, percentage });
      }
    }

    return results;
  }

  async handleBudgetAlert(): Promise<boolean> {
    const results = this.checkBudget();
    const cfg = vscode.workspace.getConfiguration('aicommit');
    const currency = cfg.get<string>('currency', 'USD');
    const rate = cfg.get<number>('exchangeRate', 7.2);

    for (const result of results) {
      const alertKey = `${BUDGET_ALERT_KEY}.${result.period}.${result.level}`;
      const today = new Date().toISOString().split('T')[0];
      const lastAlert = this.context.globalState.get<string>(alertKey, '');
      if (lastAlert === today) {
        if (result.level === 'exceeded') {
          return false;
        }
        continue;
      }

      const periodLabel = result.period === 'daily' ? '日' : '月';
      const budgetStr = this.formatCost(result.budget, currency, rate);
      const currentStr = this.formatCost(result.current, currency, rate);
      const pctStr = Math.round(result.percentage * 100);

      if (result.level === 'warning') {
        vscode.window.showWarningMessage(
          `AI Commit: ${periodLabel}预算已使用 ${pctStr}%（${currentStr} / ${budgetStr}）`,
        );
        this.context.globalState.update(alertKey, today);
      } else if (result.level === 'exceeded') {
        const choice = await vscode.window.showErrorMessage(
          `AI Commit: ${periodLabel}预算已超支！(${currentStr} / ${budgetStr}, ${pctStr}%)`,
          '继续使用',
          '停止',
        );
        this.context.globalState.update(alertKey, today);
        if (choice !== '继续使用') {
          return false;
        }
      }
    }

    return true;
  }

  formatCost(costUsd: number, currency?: string, rate?: number): string {
    const cfg = vscode.workspace.getConfiguration('aicommit');
    const cur = currency || cfg.get<string>('currency', 'USD');
    const r = rate || cfg.get<number>('exchangeRate', 7.2);
    if (cur === 'CNY') {
      return `¥${(costUsd * r).toFixed(4)}`;
    }
    return `$${costUsd.toFixed(4)}`;
  }

  getTooltipText(): string {
    const cfg = vscode.workspace.getConfiguration('aicommit');
    const currency = cfg.get<string>('currency', 'USD');
    const rate = cfg.get<number>('exchangeRate', 7.2);
    const costStr = (cost: number) => this.formatCost(cost, currency, rate);

    const lines: string[] = ['AI Commit - 上次生成统计', '─────────────────────'];

    const activeGroup = cfg.get<string>('activeModelGroup', '');
    if (activeGroup) {
      lines.push(`配置组: ${activeGroup}`);
    }

    if (this.lastUsage) {
      lines.push(`模型: ${this.lastUsage.model}`);
      lines.push(`Prompt Tokens: ${this.lastUsage.promptTokens.toLocaleString()}`);
      lines.push(`Completion Tokens: ${this.lastUsage.completionTokens.toLocaleString()}`);
      if (this.lastUsage.cachedTokens > 0) {
        lines.push(`Cached Tokens: ${this.lastUsage.cachedTokens.toLocaleString()}`);
      }
      lines.push(`总 Tokens: ${this.lastUsage.totalTokens.toLocaleString()}`);
      const bd = this.lastUsage.costBreakdown;
      lines.push(`预估费用: ${costStr(this.lastUsage.cost)}`);
      lines.push(`  输入: ${costStr(bd.inputCost)} | 输出: ${costStr(bd.outputCost)}`);
      if (bd.cacheReadCost > 0) {
        lines.push(`  缓存读取: ${costStr(bd.cacheReadCost)}`);
      }
    } else {
      lines.push('暂无生成记录');
    }

    lines.push('─────────────────────');
    const today = this.getTodaySummary();
    lines.push(`今日: ${today.totalTokens.toLocaleString()} tokens / ${costStr(today.totalCost)} (${today.count} 次)`);

    const week = this.getWeekSummary();
    lines.push(`本周: ${week.totalTokens.toLocaleString()} tokens / ${costStr(week.totalCost)} (${week.count} 次)`);

    const month = this.getMonthSummary();
    lines.push(`本月: ${month.totalTokens.toLocaleString()} tokens / ${costStr(month.totalCost)} (${month.count} 次)`);

    const dailyBudget = cfg.get<number>('dailyBudget', 0);
    const monthlyBudget = cfg.get<number>('monthlyBudget', 0);
    if (dailyBudget > 0 || monthlyBudget > 0) {
      lines.push('─────────────────────');
      if (dailyBudget > 0) {
        const pct = Math.round((today.totalCost / dailyBudget) * 100);
        lines.push(`日预算: ${costStr(today.totalCost)} / ${costStr(dailyBudget)} (${pct}%)`);
      }
      if (monthlyBudget > 0) {
        const pct = Math.round((month.totalCost / monthlyBudget) * 100);
        lines.push(`月预算: ${costStr(month.totalCost)} / ${costStr(monthlyBudget)} (${pct}%)`);
      }
    }

    return lines.join('\n');
  }

  private getPricing(model: string): ModelPricing {
    const customPricing = this.getCustomPricing(model);
    if (customPricing) {
      return customPricing;
    }

    const modelLower = model.toLowerCase();
    for (const [key, pricing] of Object.entries(BUILTIN_PRICING)) {
      if (modelLower.includes(key.toLowerCase())) {
        return pricing;
      }
    }

    return { input: 0.001, output: 0.002 };
  }

  private getCustomPricing(model: string): ModelPricing | null {
    try {
      const cfg = vscode.workspace.getConfiguration('aicommit');
      const customPricing = cfg.get<Record<string, ModelPricing>>('customModelPricing', {});
      if (customPricing && customPricing[model]) {
        return customPricing[model];
      }
    } catch {
    }
    return null;
  }

  getAllRecords(): TokenUsageRecord[] {
    return [...this.records];
  }

  getRecordsByDateRange(startDate: string, endDate: string): TokenUsageRecord[] {
    return this.records.filter(r => r.date >= startDate && r.date <= endDate);
  }
}
