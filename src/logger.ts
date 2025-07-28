import { config } from "./config";

export interface LoggerOptions {
  context?: string;
}

class Logger {
  private crawlerType?: string;
  private minLevel: number;

  constructor(options: LoggerOptions = {}) {
    this.crawlerType = options.context;
    const levels = ["debug", "info", "warn", "error"];
    this.minLevel = levels.indexOf(config.LOG_LEVEL);
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const crawlerPrefix = this.crawlerType ? `[${this.crawlerType}] ` : " ";
    return `${timestamp} [${level}]${crawlerPrefix}${message}`;
  }

  debug(message: string): void {
    if (this.minLevel <= 0) {
      console.log(this.formatMessage("DEBUG", message));
    }
  }

  info(message: string): void {
    if (this.minLevel <= 1) {
      console.log(this.formatMessage("INFO", message));
    }
  }

  warn(message: string): void {
    if (this.minLevel <= 2) {
      console.log(this.formatMessage("WARN", message));
    }
  }

  error(message: string): void {
    if (this.minLevel <= 3) {
      console.log(this.formatMessage("ERROR", message));
    }
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

export const defaultLogger = createLogger();
