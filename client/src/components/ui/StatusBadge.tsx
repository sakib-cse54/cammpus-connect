import React from 'react';
import { Badge, type BadgeProps } from './Badge.js';
import { useT, type TKey } from '../../i18n/index.js';

type Color = NonNullable<BadgeProps['color']>;

/** Known statuses across events, registrations, certificates, memberships and users. */
export type KnownStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  | 'CONFIRMED' | 'WAITLISTED' | 'ATTENDED'
  | 'VALID' | 'REVOKED'
  | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

const COLORS: Record<KnownStatus, Color> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  PUBLISHED: 'success',
  COMPLETED: 'primary',
  CANCELLED: 'neutral',
  CONFIRMED: 'success',
  WAITLISTED: 'warning',
  ATTENDED: 'primary',
  VALID: 'success',
  REVOKED: 'danger',
  PENDING: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger'
};

function isKnown(s: string): s is KnownStatus {
  return Object.prototype.hasOwnProperty.call(COLORS, s);
}

export interface StatusBadgeProps {
  status: string | null | undefined;
  size?: BadgeProps['size'];
  className?: string;
}

/** Colored, translated status pill. Unknown statuses render neutral with the raw value. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', className }) => {
  const t = useT();
  const value = (status ?? '').toUpperCase();
  const known = isKnown(value);
  const label = known ? t(`common.status.${value}` as TKey) : value || t('common.status.UNKNOWN');
  return (
    <Badge color={known ? COLORS[value] : 'neutral'} size={size} dot className={className}>
      {label}
    </Badge>
  );
};
