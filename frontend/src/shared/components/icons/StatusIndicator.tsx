import React from 'react';
import { IconSize } from './Icon';
import {
  CheckIcon,
  XIcon,
  AlertIcon,
  InfoIcon,
  ClockIcon,
} from './icons';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'active' | 'inactive';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: IconSize;
  className?: string;
  /** Show only the dot without icon */
  dotOnly?: boolean;
}

interface StatusConfig {
  dotColor: string;
  textColor: string;
  iconColor: string;
  defaultLabel: string;
  Icon: React.FC<{ size?: IconSize; className?: string; 'aria-hidden'?: boolean }>;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  success: {
    dotColor: 'bg-green-500',
    textColor: 'text-green-700',
    iconColor: 'text-green-500',
    defaultLabel: 'Success',
    Icon: CheckIcon,
  },
  warning: {
    dotColor: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    iconColor: 'text-yellow-500',
    defaultLabel: 'Warning',
    Icon: AlertIcon,
  },
  error: {
    dotColor: 'bg-red-500',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    defaultLabel: 'Error',
    Icon: XIcon,
  },
  info: {
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-500',
    defaultLabel: 'Info',
    Icon: InfoIcon,
  },
  pending: {
    dotColor: 'bg-orange-400',
    textColor: 'text-orange-700',
    iconColor: 'text-orange-400',
    defaultLabel: 'Pending',
    Icon: ClockIcon,
  },
  active: {
    dotColor: 'bg-green-400',
    textColor: 'text-green-700',
    iconColor: 'text-green-400',
    defaultLabel: 'Active',
    Icon: CheckIcon,
  },
  inactive: {
    dotColor: 'bg-gray-400',
    textColor: 'text-gray-500',
    iconColor: 'text-gray-400',
    defaultLabel: 'Inactive',
    Icon: XIcon,
  },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'sm',
  className = '',
  dotOnly = false,
}) => {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.defaultLabel;
  const { Icon: StatusIcon } = config;

  if (dotOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${className}`}
        aria-label={displayLabel}
      >
        <span
          className={`inline-block rounded-full ${config.dotColor}`}
          style={{ width: 8, height: 8 }}
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.textColor} ${className}`}
      role="status"
      aria-label={displayLabel}
    >
      <span
        className={`inline-block rounded-full flex-shrink-0 ${config.dotColor}`}
        style={{ width: 8, height: 8 }}
        aria-hidden
      />
      <StatusIcon
        size={size}
        className={config.iconColor}
        aria-hidden
      />
      <span className="text-sm font-medium">{displayLabel}</span>
    </span>
  );
};
