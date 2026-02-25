export function AzerSyncMark(): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="azersync-mark-gradient" x1="8" y1="10" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#74e8c8" />
          <stop offset="1" stopColor="#6f9eff" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#azersync-mark-gradient)" />
      <path
        d="M20 40L30 20L44 44M24 32H38"
        fill="none"
        stroke="#0a182a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M47 18C51 23 53 30 53 37"
        fill="none"
        stroke="#0a182a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M15 46C11 41 9 34 9 27"
        fill="none"
        stroke="#0a182a"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface TitleBarProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ isMaximized, onMinimize, onToggleMaximize, onClose }: TitleBarProps): JSX.Element {
  return (
    <header className="window-chrome">
      <div className="window-chrome__title">
        <span className="window-brand-mark">
          <AzerSyncMark />
        </span>
        AzerSync
      </div>
      <div className="window-chrome__controls" role="toolbar" aria-label="Window controls">
        <button type="button" className="window-btn" onClick={onMinimize} aria-label="Minimize window">
          -
        </button>
        <button
          type="button"
          className="window-btn"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? '[]' : '[ ]'}
        </button>
        <button type="button" className="window-btn window-btn--close" onClick={onClose} aria-label="Close window">
          x
        </button>
      </div>
    </header>
  );
}
