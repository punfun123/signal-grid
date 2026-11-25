# =============================================================================
# World Monitor — Docker Image
# =============================================================================
# Multi-stage build:
#   builder       — installs deps, compiles TS handlers, builds Vite frontend
#   runtime-deps  — installs only packages needed by unbundled raw JS handlers
#   final         — nginx (static) + node (API) under supervisord
# =============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# Runs on the build host's own architecture: everything it hands to later stages
# (dist/, api/, data/, the sidecar) is plain JS and HTML, and npm ci, tsc and
# vite crash or crawl under QEMU when a multi-platform build targets arm64.
FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder

WORKDIR /app
ENV npm_config_install_links=true

# Install root dependencies (layer-cached until package.json changes)
COPY package.json package-lock.json ./
COPY vendor/braces/ ./vendor/braces/
COPY scripts/vendor/deepmerge/ ./scripts/vendor/deepmerge/
COPY vendor/stream-json/ ./vendor/stream-json/
COPY vendor/vercel-og/ ./vendor/vercel-og/
RUN npm ci --ignore-scripts

# Copy full source
COPY . .

ARG VITE_GRID_PUBLIC_ORIGIN
ARG VITE_GRID_CONTRACT_ADDRESS
ARG VITE_GRID_X_URL
ARG VITE_GRID_CHART_URL
ARG VITE_GRID_SOURCE_CODE_URL
ARG VITE_PMTILES_URL
ENV VITE_VARIANT=full
RUN npm run build:full
RUN test -s dist/dashboard.html && test -s dist/manifest.webmanifest

# Reuse the upstream sidecar API compiler after the app build.
RUN node docker/build-handlers.mjs

# docker/nginx.conf's error_page points 5xx at /500.html; if the copy ever
# breaks, nginx silently falls back to its stock error page.
RUN test -s dist/500.html

# ── Stage 2: Runtime dependencies ───────────────────────────────────────────
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS runtime-deps

WORKDIR /app

# Keep the runtime dependency set deliberately smaller than the app's full
# production graph. The raw api/*.js handlers are not bundled by
# docker/build-handlers.mjs, so they still need these package imports at
# runtime, but the frontend/server-only production deps do not belong in the
# final image.
COPY docker/runtime-package.json ./package.json
COPY docker/runtime-package-lock.json ./package-lock.json
RUN npm ci --omit=dev --omit=optional --ignore-scripts

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS final

# nginx + supervisord
RUN apk add --no-cache nginx supervisor gettext && \
    mkdir -p /tmp/nginx-client-body /tmp/nginx-proxy /tmp/nginx-fastcgi \
             /tmp/nginx-uwsgi /tmp/nginx-scgi /var/log/supervisor && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# API server
COPY --from=builder /app/src-tauri/sidecar/local-api-server.mjs ./local-api-server.mjs
COPY --from=builder /app/src-tauri/sidecar/package.json ./package.json
COPY --from=builder /app/shared/llm-health-providers.js ./shared/llm-health-providers.js
COPY --from=builder /app/shared/grid-profile.js ./shared/grid-profile.js
COPY --from=builder /app/shared/desktop-key-access.js ./shared/desktop-key-access.js
COPY --from=builder /app/shared/selfhost-relay-paths.js ./shared/selfhost-relay-paths.js
ENV LOCAL_API_RESOURCE_DIR=/app

# Minimal runtime node_modules — required by raw .js handlers that aren't
# bundled by build-handlers.mjs. Without this the Node sidecar dispatches
# those routes, fails to resolve package imports like @upstash/ratelimit,
# and returns 502 "missing dependency".
COPY --from=runtime-deps /app/node_modules ./node_modules

# API handler modules (JS originals + compiled TS bundles)
COPY --from=builder /app/api ./api

# Static data files used by handlers at runtime
COPY --from=builder /app/data ./data

# Built frontend static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx + supervisord configs
COPY docker/nginx.conf /etc/nginx/nginx.conf.template
COPY docker/supervisord.conf /etc/supervisor/conf.d/worldmonitor.conf
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY docker/render-nginx-realip.mjs /app/render-nginx-realip.mjs
COPY docker/validate-session-secret.mjs /app/validate-session-secret.mjs
RUN chmod +x /app/entrypoint.sh

# Ensure writable dirs for non-root
RUN chown -R appuser:appgroup /app /tmp/nginx-client-body /tmp/nginx-proxy \
    /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi /var/log/supervisor \
    /var/lib/nginx /var/log/nginx

USER appuser

EXPOSE 8080

# Healthcheck via nginx. Use 127.0.0.1 (not localhost - that resolves to ::1
# first, where nginx does not listen). Probe /api/sidecar-health, a dedicated
# auth-exempt liveness route in the sidecar (local-api-server.mjs): reaching it
# through nginx's /api/ proxy verifies BOTH nginx and the node sidecar are up,
# unlike a static "/" probe which only proves nginx is serving. Keep this off
# /api/health so the public compact data-health contract still reaches api/health.js.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/sidecar-health >/dev/null 2>&1 || exit 1

CMD ["/app/entrypoint.sh"]
