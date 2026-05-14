# ─── Stage 1: transpile JSX → JS with esbuild ────────────────────
# Each source file lives in its own global scope at runtime (the previous
# design served them as separate `<script>` tags) and shares state via
# `window.*` assignments. We preserve that contract here: esbuild runs in
# transform mode per file, no bundling — JSX gets rewritten to plain JS,
# nothing else moves.
FROM node:20-alpine AS builder
WORKDIR /build

RUN npm install --no-save --silent esbuild@0.24.0

COPY tweaks-panel.jsx ./
COPY src ./src

# All source files run as classic <script>s in the original design and share
# state via `window.*`. That doesn't survive concatenation as-is — each file
# has its own `const { useState, ... } = React;` line, and `const` lives in
# the shared global lexical scope across classic scripts, so duplicates throw
# SyntaxError at load and silently zero out half the components.
#
# Strategy: drop those destructures via sed, write a single preamble that
# declares every hook (and the per-file aliases used in app.jsx / feed.jsx)
# once, then concat in the original load order and let esbuild produce a
# single minified /app.js.
RUN set -e; \
    { \
      echo 'const { useState, useEffect, useRef, useCallback, useMemo } = React;'; \
      echo 'const useState_F = useState, useStateA = useState, useEffectA = useEffect;'; \
      for f in tweaks-panel.jsx src/components.jsx src/carousel.jsx \
               src/feed.jsx src/post.jsx src/admin.jsx src/app.jsx src/boot.jsx; do \
        sed -E '/^[[:space:]]*const[[:space:]]*\{[^}]*\}[[:space:]]*=[[:space:]]*React;[[:space:]]*$/d' "$f"; \
      done; \
    } > /tmp/bundle.jsx && \
    ./node_modules/.bin/esbuild /tmp/bundle.jsx \
      --target=es2020 --minify > /build/app.js


# ─── Stage 2: nginx serving the static SPA ───────────────────────
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

# index.html, plain-JS API client, CSS, and the transpiled JS modules.
# JSX is no longer served — only the .js outputs from the builder stage.
RUN mkdir -p /usr/share/nginx/html/src
COPY index.html               /usr/share/nginx/html/index.html
COPY src/api.js               /usr/share/nginx/html/src/api.js
COPY src/*.css                /usr/share/nginx/html/src/
COPY --from=builder /build/app.js /usr/share/nginx/html/app.js

EXPOSE 80

# 127.0.0.1 explicitly — Alpine's musl resolver maps `localhost` only to
# ::1 by default, but nginx listens on IPv4 0.0.0.0:80.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/ >/dev/null || exit 1
