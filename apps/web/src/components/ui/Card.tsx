import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Card({ children, selected, onClick, className = '' }: CardProps) {
  const classNames = `${styles.card} ${selected ? styles.selected : ''} ${className}`.trim();

  if (onClick) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    };

    return (
      <div
        role="button"
        tabIndex={0}
        className={classNames}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  }

  return <article className={classNames}>{children}</article>;
}
