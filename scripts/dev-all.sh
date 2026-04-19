#!/usr/bin/env bash
# Start the full IntentGuard stack: infra API, indexer, trace-stub,
# mock-x402, demo-control, and the Next.js web app.
#
# Usage:
#   scripts/dev-all.sh            # start everything, tail logs, Ctrl+C to stop all
#   scripts/dev-all.sh stop       # kill everything this script started (or left running)
#   scripts/dev-all.sh status     # show running state + listening ports
#
# Logs land in ./logs/<service>.log; PIDs in ./logs/pids/<service>.pid.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/logs"
PID_DIR="$LOG_DIR/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# name|port|command
# port "-" means no TCP port (e.g. indexer worker)
SERVICES=(
  "infra|8787|npm --prefix services/infra run dev"
  "indexer|-|npm --prefix services/infra run indexer"
  "trace-stub|7403|npm run trace-stub"
  "mock-x402|7404|npm run mock-x402"
  "demo-control|7402|npm run demo"
  "web|3000|npm --workspace web run dev"
)

ALL_PORTS=(8787 7402 7403 7404 3000)

color_ok()   { printf "\033[32m%s\033[0m" "$1"; }
color_warn() { printf "\033[33m%s\033[0m" "$1"; }
color_err()  { printf "\033[31m%s\033[0m" "$1"; }

stop_by_pid() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] || return 0
  local pid
  pid=$(cat "$pidfile" 2>/dev/null || echo "")
  rm -f "$pidfile"
  [[ -z "$pid" ]] && return 0
  if kill -0 "$pid" 2>/dev/null; then
    # kill npm wrapper + all its descendants
    local kids
    kids=$(pgrep -P "$pid" 2>/dev/null || true)
    kill -TERM $kids "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6; do
      kill -0 "$pid" 2>/dev/null || return 0
      sleep 0.5
    done
    kill -KILL $kids "$pid" 2>/dev/null || true
  fi
}

sweep_ports() {
  for port in "${ALL_PORTS[@]}"; do
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    [[ -n "$pids" ]] && kill -TERM $pids 2>/dev/null || true
  done
}

stop_all() {
  echo ">> stopping services"
  for spec in "${SERVICES[@]}"; do
    local name="${spec%%|*}"
    stop_by_pid "$PID_DIR/$name.pid"
  done
  sweep_ports
}

status() {
  printf "\n%-13s %-8s %-8s %s\n" "SERVICE" "PORT" "STATE" "PID"
  printf "%-13s %-8s %-8s %s\n" "-------" "----" "-----" "---"
  for spec in "${SERVICES[@]}"; do
    IFS='|' read -r name port _ <<< "$spec"
    local pidfile="$PID_DIR/$name.pid"
    local pid="" alive="no" listening="-"
    if [[ -f "$pidfile" ]]; then
      pid=$(cat "$pidfile" 2>/dev/null || echo "")
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        alive="yes"
      fi
    fi
    if [[ "$port" != "-" ]]; then
      if lsof -ti tcp:"$port" >/dev/null 2>&1; then
        listening="LISTEN"
      else
        listening="closed"
      fi
    fi
    if [[ "$alive" == "yes" && ( "$listening" == "LISTEN" || "$port" == "-" ) ]]; then
      printf "%-13s %-8s %-8s %s\n" "$name" "$port" "$(color_ok UP)" "$pid"
    elif [[ "$alive" == "yes" ]]; then
      printf "%-13s %-8s %-8s %s\n" "$name" "$port" "$(color_warn BOOT)" "$pid"
    else
      printf "%-13s %-8s %-8s %s\n" "$name" "$port" "$(color_err DOWN)" "-"
    fi
  done
  echo
}

case "${1:-}" in
  stop)
    stop_all
    echo ">> stopped"
    exit 0
    ;;
  status)
    status
    exit 0
    ;;
esac

# Fresh start: clear any stale listeners on our ports
stop_all

echo ">> starting services (logs → $LOG_DIR/)"
for spec in "${SERVICES[@]}"; do
  IFS='|' read -r name port cmd <<< "$spec"
  logfile="$LOG_DIR/$name.log"
  pidfile="$PID_DIR/$name.pid"
  : > "$logfile"
  # run in background; keep it attached to the script so kill -TERM cascades
  bash -c "$cmd" >>"$logfile" 2>&1 &
  echo $! > "$pidfile"
  printf "  %-13s port %-5s pid %s\n" "$name" "$port" "$(cat "$pidfile")"
done

trap 'echo; stop_all; exit 0' INT TERM

sleep 4
status

echo ">> tailing all logs — Ctrl+C stops everything"
echo
exec tail -n 0 -F "$LOG_DIR"/*.log
