# Offline draw.io resources

Pinned upstream release: [v32.4.1](https://github.com/jgraph/drawio/releases/tag/v32.4.1).
Archive: `draw.war`, SHA-256 `b83663313ccdecef6581476a7eaa96750bccf1bfdc3768981eb5d95e94be7820`.

Run `pnpm drawio:install` once with network access, or `node scripts/install-drawio.mjs /path/to/draw.war` using the matching archive. The installed web assets are in ignored `public/drawio/`; subsequent dev/build starts do not download them again. Production bundles include those assets locally. Never depend on browser/service-worker caches for offline use.

The installer retains upstream copyright notices and adds an offline-only CSP to `index.html`. Apache-2.0 license is included alongside bundled resources. Cloud integrations and external shape/image/font services are intentionally unavailable.
