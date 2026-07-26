import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function ThemeToggle({ className, style }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: '1.5px solid var(--bdr2)',
        background: 'var(--g100)',
        color: 'var(--t2)',
        cursor: 'pointer',
        transition: 'all .2s',
        flexShrink: 0,
        fontSize: 14,
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--g200)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--t1)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--g100)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--t2)';
      }}
    >
      <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`} />
    </button>
  );
}
