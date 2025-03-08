export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  extra?: Record<string, unknown>;
}

export interface LoggerOptions {
  component: string;
  correlationId?: string;
} 