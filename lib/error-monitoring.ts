/**
 * Error Monitoring and Logging
 * Centralized error tracking
 */

export interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  url?: string;
  userAgent?: string;
}

class ErrorMonitor {
  private logs: ErrorLog[] = [];
  private maxLogs: number = 100;
  private listeners: ((error: ErrorLog) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Global error handler
      window.addEventListener('error', (event) => {
        this.logError(event.error || new Error(event.message), {
          type: 'uncaught',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }, 'high');
      });

      // Unhandled promise rejection
      window.addEventListener('unhandledrejection', (event) => {
        this.logError(
          event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
          { type: 'unhandled_promise' },
          'high'
        );
      });
    }
  }

  /**
   * Log an error
   */
  logError(
    error: Error | string,
    context?: Record<string, any>,
    severity: ErrorLog['severity'] = 'medium'
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      severity,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    };

    this.logs.push(errorLog);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(errorLog));

    // Console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorMonitor]', errorLog);
    }

    // Send to analytics/monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(errorLog);
    }
  }

  /**
   * Send error to monitoring service
   */
  private async sendToMonitoring(errorLog: ErrorLog): Promise<void> {
    try {
      // TODO: Integrate with Sentry, LogRocket, or other service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorLog)
      // });
    } catch (err) {
      console.error('Failed to send error to monitoring:', err);
    }
  }

  /**
   * Subscribe to errors
   */
  onError(callback: (error: ErrorLog) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get logs by severity
   */
  getLogsBySeverity(severity: ErrorLog['severity']): ErrorLog[] {
    return this.logs.filter(log => log.severity === severity);
  }

  /**
   * Export logs
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const errorMonitor = new ErrorMonitor();

/**
 * Track custom errors
 */
export function trackError(
  error: Error | string,
  context?: Record<string, any>,
  severity?: ErrorLog['severity']
): void {
  errorMonitor.logError(error, context, severity);
}

/**
 * Track API errors
 */
export function trackAPIError(
  endpoint: string,
  error: Error | string,
  statusCode?: number
): void {
  errorMonitor.logError(error, {
    type: 'api_error',
    endpoint,
    statusCode
  }, statusCode && statusCode >= 500 ? 'high' : 'medium');
}

/**
 * Track database errors
 */
export function trackDBError(
  operation: string,
  error: Error | string,
  table?: string
): void {
  errorMonitor.logError(error, {
    type: 'database_error',
    operation,
    table
  }, 'high');
}

/**
 * Performance monitoring
 */
export function trackPerformance(
  metric: string,
  value: number,
  context?: Record<string, any>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metric}:`, value, context);
  }
}
