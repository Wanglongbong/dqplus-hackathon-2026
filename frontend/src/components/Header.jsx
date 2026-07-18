const NAV = [
  ['matches', 'Discover'],
  ['connections', 'Connections'],
  ['opportunities', 'Opportunities'],
  ['form', 'Profile'],
];

export default function Header({ session, status, verification, view, notificationCount = 0, onNavigate, onLogout }) {
  const active = view === 'detail' ? 'matches' : view;
  const nav = session.user.isAdmin ? [...NAV, ['admin', 'Admin']] : NAV;
  return (
    <header className="vn-header">
      <button type="button" className="vn-header-brand vn-brand-button" onClick={() => onNavigate('matches')}>
        <img className="vn-header-logo" src="/logo.png" alt="" />
        <b className="vn-header-name">VietNexus</b>
      </button>
      <nav className="vn-header-nav" aria-label="Primary navigation">
        {nav.map(([id, label]) => (
          <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => onNavigate(id)}>
            {label}{id === 'connections' && notificationCount > 0 ? ` (${notificationCount})` : ''}
          </button>
        ))}
      </nav>
      <div className="vn-header-right">
        <span className={'vn-header-status ' + (verification === 'verified' ? 'ready' : 'draft')}>
          {verification === 'verified' ? '✓ Verified' : 'Verification pending'}
        </span>
        <span className={'vn-header-status ' + (status === 'ready' ? 'ready' : 'draft')}>
          {status === 'ready' ? '● Ready' : '○ Draft'}
        </span>
        <button type="button" className="btn btn-ghost vn-header-logout" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}
