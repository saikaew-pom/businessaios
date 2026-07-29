#!/bin/bash
# Generate index.html with correct hashed asset paths for SPA deployment
set -e

DIST=$1
if [ -z "$DIST" ]; then
  echo "Usage: $0 <dist-dir>"
  exit 1
fi

ENTRY_DIR="$DIST/_app/immutable/entry"
START_FILE=$(ls "$ENTRY_DIR"/start.*.js 2>/dev/null | head -1)
APP_FILE=$(ls "$ENTRY_DIR"/app.*.js 2>/dev/null | head -1)

if [ -z "$START_FILE" ] || [ -z "$APP_FILE" ]; then
  echo "Error: Could not find start.*.js or app.*.js in $ENTRY_DIR"
  exit 1
fi

START_NAME=$(basename "$START_FILE")
APP_NAME=$(basename "$APP_FILE")

cat > "$DIST/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BusinessAiOs — Operating System for AI Business</title>
  <link rel="icon" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <meta name="theme-color" content="#3b82f6">
  <link rel="modulepreload" href="/_app/immutable/entry/${START_NAME}">
  <link rel="modulepreload" href="/_app/immutable/entry/${APP_NAME}">
</head>
<body style="margin: 0; font-family: Inter, sans-serif;">
  <div id="svelte-root" style="display: contents;"></div>
  <script type="module" data-sveltekit-fetched src="/_app/immutable/entry/${START_NAME}"></script>
</body>
</html>
EOF

cp "$DIST/index.html" "$DIST/404.html"

echo "✓ Generated index.html with $START_NAME"
