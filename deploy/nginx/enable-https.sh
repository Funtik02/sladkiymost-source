#!/bin/sh
set -eu

DOMAIN=xn--80aimeddmqtil.xn--p1ai
cd "$(dirname "$0")"

certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --keep-until-expiring
sh apply.sh sladkiymost-http.conf sladkiymost-https.conf sslip-http.conf sslip-https.conf
