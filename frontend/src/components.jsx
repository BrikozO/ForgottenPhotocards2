// Shared UI: Logo, Header, Footer, PostCard, etc.
// All components written as plain JSX, exported to window for cross-file scope.

const { useState, useEffect, useRef } = React;

// ─── Russian pluralization ─────────────────────────────────────────
// Pick the right word form for `n`. Forms tuple: [one, few, many].
//   1 пост, 2 поста, 5 постов, 21 пост, 22 поста, 25 постов, 11 постов…
function plural(n, forms) {
  const abs = Math.abs(Number(n) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
const pluralizeRu = (n, forms) => `${Number(n) || 0} ${plural(Number(n) || 0, forms)}`;

// Commonly-used forms
const PL = {
  posts:       ['пост', 'поста', 'постов'],
  photocards:  ['фотокарточка', 'фотокарточки', 'фотокарточек'],
  subscribers: ['подписчик', 'подписчика', 'подписчиков'],
  views:       ['просмотр', 'просмотра', 'просмотров'],
  frames:      ['кадр', 'кадра', 'кадров'],
};

// ─── Logo ──────────────────────────────────────────────────────────
// Minimalist camera glyph + wordmark. Replaces the photo-realistic
// camera illustration of the old site with a flat outline mark.
function FPCLogo({ size = 28, color = 'currentColor' }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 36 28" fill="none" aria-hidden="true">
      {/* Body */}
      <rect x="1" y="6" width="34" height="20" rx="1.5" stroke={color} strokeWidth="1.4"/>
      {/* Top hump (viewfinder) */}
      <path d="M11 6 L13.5 2 L22.5 2 L25 6" stroke={color} strokeWidth="1.4" strokeLinejoin="miter" fill="none"/>
      {/* Lens */}
      <circle cx="18" cy="16" r="6" stroke={color} strokeWidth="1.4"/>
      <circle cx="18" cy="16" r="2.4" stroke={color} strokeWidth="1.2"/>
      {/* Shutter dot */}
      <circle cx="30" cy="10" r="0.9" fill={color}/>
    </svg>
  );
}

function Logo({ wordmark = 'ЗАБЫТЫЕ ФОТОКАРТОЧКИ', tagline = 'From personal photo-album', compact = false }) {
  return (
    <div className="fpc-logo" data-compact={compact ? '1' : '0'}>
      <FPCLogo size={compact ? 22 : 30}/>
      <div className="fpc-logo-text">
        <div className="fpc-logo-mark">{wordmark}</div>
        {!compact && <div className="fpc-logo-tag">{tagline}</div>}
      </div>
    </div>
  );
}

// ─── Header / Nav ─────────────────────────────────────────────────
function Header({ route, onNav, mobile = false, onMobileMenu, photoCount, subs }) {
  return (
    <header className="fpc-header">
      <button className="fpc-logo-btn" onClick={() => onNav({ view: 'feed' })} aria-label="На главную">
        <Logo compact={mobile}/>
      </button>
      {!mobile && (
        <nav className="fpc-nav">
          <button data-active={route.view === 'feed'} onClick={() => onNav({ view: 'feed' })}>
            Лента
          </button>
          <button data-active={route.filter === 'film'} onClick={() => onNav({ view: 'feed', filter: 'film' })}>
            Плёнка
          </button>
          <button data-active={route.filter === 'digital'} onClick={() => onNav({ view: 'feed', filter: 'digital' })}>
            Цифра
          </button>
          <button data-active={route.view === 'about'} onClick={() => onNav({ view: 'about' })}>
            Об авторе
          </button>
        </nav>
      )}
      <div className="fpc-header-right">
        {!mobile && (
          <div className="fpc-counts" aria-hidden="true">
            <span><b>{Number(photoCount) || 0}</b> фото</span>
            <span className="fpc-dot">·</span>
            <span><b>{Number(subs) || 0}</b> {plural(Number(subs) || 0, PL.subscribers)}</span>
          </div>
        )}
        <TelegramButton compact={mobile}/>
        {mobile && (
          <button className="fpc-burger" onClick={onMobileMenu} aria-label="Меню">
            <svg width="20" height="14" viewBox="0 0 20 14"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.4"/></svg>
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Telegram CTA ─────────────────────────────────────────────────
function TelegramButton({ compact = false }) {
  return (
    <a
      className="fpc-tg-btn"
      data-compact={compact ? '1' : '0'}
      href="https://t.me/forgottenphotocards"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
      </svg>
      <span>{compact ? 'Telegram' : 'Подписаться в Telegram'}</span>
    </a>
  );
}

// ─── Mobile menu drawer ───────────────────────────────────────────
function MobileMenu({ open, onClose, route, onNav }) {
  if (!open) return null;
  const nav = (r) => { onNav(r); onClose(); };
  return (
    <div className="fpc-mobile-menu" onClick={onClose}>
      <div className="fpc-mobile-menu-card" onClick={(e) => e.stopPropagation()}>
        <div className="fpc-mobile-menu-head">
          <Logo compact/>
          <button onClick={onClose} className="fpc-mobile-close" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4"/></svg>
          </button>
        </div>
        <div className="fpc-mobile-nav">
          <button onClick={() => nav({ view: 'feed' })} data-active={route.view === 'feed' && !route.filter}>Лента</button>
          <button onClick={() => nav({ view: 'feed', filter: 'film' })} data-active={route.filter === 'film'}>Плёнка</button>
          <button onClick={() => nav({ view: 'feed', filter: 'digital' })} data-active={route.filter === 'digital'}>Цифра</button>
          <button onClick={() => nav({ view: 'about' })} data-active={route.view === 'about'}>Об авторе</button>
        </div>
        <a className="fpc-tg-btn fpc-tg-block" href="https://t.me/forgottenphotocards" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
          <span>Подписаться в Telegram</span>
        </a>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────
function Footer({ mobile = false }) {
  return (
    <footer className="fpc-footer">
      <div className="fpc-footer-inner">
        <div className="fpc-footer-brand">
          <Logo compact={mobile}/>
          <div className="fpc-footer-by">© {new Date().getFullYear()} · 1020 Tech</div>
        </div>
        <div className="fpc-footer-cols">
          <div>
            <div className="fpc-footer-h">Канал</div>
            <a href="https://t.me/forgottenphotocards" target="_blank" rel="noopener">@forgottenphotocards</a>
            <a href="https://t.me/forgottenphotocards" target="_blank" rel="noopener">Telegram</a>
          </div>
          <div>
            <div className="fpc-footer-h">Контакты</div>
            <a href="mailto:hello@zabytye.ru">oleg.yakushev.work@gmail.com</a>
            <a href="https://github.com/BrikozO" target="_blank" rel="noopener">GitHub</a>
          </div>
          <div>
            <div className="fpc-footer-h">Сайт</div>
            <a href="https://zabytye.ru">zabytye.ru</a>
            <span className="fpc-footer-quiet">By Oleg Iakushev ©</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────
function FilterChips({ active, onChange, counts }) {
  const opts = [
    { id: null, label: 'Все', count: counts.all },
    { id: 'film', label: 'Плёнка', count: counts.film },
    { id: 'digital', label: 'Цифра', count: counts.digital },
  ];
  return (
    <div className="fpc-filters" role="tablist">
      {opts.map((o) => (
        <button
          key={o.id || 'all'}
          role="tab"
          aria-selected={active === o.id}
          data-active={active === o.id}
          onClick={() => onChange(o.id)}
        >
          <span>{o.label}</span>
          <span className="fpc-chip-count">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Post card (feed cell) ────────────────────────────────────────
function PostCard({ post, onOpen, mobile }) {
  const photos = Array.isArray(post.photos) ? post.photos : [];
  const cover = photos[0];
  const aspect = cover && cover.w && cover.h ? cover.w / cover.h : 1.4;
  // Pick a card aspect — landscape covers stay landscape, portrait stay portrait
  const isPortrait = aspect < 0.9;
  const hasLoc = !!post.location;
  const hasDate = !!post.date;
  return (
    <article className="fpc-card" data-portrait={isPortrait ? '1' : '0'} onClick={() => onOpen(post.id)}>
      <div className="fpc-card-img">
        {cover && <img src={cover.src} alt={post.title || ''} loading="lazy"/>}
        <div className="fpc-card-count">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="0.5" y="2.5" width="11" height="9" rx="0.5" stroke="currentColor" strokeWidth="1"/>
            <rect x="2.5" y="0.5" width="7" height="2" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <span>{photos.length}</span>
        </div>
      </div>
      <div className="fpc-card-meta">
        <div className="fpc-card-row">
          <h3 className="fpc-card-title">{post.title || '—'}</h3>
          {post.type && (
            <span className="fpc-card-type" data-type={post.type}>
              {post.type === 'film' ? 'Плёнка' : 'Цифра'}
            </span>
          )}
        </div>
        {(hasLoc || hasDate) && (
          <div className="fpc-card-sub">
            {hasLoc && <span className="fpc-card-loc">{post.location}</span>}
            {hasLoc && hasDate && <span className="fpc-card-dot">·</span>}
            {hasDate && <span className="fpc-card-date">{formatDate(post.date)}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Date helper ──────────────────────────────────────────────────
const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}
function formatDateLong(iso) {
  const d = new Date(iso);
  const M = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── About panel (used in feed sidebar & about page) ──────────────
function AboutBlock({ compact = false }) {
  return (
    <div className="fpc-about-block">
      <div className="fpc-about-eyebrow">Об авторе</div>
      <h2 className="fpc-about-name">Oleg<br/>Iakushev</h2>
      <p className="fpc-about-bio">
        Снимаю на плёнку и цифру с 2019. Архитектура, города, портреты —
        то, что хочется не забыть. Личный фотоальбом, который превратился
        в Telegram-канал, а теперь — в сайт.
      </p>
      <div className="fpc-about-meta">
        <div><span>Базируюсь</span><b>Москва, Россия</b></div>
        <div><span>Камеры</span><b>Fujica ST-801 · Canon EOS 650D</b></div>
        <div><span>Канал с</span><b>2023</b></div>
      </div>
    </div>
  );
}

Object.assign(window, {
  FPCLogo, Logo, Header, TelegramButton, MobileMenu, Footer,
  FilterChips, PostCard, AboutBlock,
  formatDate, formatDateLong,
  plural, pluralizeRu, PL,
});
