/**
 * Database Query Logger
 * Provides enhanced logging and error handling for Supabase queries
 */

export interface QueryLogOptions {
  operation: string;
  table: string;
  userId?: string;
  context?: Record<string, any>;
}

export class QueryLogger {
  private static instance: QueryLogger;
  private logs: Array<{
    timestamp: string;
    operation: string;
    table: string;
    duration: number;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  private constructor() {}

  static getInstance(): QueryLogger {
    if (!QueryLogger.instance) {
      QueryLogger.instance = new QueryLogger();
    }
    return QueryLogger.instance;
  }

  async logQuery<T>(
    options: QueryLogOptions,
    queryFn: () => Promise<{ data: T; error: any }>
  ): Promise<{ data: T; error: any }> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`[Query] ${options.operation} on ${options.table}`, {
      timestamp,
      userId: options.userId,
      context: options.context,
    });

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      if (result.error) {
        console.error(`[Query] ${options.operation} on ${options.table} FAILED`, {
          duration: `${duration}ms`,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details,
          hint: result.error.hint,
        });

        this.logs.push({
          timestamp,
          operation: options.operation,
          table: options.table,
          duration,
          status: 'error',
          error: result.error.message,
        });
      } else {
        console.log(`[Query] ${options.operation} on ${options.table} SUCCESS`, {
          duration: `${duration}ms`,
          dataLength: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
        });

        this.logs.push({
          timestamp,
          operation: options.operation,
          table: options.table,
          duration,
          status: 'success',
        });
      }

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[Query] ${options.operation} on ${options.table} EXCEPTION`, {
        duration: `${duration}ms`,
        error: err.message,
        stack: err.stack,
      });

      this.logs.push({
        timestamp,
        operation: options.operation,
        table: options.table,
        duration,
        status: 'error',
        error: err.message,
      });

      throw err;
    }
  }

  getRecentLogs(count: number = 50) {
    return this.logs.slice(-count);
  }

  getErrorLogs() {
    return this.logs.filter(log => log.status === 'error');
  }

  clearLogs() {
    this.logs = [];
  }

  getStats() {
    const total = this.logs.length;
    const errors = this.logs.filter(log => log.status === 'error').length;
    const success = total - errors;
    const avgDuration = this.logs.reduce((acc, log) => acc + log.duration, 0) / total;

    return {
      total,
      success,
      errors,
      avgDuration: Math.round(avgDuration),
      errorRate: total > 0 ? ((errors / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

// Export singleton instance
export const queryLogger = QueryLogger.getInstance();

// Helper function for enhanced error messages
export function formatSupabaseError(error: any): string {
  if (!error) return 'Unknown error';

  const parts = [error.message || 'Database error'];

  if (error.code) {
    parts.push(`(Code: ${error.code})`);
  }

  if (error.details) {
    parts.push(`Details: ${error.details}`);
  }

  if (error.hint) {
    parts.push(`Hint: ${error.hint}`);
  }

  return parts.join(' ');
}
