import React from 'react';
import { IconAlert, IconBolt, IconClose } from './Icons';

export interface ApiErrorInfo {
  type: 'unreachable' | 'server_error' | 'validation';
  message: string;
  statusCode?: number;
  url?: string;
}

interface ApiErrorBannerProps {
  error: ApiErrorInfo;
  onSwitchToFixture: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ApiErrorBanner: React.FC<ApiErrorBannerProps> = ({
  error,
  onSwitchToFixture,
  onDismiss,
  onRetry,
}) => {
  const isUnreachable = error.type === 'unreachable';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="api-error-banner"
    >
      <div className="api-error-icon-box">
        <IconAlert size={18} color="#ff6b6b" />
      </div>

      <div className="api-error-body">
        <div className="api-error-top-row num">
          <span className="api-error-badge">
            {isUnreachable ? '(Status) Backend Unreachable' : `(API Error) ${error.statusCode || 'Notice'}`}
          </span>
          <span className="api-error-status-tag">
            {isUnreachable ? 'PORT 8000 OFFLINE' : 'SERVER RESPONSE'}
          </span>
        </div>

        <p className="api-error-message">
          {error.message}
        </p>

        {isUnreachable && (
          <p className="api-error-subtext num">
            The NLP service at <code>http://localhost:8000</code> is currently not accepting connections. You can start the Python backend via <code>uvicorn src.api.server:app --port 8000</code> or continue exploring instantly using a recorded real response.
          </p>
        )}

        <div className="api-error-actions">
          <button
            type="button"
            onClick={onSwitchToFixture}
            className="api-error-switch-btn num cursor-pointer"
          >
            <IconBolt size={14} color="#0c0c0c" />
            <span>Switch to Fixture Mode</span>
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="api-error-retry-btn num cursor-pointer"
            >
              Retry Request
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="api-error-dismiss-btn num cursor-pointer"
            aria-label="Dismiss error notification"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Dismiss <IconClose size={12} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
