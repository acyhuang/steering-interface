import { LogLevel, LogEntry, LoggerOptions } from './types';

const getCurrentLogLevel = (): LogLevel => {
  const env = import.meta.env.VITE_APP_ENV || 'development';
  switch (env) {
    case 'production':
      return LogLevel.INFO;
    case 'staging':
      return LogLevel.DEBUG;
    default:
      return LogLevel.TRACE;
  }
};

const formatTimestamp = (): string => {
  return new Date().toISOString();
};

export class Logger {
  private component: string;
  private correlationId?: string;
  private currentLogLevel: LogLevel;

  constructor(options: LoggerOptions) {
    this.component = options.component;
    this.correlationId = options.correlationId;
    this.currentLogLevel = getCurrentLogLevel();
  }

  get getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (level > this.currentLogLevel) return;

    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: level,
      component: this.component,
      message,
      correlationId: this.correlationId,
      extra
    };

    const levelName = LogLevel[level];
    console.log(`[${entry.timestamp}] [${levelName}] [${entry.component}] ${message}`, 
      entry.extra ? entry.extra : '',
      entry.correlationId ? `(correlation_id: ${entry.correlationId})` : ''
    );
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, extra);
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, extra);
  }

  trace(message: string, extra?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, extra);
  }

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }
} 