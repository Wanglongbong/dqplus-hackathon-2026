import { useEffect, useMemo, useState } from 'react';
import { createCoffeeSession, getPublicConstellation, getPublicDeals, getPublicPulse } from '../lib/api.js';
import { constellationEdges, demoDeals, demoPulse, venueSuggestions } from '../data/publicExperience.js';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function pathToPage(pathname) {
  if (pathname.startsWith('/deals')) return 'deals';
  if (pathname.startsWith('/coffee-chat')) return 'coffee';
  if (pathname.startsWith('/pricing')) return 'pricing';
  return 'home';
}

function defaultSlots() {
  const base = new Date();
  base.setDate(base.getDate() + 5);
  base.setHours(9, 30, 0, 0);
  return [0, 2, 4].map((offset) => {
    const value = new Date(base);
    value.setDate(value.getDate() + offset);
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
}

const copy = {
  vi: {
    nav: ['Cơ hội', 'Cách hoạt động', 'Mức phí'],
    signIn: 'Đăng nhập', dashboard: 'Vào workspace', eyebrow: 'CURATED DEAL FLOW · HÀ NỘI',
    hero: 'Đừng chỉ tin vào hồ sơ. Hãy gặp người đang xây nó.',
    sub: 'AI lọc tín hiệu, investor chọn 5 dự án và VietNexus đưa mọi người về cùng một bàn cà phê — để kiểm chứng bằng câu hỏi thật, sản phẩm thật và con người thật.',
    explore: 'Xem 12 cơ hội ẩn danh', process: 'Xem cách hoạt động', live: 'COMMUNITY PULSE',
  },
  en: {
    nav: ['Deals', 'How it works', 'Pricing'],
    signIn: 'Sign in', dashboard: 'Open workspace', eyebrow: 'CURATED DEAL FLOW · HANOI',
    hero: 'Don’t just trust a profile. Meet the people building it.',
    sub: 'AI filters signals, investors choose five startups, and VietNexus brings everyone to one coffee table for human verification.',
    explore: 'Explore 12 blind deals', process: 'See how it works', live: 'COMMUNITY PULSE',
  },
};

function Brand() {
  return (
    <span className="public-brand">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>VietNexus</span>
    </span>
  );
}

function PublicHeader({ page, lang, onLang, onNavigate, session, onSignIn, onDashboard }) {
  const t = copy[lang];
  return (
    <header className="public-header">
      <button className="brand-button" onClick={() => onNavigate('home')} aria-label="VietNexus home"><Brand /></button>
      <nav aria-label="Public navigation">
        <button className={page === 'deals' ? 'active' : ''} onClick={() => onNavigate('deals')}>{t.nav[0]}</button>
        <button className={page === 'coffee' ? 'active' : ''} onClick={() => onNavigate('coffee')}>{t.nav[1]}</button>
        <button className={page === 'pricing' ? 'active' : ''} onClick={() => onNavigate('pricing')}>{t.nav[2]}</button>
      </nav>
      <div className="public-actions">
        <button className="lang-switch" onClick={() => onLang(lang === 'vi' ? 'en' : 'vi')} aria-label="Change language">{lang === 'vi' ? 'EN' : 'VI'}</button>
        <button className="text-action" onClick={session ? onDashboard : onSignIn}>{session ? t.dashboard : t.signIn}</button>
        <button className="public-cta" onClick={() => onNavigate('deals')}>{lang === 'vi' ? 'Tìm deal phù hợp' : 'Find a deal'}</button>
      </div>
    </header>
  );
}

function Pulse({ items, lang }) {
  return (
    <section className="pulse-band" aria-label="Community pulse">
      <div className="section-kicker"><span className="live-dot" />{copy[lang].live}</div>
      <div className="pulse-grid">
        {items.map((item) => (
          <article key={item.id} className="pulse-item">
            <span className={`pulse-icon ${item.type}`} aria-hidden="true">{item.type === 'meeting' ? '☕' : item.type === 'offline' ? '✓' : '↗'}</span>
            <div><strong>{item.text}</strong><p>{item.meta}</p></div>
            <time>{item.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function Constellation({ deals, selected, onSelect }) {
  const positions = new Map(deals.map((item) => [item.id, item]));
  return (
    <div className="constellation-wrap">
      <div className="constellation" role="group" aria-label="Startup constellation">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {constellationEdges.map(([from, to]) => {
            const a = positions.get(from); const b = positions.get(to);
            if (!a || !b) return null;
            return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </svg>
        {deals.map((item) => (
          <button
            key={item.id}
            className={`star-node ${selected === item.id ? 'selected' : ''}`}
            style={{ left: `${item.x}%`, top: `${item.y}%`, '--node-size': `${Math.max(30, item.score / 2.15)}px` }}
            onClick={() => onSelect(item.id)}
            aria-label={`${item.alias}, fit ${item.score}%`}
          >
            <span>{item.score}</span>
          </button>
        ))}
        <span className="map-label label-ai">AI & data</span>
        <span className="map-label label-climate">Climate & circular</span>
        <span className="map-label label-market">Market infrastructure</span>
      </div>
      <div className="constellation-list">
        {deals.slice(0, 6).map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><span>{item.score}</span>{item.alias}<small>{item.stage}</small></button>)}
      </div>
    </div>
  );
}

function TrustSignal({ children }) {
  return <span className="trust-signal"><span>✓</span>{children}</span>;
}

function DealCard({ deal, selected, onToggle, onInspect }) {
  return (
    <article className={`deal-card ${selected ? 'selected' : ''}`}>
      <div className="deal-topline"><span>{deal.sector}</span><b>{deal.score}% fit</b></div>
      <button className="deal-title" onClick={onInspect}>{deal.alias}</button>
      <p>{deal.product}</p>
      <div className="deal-meta"><span>{deal.stage}</span><span>{deal.location}</span><span>{money.format(deal.ask)}</span></div>
      <div className="deal-traction"><span className="traction-spark">↗</span><strong>{deal.traction}</strong></div>
      <div className="deal-signals">
        <TrustSignal>{deal.evidence} nguồn</TrustSignal>
        {deal.met > 0 ? <TrustSignal>Đã gặp offline ×{deal.met}</TrustSignal> : <span className="pending-signal">Chưa gặp offline</span>}
      </div>
      <button className={`shortlist-button ${selected ? 'remove' : ''}`} onClick={onToggle}>{selected ? 'Đã chọn · Bỏ' : 'Thêm vào bàn gặp'}</button>
    </article>
  );
}

function DealDrawer({ deal, onClose, onSelect, selected }) {
  if (!deal) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="deal-drawer" role="dialog" aria-modal="true" aria-label={deal.alias}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        <span className="blind-badge">BLIND DEAL ROOM</span>
        <h2>{deal.alias}</h2>
        <p className="drawer-lede">Danh tính được ẩn để bạn đánh giá cơ hội trước khi bị ảnh hưởng bởi thương hiệu hay mối quan hệ.</p>
        <div className="score-panel"><strong>{deal.score}%</strong><span>độ phù hợp</span><small>Độ tin cậy dữ liệu {deal.confidence}%</small></div>
        <h3>Vấn đề & sản phẩm</h3><p>{deal.product}</p>
        <h3>Tín hiệu đã kiểm tra</h3>
        <ul><li>{deal.traction}</li><li>{deal.evidence} nguồn công khai/chính thức đã đối chiếu</li><li>{deal.met ? `${deal.met} lần gặp offline có host check-in` : 'Chưa có lịch sử gặp offline'}</li></ul>
        <div className="privacy-note"><strong>Danh tính mở khi nào?</strong><p>Sau khi startup chấp nhận lời mời, investor thấy tên doanh nghiệp. Thông tin liên hệ chỉ mở sau khi session được thanh toán và xác nhận.</p></div>
        <button className="public-cta full" onClick={onSelect}>{selected ? 'Bỏ khỏi danh sách' : 'Chọn cho Coffee & Chat'}</button>
      </aside>
    </div>
  );
}

function HomePage({ deals, pulse, lang, onNavigate }) {
  const [focus, setFocus] = useState(deals[0]?.id);
  const focused = deals.find((item) => item.id === focus) || deals[0];
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-eyebrow">{copy[lang].eyebrow}</span>
          <h1>{copy[lang].hero}</h1>
          <p>{copy[lang].sub}</p>
          <div className="hero-buttons"><button className="public-cta large" onClick={() => onNavigate('deals')}>{copy[lang].explore}<span>↗</span></button><button className="outline-cta large" onClick={() => onNavigate('coffee')}>{copy[lang].process}</button></div>
          <div className="hero-proof"><span><b>12</b> deal được tuyển chọn</span><span><b>5</b> startup / bàn</span><span><b>90′</b> kiểm chứng trực tiếp</span></div>
        </div>
        <div className="hero-visual">
          <img src="/coffee-chat/community-table.jpg" alt="Startup founders and investors meeting at a coffee table" />
          <div className="hero-card top"><span>AI shortlist</span><strong>12 → 5</strong><small>Theo thesis của bạn</small></div>
          <div className="hero-card bottom"><span>Human verified</span><strong>Offline × 4</strong><small>Host check-in</small></div>
          <div className="photo-caption">Coffee & Chat · cộng đồng VietNexus</div>
        </div>
      </section>

      <Pulse items={pulse} lang={lang} />

      <section className="public-section constellation-section">
        <div className="section-heading split"><div><span className="section-kicker">STARTUP CONSTELLATION</span><h2>Thấy cả hệ sinh thái,<br /><em>không chỉ một danh sách.</em></h2></div><p>Mỗi nút là một cơ hội ẩn danh. Đường nối thể hiện tín hiệu tương đồng về lĩnh vực, giai đoạn và thị trường — không phải quan hệ đầu tư đã xác nhận.</p></div>
        <Constellation deals={deals} selected={focus} onSelect={setFocus} />
        {focused && <div className="map-inspector"><span className="map-score">{focused.score}</span><div><strong>{focused.alias}</strong><p>{focused.product}</p></div><div className="map-inspector-meta"><span>{focused.stage}</span><span>{focused.traction}</span></div><button onClick={() => onNavigate('deals')}>Xem hồ sơ ẩn danh ↗</button></div>}
      </section>

      <section className="public-section blind-preview">
        <div className="blind-copy"><span className="section-kicker">BLIND DEAL ROOM</span><h2>Cơ hội lên tiếng<br /><em>trước danh tính.</em></h2><p>Chúng tôi ẩn tên và contact ở vòng khám phá để investor tập trung vào vấn đề, bằng chứng và độ phù hợp. Danh tính chỉ mở theo từng mốc đồng thuận.</p><button className="ink-link" onClick={() => onNavigate('deals')}>Bước vào deal room <span>→</span></button></div>
        <div className="stacked-deals">
          {deals.slice(0, 3).map((deal, index) => <div className="mini-deal" key={deal.id} style={{ '--index': index }}><div><span>{deal.sector}</span><b>{deal.score}% fit</b></div><h3>{deal.alias}</h3><p>{deal.traction}</p><TrustSignal>{deal.evidence} nguồn đã kiểm tra</TrustSignal></div>)}
        </div>
      </section>

      <section className="coffee-proof">
        <img src="/coffee-chat/human-verification.jpg" alt="A founder showing a product on a laptop during a coffee meeting" />
        <div><span className="section-kicker light">AI GỢI Ý · CON NGƯỜI QUYẾT ĐỊNH</span><h2>Matching chỉ là bước đầu.<br />Niềm tin được xây ở ngoài màn hình.</h2><div className="proof-steps"><span><b>01</b>AI lọc 12 cơ hội</span><span><b>02</b>Investor chọn đúng 5</span><span><b>03</b>Host xác nhận buổi gặp</span></div><button className="saffron-cta" onClick={() => onNavigate('coffee')}>Thiết kế một bàn gặp →</button></div>
      </section>

      <section className="public-section final-cta"><span className="section-kicker">HANOI PILOT</span><h2>Một bàn cà phê.<br /><em>Năm cuộc trò chuyện đáng giá.</em></h2><p>Startup tham gia miễn phí. Investor trả cho việc tuyển chọn, điều phối và một quy trình minh bạch — không trả cho lời hứa đầu tư.</p><button className="public-cta large" onClick={() => onNavigate('deals')}>Bắt đầu shortlist 5 dự án</button></section>
    </main>
  );
}

function DealsPage({ deals, selected, setSelected, onRequireAuth, session, initialIntent }) {
  const [sector, setSector] = useState('Tất cả');
  const [drawer, setDrawer] = useState(null);
  const [builder, setBuilder] = useState(Boolean(initialIntent));
  const [slots, setSlots] = useState(initialIntent?.slots || defaultSlots);
  const [status, setStatus] = useState('');
  const sectors = ['Tất cả', ...new Set(deals.map((item) => item.sector))];
  const shown = sector === 'Tất cả' ? deals : deals.filter((item) => item.sector === sector);

  function toggle(id) {
    setStatus('');
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  }

  async function submitSession() {
    if (selected.length !== 5) return setStatus('Hãy chọn đúng 5 startup.');
    if (slots.some((slot) => !slot)) return setStatus('Hãy đề xuất đủ 3 khung giờ.');
    if (!session) return onRequireAuth({ selected, slots });
    setStatus('Đang tạo lời mời…');
    try {
      const result = await createCoffeeSession(session.token, {
        dealIds: selected,
        slots: slots.map((startsAt) => ({ startsAt: new Date(startsAt).toISOString(), durationMinutes: 90 })),
      });
      setStatus(`Đã tạo session ${result.session?.id || ''}. Lời mời có hiệu lực 48 giờ.`);
    } catch (error) {
      setStatus(`Chưa thể tạo session trên server: ${error.message}. Danh sách vẫn đang ở chế độ xem thử.`);
    }
  }

  return (
    <main className="deals-page">
      <section className="page-intro"><span className="section-kicker">BLIND DEAL ROOM · 12 RECOMMENDATIONS</span><h1>Chọn tín hiệu trước.<br /><em>Gặp con người sau.</em></h1><p>Danh sách minh họa cho Hanoi pilot, được xếp theo một thesis giả định. Bản production sẽ tính lại từ thesis và ticket size của từng investor.</p><span className="demo-label">● DỮ LIỆU MINH HỌA · KHÔNG PHẢI LỜI KHUYÊN ĐẦU TƯ</span></section>
      <div className="filter-row" aria-label="Filter by sector">{sectors.map((item) => <button key={item} className={sector === item ? 'active' : ''} onClick={() => setSector(item)}>{item}</button>)}</div>
      <section className="deal-grid">{shown.map((deal) => <DealCard key={deal.id} deal={deal} selected={selected.includes(deal.id)} onToggle={() => toggle(deal.id)} onInspect={() => setDrawer(deal)} />)}</section>
      <div className={`shortlist-dock ${selected.length ? 'show' : ''}`}><div><span>{selected.length}<small>/5</small></span><p><strong>{selected.length === 5 ? 'Bàn gặp đã đủ' : `Chọn thêm ${5 - selected.length} startup`}</strong><small>AI đề xuất, bạn quyết định.</small></p></div><button disabled={selected.length !== 5} onClick={() => setBuilder(true)}>Đề xuất 3 khung giờ →</button></div>
      {builder && <div className="builder-backdrop"><section className="session-builder" role="dialog" aria-modal="true" aria-label="Create Coffee and Chat session"><button className="drawer-close" onClick={() => setBuilder(false)}>×</button><span className="section-kicker">COFFEE & CHAT BUILDER</span><h2>Đưa 5 dự án về cùng một bàn.</h2><p>Mỗi khung giờ kéo dài 90 phút, trong khoảng 2–21 ngày tới. Startup sẽ vote; hệ thống chọn giờ có nhiều người tham gia nhất.</p><div className="selected-aliases">{selected.map((id) => <span key={id}>{deals.find((item) => item.id === id)?.alias}</span>)}</div><div className="slot-list">{slots.map((slot, index) => <label key={index}><span>Lựa chọn {index + 1}</span><input type="datetime-local" value={slot} onChange={(event) => setSlots((current) => current.map((value, slotIndex) => slotIndex === index ? event.target.value : value))} /></label>)}</div><div className="fee-summary"><span>Phí điều phối khi ≥3 startup nhận lời</span><strong>1.490.000₫</strong><small>Đồ uống thanh toán riêng tại địa điểm. Chưa thu tiền ở bước này.</small></div>{status && <p className="builder-status" role="status">{status}</p>}<button className="public-cta full large" onClick={submitSession}>{session ? 'Gửi 5 lời mời' : 'Đăng nhập để gửi lời mời'}</button></section></div>}
      <DealDrawer deal={drawer} onClose={() => setDrawer(null)} selected={drawer && selected.includes(drawer.id)} onSelect={() => drawer && toggle(drawer.id)} />
    </main>
  );
}

function CoffeePage({ onNavigate }) {
  return (
    <main className="coffee-page">
      <section className="page-intro centered"><span className="section-kicker">FROM MATCH TO MEETING</span><h1>AI giảm nhiễu.<br /><em>Coffee & Chat tạo niềm tin.</em></h1><p>Một quy trình có checkpoint rõ ràng, không biến “AI match” thành lời bảo chứng đầu tư.</p></section>
      <section className="journey-grid">
        {[['01', 'AI tuyển chọn 12', 'Đối chiếu thesis, stage, ticket size và nguồn dữ liệu có provenance.'], ['02', 'Investor chọn đúng 5', 'Đánh giá cơ hội ẩn danh, chưa thấy contact hoặc thương hiệu.'], ['03', 'Startup nhận lời & vote', 'Investor đề xuất 3 giờ. Khi ≥3 startup nhận lời, session đạt ngưỡng.'], ['04', 'Thanh toán qua PayOS', '1.490.000₫ cho tuyển chọn và điều phối; đồ uống thanh toán riêng.'], ['05', 'Host check-in offline', 'VietNexus xác nhận attendance, sau đó mở form feedback riêng tư.'], ['06', 'Tín hiệu quay lại hệ thống', 'Chỉ công khai số lần “đã gặp offline”; nhận xét chi tiết luôn riêng tư.']].map(([n, title, text]) => <article key={n}><span>{n}</span><h2>{title}</h2><p>{text}</p></article>)}
      </section>
      <section className="venue-section"><div><span className="section-kicker">VENUE MATCHING · HÀ NỘI</span><h2>Địa điểm cũng là một phần của trải nghiệm.</h2><p>Hệ thống xếp hạng theo khoảng cách, khả năng đáp ứng khung giờ, độ phù hợp cho cuộc trò chuyện và rating. Host luôn là người xác nhận cuối cùng.</p></div><div className="venue-cards">{venueSuggestions.map((venue) => <article key={venue.id}><div><span>{venue.fit}% phù hợp</span><b>Host confirms</b></div><h3>{venue.name}</h3><p>{venue.note}</p><small>{venue.area}</small></article>)}</div></section>
      <section className="policy-strip"><div><strong>Hủy trước 24h</strong><span>Nhận credit cho session kế tiếp</span></div><div><strong>Platform hủy</strong><span>Hoàn tiền toàn bộ</span></div><div><strong>Investor hủy muộn</strong><span>Không hoàn phí điều phối</span></div></section>
      <section className="public-section final-cta"><h2>Sẵn sàng rời khỏi danh sách<br /><em>và bước vào cuộc trò chuyện?</em></h2><button className="public-cta large" onClick={() => onNavigate('deals')}>Chọn 5 startup</button></section>
    </main>
  );
}

function PricingPage({ onNavigate }) {
  return (
    <main className="pricing-page"><section className="page-intro centered"><span className="section-kicker">SIMPLE, OUTCOME-ALIGNED PRICING</span><h1>Trả phí cho một bàn gặp<br /><em>đã đủ người.</em></h1><p>Không subscription. Không thu phí startup. Không tính tiền cho danh sách chưa đạt ngưỡng.</p></section><section className="pricing-card"><div className="price"><span>COFFEE & CHAT SESSION</span><strong>1.490.000<sup>₫</sup></strong><p>Một investor · tối đa 5 startup · 90 phút</p></div><ul><li>AI shortlist 12 cơ hội theo thesis</li><li>Investor tự chọn đúng 5 dự án</li><li>Điều phối lời mời và 3 khung giờ</li><li>Đề xuất 3 địa điểm tại Hà Nội</li><li>Host check-in và feedback riêng tư</li><li>Chỉ thanh toán khi ≥3 startup đồng ý</li></ul><div className="price-note"><strong>Không bao gồm</strong><p>Đồ uống, chi phí đi lại, thẩm định pháp lý/tài chính hoặc bất kỳ cam kết đầu tư nào.</p></div><button className="public-cta full large" onClick={() => onNavigate('deals')}>Xem 12 cơ hội ẩn danh</button></section><section className="founder-free"><img src="/coffee-chat/community-proof.jpg" alt="Startup community members meeting at a cafe" /><div><span className="section-kicker light">FOUNDERS JOIN FREE</span><h2>Startup không trả tiền để được “match”.</h2><p>Founder đăng sản phẩm và bằng chứng. VietNexus chỉ mời tới bàn phù hợp; không bán thứ hạng, không công khai review tiêu cực.</p></div></section></main>
  );
}

function Footer({ onNavigate }) {
  return <footer className="public-footer"><Brand /><p>Curated deal flow, verified through human conversation.</p><div><button onClick={() => onNavigate('deals')}>Blind deals</button><button onClick={() => onNavigate('coffee')}>Coffee & Chat</button><button onClick={() => onNavigate('pricing')}>Pricing</button></div><small>© 2026 VietNexus · Hanoi pilot</small></footer>;
}

export default function PublicExperience({ session, onSignIn, onDashboard, onRequireAuth, initialIntent }) {
  const [page, setPage] = useState(() => pathToPage(window.location.pathname));
  const [lang, setLang] = useState('vi');
  const [deals, setDeals] = useState(demoDeals);
  const [pulse, setPulse] = useState(demoPulse);
  const [selected, setSelected] = useState(initialIntent?.selected || []);

  useEffect(() => {
    const onPop = () => setPage(pathToPage(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    Promise.allSettled([getPublicDeals(), getPublicPulse(), getPublicConstellation()]).then(([dealResult, pulseResult]) => {
      if (dealResult.status === 'fulfilled' && dealResult.value.deals?.length) {
        setDeals(dealResult.value.deals.map((deal, index) => ({
          ...deal,
          ask: Number(deal.funding_ask_usd || 0),
          score: Math.round(Number(deal.confidence || 0)),
          confidence: Math.round(Number(deal.confidence || 0)),
          traction: deal.traction_summary,
          product: deal.product_summary,
          evidence: Number(deal.evidence_count || 0),
          met: Number(deal.offline_meet_count || 0),
          x: 12 + ((index * 19) % 76),
          y: 16 + ((index * 23) % 68),
        })));
      }
      if (pulseResult.status === 'fulfilled' && pulseResult.value.events?.length) {
        setPulse(pulseResult.value.events.map((event) => ({ ...event, time: new Date(event.time).toLocaleDateString('vi-VN') })));
      }
    });
  }, []);

  const navigate = (next) => {
    const paths = { home: '/', deals: '/deals', coffee: '/coffee-chat', pricing: '/pricing' };
    window.history.pushState({}, '', paths[next]);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const content = useMemo(() => {
    if (page === 'deals') return <DealsPage deals={deals} selected={selected} setSelected={setSelected} onRequireAuth={onRequireAuth} session={session} initialIntent={initialIntent} />;
    if (page === 'coffee') return <CoffeePage onNavigate={navigate} />;
    if (page === 'pricing') return <PricingPage onNavigate={navigate} />;
    return <HomePage deals={deals} pulse={pulse} lang={lang} onNavigate={navigate} />;
  }, [page, deals, pulse, lang, selected, session]);

  return <div className="public-shell"><PublicHeader page={page} lang={lang} onLang={setLang} onNavigate={navigate} session={session} onSignIn={onSignIn} onDashboard={onDashboard} />{content}<Footer onNavigate={navigate} /></div>;
}
