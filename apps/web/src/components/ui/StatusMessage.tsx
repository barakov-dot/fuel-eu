import type { ReactNode } from 'react';
import styles from './StatusMessage.module.css';

type StatusMessageProps = {
  variant?: 'info' | 'error' | 'warning';
  children: ReactNode;
};

export function StatusMessage({
  variant = 'info',
  children,
}: StatusMessageProps) {
  return (
    <div className={`${styles.message} ${styles[variant]}`} role="status">
      {children}
    </div>
  );
}
