/**
 * Production-ready logging utility for Amber Backup
 *
 * - Debug logs only shown in development
 * - All logs include timestamp and context
 * - Structured logging for better debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

/**
 * Format log message with timestamp and optional context
 */
function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Logger with support for development-only debug messages
 */
export const logger = {
  /**
   * Debug level - only shown in development
   */
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(formatMessage('debug', message, context));
    }
  },

  /**
   * Info level - general information (shown in production)
   */
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(formatMessage('info', message, context));
  },

  /**
   * Warning level - potential issues
   */
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error level - errors and failures
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      : context;

    console.error(formatMessage('error', message, errorContext));
  },
};

export default logger;
