set dotenv-load

plugin_id := "media-transcribe"
vault_path := env("OBSIDIAN_VAULT", "")

# List available recipes
default:
    @just --list

# Install dependencies
setup:
    npm install

# Compile plugin (development, watch mode)
dev:
    npm run dev

# Compile plugin (production build)
build:
    npm run build

# Run tests
test:
    npx vitest run

# Run tests in watch mode
test-watch:
    npx vitest watch

# Run tests with coverage
test-coverage:
    npx vitest run --coverage

# Lint source code
lint:
    npx eslint src/

# Lint and auto-fix
lint-fix:
    npx eslint src/ --fix

# Run all checks (lint + test + build)
check: lint test build

# Build and install into a vault (uses OBSIDIAN_VAULT from .env, or pass a path)
install path=vault_path:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{path}}" ]; then
        echo "Error: No vault path specified."
        echo "Set OBSIDIAN_VAULT in .env or pass a path: just install /path/to/vault"
        exit 1
    fi
    ./scripts/install.sh "{{path}}"

# Remove the plugin from a vault and from its community-plugins.json
uninstall path=vault_path:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{path}}" ]; then
        echo "Error: No vault path specified."
        echo "Set OBSIDIAN_VAULT in .env or pass a path: just uninstall /path/to/vault"
        exit 1
    fi
    ./scripts/uninstall.sh "{{path}}"

# Clean build artifacts
clean:
    rm -f main.js
    rm -f SHA256SUMS.txt

# --- Release targets (used by CI and local release workflow) ---

# Bump the version (major, minor or patch) and commit. Pushing the commit to the default
# branch releases it: the Release workflow runs when manifest.json changes.
release level:
    ./scripts/release.sh {{level}}

# Generate SHA-256 checksums for release artifacts
checksum:
    #!/usr/bin/env bash
    set -euo pipefail
    FILES="main.js manifest.json"
    [ -f styles.css ] && FILES="$FILES styles.css"
    if command -v sha256sum >/dev/null; then
        sha256sum $FILES > SHA256SUMS.txt
    else
        shasum -a 256 $FILES > SHA256SUMS.txt
    fi
    echo "Checksums written to SHA256SUMS.txt"
    cat SHA256SUMS.txt
