#!/bin/sh
set -eu

TARGET=/opt/mkomplekt/docker/nginx/api-only-ssl.conf
PROXY=mkomplekt-proxy
BEGIN='# >>> sladkiymost (managed by /opt/sladkiymost/deploy/nginx/apply.sh)'
END='# <<< sladkiymost'

cd "$(dirname "$0")"
mkdir -p /opt/sladkiymost/backup
backup="/opt/sladkiymost/backup/api-only-ssl.conf.$(date +%Y%m%d-%H%M%S)"
cp "$TARGET" "$backup"

base=$(awk -v b="$BEGIN" -v e="$END" '$0 == b { skip = 1 } !skip { print } $0 == e { skip = 0 }' "$TARGET")
next=$(mktemp)
{
    printf '%s\n\n%s\n' "$base" "$BEGIN"
    for file in "$@"; do cat "$file"; echo; done
    printf '%s\n' "$END"
} > "$next"

cat "$next" > "$TARGET"
rm -f "$next"

if docker exec "$PROXY" nginx -t; then
    docker exec "$PROXY" nginx -s reload
    echo "nginx перезагружен. Копия прежнего конфига: $backup"
else
    cat "$backup" > "$TARGET"
    echo "Проверка nginx не прошла — конфиг возвращён как был" >&2
    exit 1
fi
