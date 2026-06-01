import '../styles/keyboard.css';

interface Props {
  onClose: () => void;
}

const STEPS: {
  platform: string;
  icon: string;
  color: string;
  steps: { label: string; detail: string }[];
}[] = [
  {
    platform: 'iOS (iPhone / iPad)',
    icon: '',
    color: '#0a84ff',
    steps: [
      { label: 'ካብ App Store ምርካብ',       detail: 'Search "Fidel Tigrinya Keyboard" in the App Store and install.' },
      { label: 'Settings ምኻድ',             detail: 'Open ⚙️ Settings → General → Keyboard → Keyboards.' },
      { label: 'Add New Keyboard',          detail: 'Tap "Add New Keyboard…" and choose Fidel from the list.' },
      { label: 'Full Access ምፍቃድ',         detail: 'Tap Fidel → Enable "Allow Full Access" to unlock AI suggestions.' },
      { label: 'ምጥቃም',                     detail: 'Open any app, tap a text box, then hold the 🌐 globe key and choose Fidel.' },
    ],
  },
  {
    platform: 'Android',
    icon: '',
    color: '#30d158',
    steps: [
      { label: 'ካብ Google Play ምርካብ',      detail: 'Search "Fidel Tigrinya Keyboard" in the Play Store and install.' },
      { label: 'Settings ምኻድ',             detail: 'Open ⚙️ Settings → System → Language & Input → Virtual Keyboard.' },
      { label: 'Manage Keyboards',          detail: 'Tap "Manage Keyboards" and toggle Fidel Keyboard ON.' },
      { label: 'Default ምግባር',             detail: 'Tap "Default Keyboard" and select Fidel (or switch per-app).' },
      { label: 'ምጥቃም',                     detail: 'In any text field, tap the keyboard icon in the navigation bar and choose Fidel.' },
    ],
  },
  {
    platform: 'Web (PWA — ሕጂ ይጥቀሙ)',
    icon: '🌐',
    color: '#ffd60a',
    steps: [
      { label: 'ኣብ Chrome/Safari ምርካብ',   detail: 'Open this page in Chrome (Android) or Safari (iOS).' },
      { label: '"Add to Home Screen"',       detail: 'Android: tap ⋮ menu → "Add to Home Screen". iOS: tap the Share ⬆ button → "Add to Home Screen".' },
      { label: 'ካብ Home Screen ምኽፋት',      detail: 'Tap the Fidel icon on your home screen — it opens full-screen like a native app.' },
      { label: 'AI ምጥቃም',                   detail: 'All features (voice, clipboard, Ge\'ez numbers, compound fixer) work immediately — no install needed.' },
    ],
  },
];

export function InstallGuide({ onClose }: Props) {
  return (
    <div className="install-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="install-panel">
        <div className="install-header">
          <div>
            <p className="install-title-geez">ኣብ ስልኽኻ ናይ ምትካል መምርሒ</p>
            <p className="install-title-en">How to Install Fidel Keyboard on Your Phone</p>
          </div>
          <button className="install-close" onPointerDown={onClose}>✕</button>
        </div>

        <div className="install-body">
          {STEPS.map((section) => (
            <section key={section.platform} className="install-section">
              <h3 className="install-section-title" style={{ color: section.color }}>
                {section.icon && <span>{section.icon} </span>}{section.platform}
              </h3>
              <ol className="install-steps">
                {section.steps.map((step, i) => (
                  <li key={i} className="install-step">
                    <span className="install-step-num" style={{ background: section.color }}>{i + 1}</span>
                    <div>
                      <p className="install-step-label">{step.label}</p>
                      <p className="install-step-detail">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <div className="install-note">
            <span className="install-note-icon">🔒</span>
            <p>
              <strong>ናይ ምስጢር ትውሕስቲ —</strong> ፊደል ኩሉ ጽሑፍካ ኣብ ደቂቕካ ጥራይ ይሰርሕ።
              ዝሓሸ ትምህርቲ ኣይሰዶን፣ ዝሓሸ ጽሑፍካ ኣይወጽእን። AI ምሉእ ብምሉእ ኦፍላይን ኢዩ።
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
