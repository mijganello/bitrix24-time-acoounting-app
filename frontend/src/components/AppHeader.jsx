import HeaderUser from './HeaderUser'

const LOGO_GRADIENT =
  'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 30%, #ec4899 55%, #f97316 75%, #3b82f6 100%)'

function WorkerpunchLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, userSelect: 'none' }}>
      {/* Основное слово */}
      <span
        style={{
          fontFamily: "'Syne', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
          background: LOGO_GRADIENT,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'logo-gradient 10s linear infinite',
          lineHeight: 1,
        }}
      >
        WORKERPUNCH
      </span>

      {/* Второе слово */}
      <span
        style={{
          fontFamily: "'Syne', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '-0.01em',
          background: LOGO_GRADIENT,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'logo-gradient 10s linear infinite',
          lineHeight: 1,
        }}
      >
        v2
      </span>

      {/* Стадия (α) */}
      <span
        style={{
          fontSize: 12,
          color: 'rgba(139, 92, 246, 0.6)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          lineHeight: 1,
          letterSpacing: 0,
        }}
        title="alpha — ранняя версия"
      >
        (α-{__APP_VERSION__})
      </span>
    </div>
  )
}

export default function AppHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        background: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: 'none',
        borderRadius: 16,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)',
        flexShrink: 0,
        height: 56,
      }}
    >
      <WorkerpunchLogo />
      <HeaderUser />
    </div>
  )
}
