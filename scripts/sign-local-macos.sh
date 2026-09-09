#!/usr/bin/env bash
#
# Re-sign a locally built macOS bundle with the self-signed "Cloud of Worship
# Local Dev" identity.
#
# Why: `tauri build --no-sign` leaves the app ad-hoc signed, so its code identity
# is just a cdhash that changes on every build. macOS TCC keys privacy grants on
# code identity, so Screen Recording (needed by NDI capture) has to be granted
# again after every build, and in practice does not stick at all. Signing with a
# stable certificate gives the bundle a fixed designated requirement:
#
#   identifier "com.cloudofworship.app" and certificate root = H"c923...."
#
# which does not change between builds, so one grant holds.
#
# This is for LOCAL TESTING ONLY. The certificate is self-signed and trusted only
# on this machine; it is not a substitute for a real Developer ID signature and
# notarization for anything you ship.
#
# Usage:  ./scripts/sign-local-macos.sh [path/to/Some.app]
#
# If the identity is missing (new machine, or the login keychain was reset), see
# docs at the bottom of this file to recreate it.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IDENTITY="Cloud of Worship Local Dev"
BUNDLE_ID="com.cloudofworship.app"
ENTITLEMENTS="$REPO_ROOT/src-tauri/entitlements.plist"
APP="${1:-$REPO_ROOT/src-tauri/target/release/bundle/macos/Cloud of Worship.app}"

if [[ ! -d "$APP" ]]; then
  echo "error: no app bundle at $APP" >&2
  echo "build one first:  npm run tauri:build -- --no-sign --bundles app" >&2
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -q "$IDENTITY"; then
  echo "error: code signing identity '$IDENTITY' not found in the login keychain." >&2
  echo "recreate it with the steps in the comment at the bottom of this script." >&2
  exit 1
fi

echo "Signing $APP"
codesign --force \
  --sign "$IDENTITY" \
  --identifier "$BUNDLE_ID" \
  --entitlements "$ENTITLEMENTS" \
  --timestamp=none \
  "$APP"

codesign --verify --deep --strict --verbose=2 "$APP"
echo
codesign -d -r- "$APP" 2>&1 | grep '^designated'

# ---------------------------------------------------------------------------
# Recreating the identity from scratch:
#
#   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
#     -days 3650 -nodes -subj "/CN=Cloud of Worship Local Dev/O=CoW Labs/C=NG" \
#     -addext "basicConstraints=critical,CA:false" \
#     -addext "keyUsage=critical,digitalSignature" \
#     -addext "extendedKeyUsage=critical,codeSigning"
#
#   # -legacy and a non-empty passphrase are both required: macOS `security`
#   # cannot read OpenSSL 3's default AES/SHA-256 PKCS#12 output, and rejects
#   # empty-password bundles during MAC verification.
#   openssl pkcs12 -export -legacy -inkey key.pem -in cert.pem -out cert.p12 \
#     -passout pass:cowlocal -name "Cloud of Worship Local Dev"
#
#   security import cert.p12 -k ~/Library/Keychains/login.keychain-db \
#     -P cowlocal -T /usr/bin/codesign -A
#
#   # Without this the cert exists but is not a *valid* codesigning identity.
#   security add-trusted-cert -r trustRoot -p codeSign \
#     -k ~/Library/Keychains/login.keychain-db cert.pem
#
# To remove it later:
#   security delete-certificate -c "Cloud of Worship Local Dev" \
#     ~/Library/Keychains/login.keychain-db
# ---------------------------------------------------------------------------
