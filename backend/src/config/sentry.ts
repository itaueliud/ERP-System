import * as Sentry from '@sentry/node';
import { Express, Request, Response, NextFunction } from 'express';
import config from './index';

export function initializeSentry(_app: Express) {
  // Only initialize Sentry if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not provided, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.env,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    // Capture 100% of errors
    sampleRate: 1.0,
    // Attach stack traces to errors
    attachStacktrace: true,
    // Capture breadcrumbs
    maxBreadcrumbs: 50,
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query parameters
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        const sensitiveParams = ['password', 'token', 'secret', 'api_key'];
        let queryString = event.request.query_string;
        sensitiveParams.forEach(param => {
          if (queryString.includes(param)) {
            queryString = queryString.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=[REDACTED]`
            );
          }
        });
        event.request.query_string = queryString;
      }
      
      return event;
    },
  });

  console.log('Sentry initialized successfully');
}

export function getSentryErrorHandler() {
  // Return a simple error handler that logs to Sentry
  return (err: Error, _req: Request, _res: Response, next: NextFunction) => {
    Sentry.captureException(err);
    next(err);
  };
}

export { Sentry };
