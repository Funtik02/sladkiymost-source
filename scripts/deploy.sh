#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-root@147.45.158.67}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/sladkiymost_deploy}"
DIR=/opt/sladkiymost
SSH=(ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST")

cd "$(dirname "$0")/.."

echo "Отправляю код на $HOST:$DIR …"
tar czf - \
    --exclude=node_modules --exclude=dist --exclude=.claude --exclude='*.log' \
    --exclude=.env --exclude='server/.env' \
    --exclude='server/data/users.json' --exclude='server/data/sessions.json' --exclude='server/data/carts.json' \
    . | "${SSH[@]}" "mkdir -p $DIR && tar xzf - -C $DIR"

if ! "${SSH[@]}" "test -f $DIR/.env"; then
    echo "Первая выкладка: копирую server/.env в $DIR/.env"
    "${SSH[@]}" "umask 077 && cat > $DIR/.env" < server/.env
fi

echo "Собираю и запускаю контейнер…"
"${SSH[@]}" "cd $DIR && docker compose -f deploy/docker-compose.yml up -d --build && docker image prune -f --filter label=com.docker.compose.project=sladkiymost > /dev/null"
"${SSH[@]}" "docker ps --filter name=sladkiymost-app --format '{{.Names}}: {{.Status}}'"
