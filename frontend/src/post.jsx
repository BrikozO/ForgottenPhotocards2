// Post detail page — photos (carousel variant from Tweaks) on the left,
// description column on the right.

function PostPage({ post, posts, carouselVariant, onNav }) {
  if (!post) return null;

  const related = posts.filter((p) => p.id !== post.id).slice(0, 3);

  // Safe hashtag formatter — used for camera/lens/film. Returns empty when nothing to format.
  const tag = (s) =>
    (s || '')
      .replaceAll(' ', '_')
      .replaceAll('.', '')
      .replaceAll('/', '_')
      .replaceAll('(', '')
      .replaceAll(')', '');

  const reactions = post.reactions && typeof post.reactions === 'object' ? post.reactions : {};
  const hasReactions = Object.keys(reactions).length > 0;
  const hasViews = typeof post.views === 'number';
  const hasTime  = !!post.time;
  const hasMetaLine = hasReactions || hasViews || hasTime;

  return (
    <div className="fpc-main">
      <section className="fpc-post">
        <div className="fpc-post-top">
          <button className="fpc-back" onClick={() => onNav({ view: 'feed' })}>
            <svg width="12" height="12" viewBox="0 0 14 14"><path d="M9 1L3 7l6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
            <span>Назад в ленту</span>
          </button>
          {post.id != null && <div className="fpc-post-no mono">№ {post.id}</div>}
        </div>

        <div className="fpc-post-body">
          <div className="fpc-post-photos">
            <Carousel photos={post.photos || []} variant={carouselVariant}/>
          </div>

          <aside className="fpc-post-side">
            <div className="fpc-post-eyebrow">
              {post.type && (
                <span className="pill" data-type={post.type}>
                  {post.type === 'film' ? 'Плёнка' : 'Цифра'}
                </span>
              )}
              {post.date && <span>{formatDateLong(post.date)}</span>}
            </div>

            <h1 className="fpc-post-title">{post.title || '—'}</h1>

            {post.description && <p className="fpc-post-note">{post.description}</p>}

            <dl className="fpc-post-specs">
              {post.location && (
                <div className="fpc-post-spec">
                  <dt>Локация</dt>
                  <dd>{post.location}</dd>
                </div>
              )}
              {Array.isArray(post.models) && post.models.length > 0 && (
                <div className="fpc-post-spec">
                  <dt>В кадре</dt>
                  <dd>{post.models.join(', ')}</dd>
                </div>
              )}
              {post.camera && (
                <div className="fpc-post-spec">
                  <dt>Камера</dt>
                  <dd className="with-hash">#{tag(post.camera)}</dd>
                </div>
              )}
              {post.lens && (
                <div className="fpc-post-spec">
                  <dt>Объектив</dt>
                  <dd className="with-hash">#{tag(post.lens)}</dd>
                </div>
              )}
              {post.film && (
                <div className="fpc-post-spec">
                  <dt>Плёнка</dt>
                  <dd className="with-hash">#{tag(post.film)}</dd>
                </div>
              )}
              {Array.isArray(post.photos) && post.photos.length > 0 && (
                <div className="fpc-post-spec">
                  <dt>Кадров</dt>
                  <dd>{post.photos.length}</dd>
                </div>
              )}
            </dl>

            {hasMetaLine && (
              <div className="fpc-react-row">
                {Object.entries(reactions).map(([emoji, n]) => (
                  <span className="fpc-react" key={emoji}>
                    <span>{emoji}</span>
                    <b>{n}</b>
                  </span>
                ))}
                {(hasViews || hasTime) && (
                  <span className="fpc-views">
                    {hasViews && `${post.views} ${plural(post.views, PL.views)}`}
                    {hasViews && hasTime && ' · '}
                    {hasTime && post.time}
                  </span>
                )}
              </div>
            )}

            {post.id != null && (
              <a
                className="fpc-post-tg"
                href={`https://t.me/forgottenphotocards/${post.id}`}
                target="_blank"
                rel="noopener"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                </svg>
                <div className="fpc-post-tg-body">
                  <div className="fpc-post-tg-eyebrow">Этот пост в Telegram</div>
                  <div className="fpc-post-tg-label">@forgottenphotocards / {post.id}</div>
                </div>
                <div className="fpc-post-tg-arrow">↗</div>
              </a>
            )}
          </aside>
        </div>

        <section className="fpc-related">
          <div className="fpc-related-h">
            <span>Другие плёнки</span>
            <button className="fpc-back" onClick={() => onNav({ view: 'feed' })} style={{ padding: 0 }}>
              <span>Вся лента</span>
              <svg width="10" height="10" viewBox="0 0 14 14"><path d="M5 1l6 6-6 6" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
            </button>
          </div>
          <div className="fpc-related-grid">
            {related.map((p) => (
              <PostCard key={p.id} post={p} onOpen={(id) => onNav({ view: 'post', id })}/>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

Object.assign(window, { PostPage });
