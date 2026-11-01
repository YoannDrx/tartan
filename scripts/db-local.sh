#!/usr/bin/env bash
# Postgres local jetable (hors Docker) : données dans .local/pg, port 54329.
set -euo pipefail
export LC_ALL=en_US.UTF-8 # sinon postgres refuse de démarrer sur macOS
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.local/pg"
PORT=54329
case "${1:-start}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$ROOT/.local"
      initdb -D "$DATA" -U tartan --auth=trust --encoding=UTF8 --locale=C >/dev/null
    fi
    if ! pg_ctl -D "$DATA" status >/dev/null 2>&1; then
      pg_ctl -D "$DATA" -o "-p $PORT -k /tmp" -l "$ROOT/.local/pg.log" -w start >/dev/null
    fi
    for db in tartan tartan_test tartan_e2e; do
      psql -h localhost -p "$PORT" -U tartan -d postgres -tc "select 1 from pg_database where datname='$db'" | grep -q 1 \
        || createdb -h localhost -p "$PORT" -U tartan "$db"
    done
    echo "Postgres prêt : postgresql://tartan@localhost:$PORT/tartan"
    ;;
  stop)
    pg_ctl -D "$DATA" -w stop >/dev/null || true
    ;;
  reset)
    pg_ctl -D "$DATA" -w stop >/dev/null 2>&1 || true
    rm -rf "$DATA"
    exec "$0" start
    ;;
  *)
    echo "usage: db-local.sh start|stop|reset" >&2
    exit 1
    ;;
esac
