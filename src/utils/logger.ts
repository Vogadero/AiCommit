export enum LogLevel {
  Error = 0,
  Warn = 1,
  Info = 2,
  Debug = 3,
}

export class Logger {
  private outputChannel: import('vscode').OutputChannel;
  private level: LogLevel = LogLevel.Info;
  private logBuffer: string[] = [];
  private readonly MAX_BUFFER = 5000;

  constructor(outputChannel: import('vscode').OutputChannel) {
    this.outputChannel = outputChannel;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level > this.level) {
      return;
    }
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const formatted = `[${timestamp}] [${levelName}] ${message}`;
    const extra = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    const fullLine = formatted + extra;
    this.outputChannel.appendLine(fullLine);
    this.logBuffer.push(fullLine);
    if (this.logBuffer.length > this.MAX_BUFFER) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER);
    }
    if (level === LogLevel.Error) {
      console.error(formatted, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.Error, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.Warn, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.Info, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.Debug, message, ...args);
  }

  show(): void {
    this.outputChannel.show();
  }

  getLogContent(): string {
    return this.logBuffer.join('\n');
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
