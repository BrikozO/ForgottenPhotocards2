// Photo carousel — four variants, switchable via the `variant` prop.
//   A · arrows + thumbnails strip below
//   B · arrows + dots indicator (Instagram-like)
//   C · vertical scroll, all photos stacked
//   D · grid with click-to-lightbox

const { useState, useEffect, useRef, useCallback } = React;

function Carousel({ photos, variant = 'arrows', accent }) {
  if (variant === 'vertical') return <CarouselVertical photos={photos}/>;
  if (variant === 'grid')     return <CarouselGrid photos={photos}/>;
  if (variant === 'dots')     return <CarouselDots photos={photos}/>;
  return <CarouselArrows photos={photos}/>;
}

// ─── Variant A — arrows + thumbnails ──────────────────────────────
function CarouselArrows({ photos }) {
  const [i, setI] = useState(0);
  const stripRef = useRef(null);
  const next = useCallback(() => setI((x) => (x + 1) % photos.length), [photos.length]);
  const prev = useCallback(() => setI((x) => (x - 1 + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Scroll active thumb into view
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector('[data-active="true"]');
    if (active) {
      const stripRect = strip.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      const offset = r.left - stripRect.left + strip.scrollLeft - (stripRect.width - r.width) / 2;
      strip.scrollTo({ left: offset, behavior: 'smooth' });
    }
  }, [i]);

  const p = photos[i];

  return (
    <div className="car-arrows">
      <div className="car-stage">
        <img key={i} src={p.src} alt={p.alt} className="car-img"/>
        <button className="car-arrow car-prev" onClick={prev} aria-label="Назад">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
        </button>
        <button className="car-arrow car-next" onClick={next} aria-label="Вперёд">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 1l6 6-6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
        </button>
        <div className="car-counter">
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span className="car-counter-sep">/</span>
          <span>{String(photos.length).padStart(2, '0')}</span>
        </div>
      </div>
      <div className="car-thumbs" ref={stripRef}>
        {photos.map((ph, idx) => (
          <button
            key={idx}
            data-active={idx === i}
            className="car-thumb"
            onClick={() => setI(idx)}
            aria-label={`Фото ${idx + 1}`}
          >
            <img src={ph.src.replace(/\/(\d+)\/(\d+)$/, '/220/220')} alt=""/>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Variant B — arrows + dots ────────────────────────────────────
function CarouselDots({ photos }) {
  const [i, setI] = useState(0);
  const next = () => setI((x) => (x + 1) % photos.length);
  const prev = () => setI((x) => (x - 1 + photos.length) % photos.length);

  // Swipe support
  const stage = useRef(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let x0 = null;
    const start = (e) => { x0 = (e.touches ? e.touches[0] : e).clientX; };
    const end = (e) => {
      if (x0 == null) return;
      const x1 = (e.changedTouches ? e.changedTouches[0] : e).clientX;
      const dx = x1 - x0;
      if (Math.abs(dx) > 30) (dx < 0 ? next : prev)();
      x0 = null;
    };
    el.addEventListener('touchstart', start);
    el.addEventListener('touchend', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  });

  const p = photos[i];
  return (
    <div className="car-dots">
      <div className="car-stage" ref={stage}>
        <img key={i} src={p.src} alt={p.alt} className="car-img"/>
        <button className="car-arrow car-prev" onClick={prev} aria-label="Назад">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
        </button>
        <button className="car-arrow car-next" onClick={next} aria-label="Вперёд">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 1l6 6-6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
        </button>
      </div>
      <div className="car-dots-row">
        {photos.map((_, idx) => (
          <button
            key={idx}
            data-active={idx === i}
            className="car-dot"
            onClick={() => setI(idx)}
            aria-label={`Фото ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Variant C — vertical scroll ──────────────────────────────────
function CarouselVertical({ photos }) {
  return (
    <div className="car-vertical">
      {photos.map((p, idx) => (
        <figure className="car-v-item" key={idx}>
          <img src={p.src} alt={p.alt} loading={idx < 2 ? 'eager' : 'lazy'}/>
          <figcaption>{String(idx + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// ─── Variant D — grid + lightbox ──────────────────────────────────
function CarouselGrid({ photos }) {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((x) => (x + 1) % photos.length);
      if (e.key === 'ArrowLeft')  setOpen((x) => (x - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  return (
    <div className="car-grid-wrap">
      <div className="car-grid">
        {photos.map((p, idx) => {
          const isPortrait = p.h > p.w;
          return (
            <button
              key={idx}
              className="car-grid-cell"
              data-portrait={isPortrait ? '1' : '0'}
              onClick={() => setOpen(idx)}
            >
              <img src={p.src} alt={p.alt} loading="lazy"/>
              <span className="car-grid-no">{String(idx + 1).padStart(2, '0')}</span>
            </button>
          );
        })}
      </div>
      {open != null && (
        <div className="car-lightbox" onClick={() => setOpen(null)}>
          <div className="car-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={photos[open].src} alt={photos[open].alt}/>
            <div className="car-lightbox-meta">
              <span>{String(open + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
            </div>
            <button className="car-lightbox-x" onClick={() => setOpen(null)} aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 14 14"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4"/></svg>
            </button>
            <button className="car-lightbox-prev" onClick={() => setOpen((x) => (x - 1 + photos.length) % photos.length)} aria-label="Назад">
              <svg width="16" height="16" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
            </button>
            <button className="car-lightbox-next" onClick={() => setOpen((x) => (x + 1) % photos.length)} aria-label="Вперёд">
              <svg width="16" height="16" viewBox="0 0 14 14"><path d="M5 1l6 6-6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Carousel, CarouselArrows, CarouselDots, CarouselVertical, CarouselGrid });
