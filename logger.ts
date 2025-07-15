export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  crawlerType?: string;
}

class Logger {
  private level: LogLevel;
  private crawlerType?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.crawlerType = options.crawlerType;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const crawlerPrefix = this.crawlerType ? `[${this.crawlerType}] ` : ' ';
    return `${timestamp} [${level}]${crawlerPrefix}${message}`;
  }

  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message));
    }
  }

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message));
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message));
    }
  }

  error(message: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message));
    }
  }

  progress(message: string): void {
    process.stdout.write(`\r${this.formatMessage('INFO', message)}`);
  }

  progressEnd(): void {
    console.log('');
  }

  processStart(message: string): void {
    this.info(`Starting: ${message}`);
  }

  processEnd(message: string): void {
    this.info(message);
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

export const defaultLogger = createLogger();