#!/bin/bash

SOURCE_DIR="$HOME/IP-CHANGER/Ip-bot-2.0"
DEST_DIR="$HOME/New OpenCode"
OUTPUT_FILE="$DEST_DIR/proxies.txt"
MAX_PROXIES=20000
CHECKED_HISTORY="$DEST_DIR/.checked_history"
QUEUE_FILE="$DEST_DIR/.queue.txt"
RAW_FILE="$DEST_DIR/.raw.txt"
VALID_FILE="$DEST_DIR/.valid.tmp"
CHECK_GEO="http://ip-api.com/json/?fields=status,query"
CHECK_HTTP="http://httpbin.org/ip"
CONCURRENCY=40

mkdir -p "$DEST_DIR"
touch "$CHECKED_HISTORY" "$OUTPUT_FILE"

# CRITICAL: these MUST be visible inside the xargs child shells
export CHECK_GEO CHECK_HTTP VALID_FILE

# The main loop must NEVER break: ignore all terminal signals
trap '' INT TERM HUP PIPE

echo "Started proxy sync with live validation..."

# ---------------- startup self-test ----------------
DIRECT_OK=0
echo "--- self test ---"
echo "SOURCE_DIR = $SOURCE_DIR"
echo "OUTPUT_FILE = $OUTPUT_FILE"
echo "curl: $(command -v curl 2>/dev/null || echo 'MISSING - install it: sudo apt install curl')"
if command -v curl >/dev/null 2>&1; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 "$CHECK_HTTP" 2>/dev/null) || code="FAILED"
    echo "direct internet test (no proxy): HTTP $code"
    case "$code" in 2*|3*) DIRECT_OK=1 ;; esac
fi
[ "$DIRECT_OK" -eq 0 ] && echo "WARNING: direct internet check failed - proxies can never validate until this works!"
for f in http socks4 socks5; do
    if [ -f "$SOURCE_DIR/$f.txt" ]; then
        echo "  found $f.txt ($(wc -l < "$SOURCE_DIR/$f.txt" 2>/dev/null || echo 0) lines)"
    else
        echo "  WARNING: $SOURCE_DIR/$f.txt NOT FOUND"
    fi
done
echo "-----------------"

FAIL_STREAK=0

# ---------------- main loop (cannot be broken) ----------------
while true; do
    {
        # 1) Merge -> tag scheme -> normalize (\r, scheme://, spaces) -> dedupe
        {
            [ -f "$SOURCE_DIR/http.txt" ]   && sed 's/^/http /'   "$SOURCE_DIR/http.txt"   2>/dev/null || true
            [ -f "$SOURCE_DIR/socks4.txt" ] && sed 's/^/socks4 /' "$SOURCE_DIR/socks4.txt"  2>/dev/null || true
            [ -f "$SOURCE_DIR/socks5.txt" ] && sed 's/^/socks5 /' "$SOURCE_DIR/socks5.txt"  2>/dev/null || true
        } | tr -d '\r' \
          | sed -e 's/[[:space:]]\+/ /g' -e 's/^ //; s/ $//' \
          | sed 's|^\([a-z0-9]*\) [a-zA-Z][a-zA-Z0-9]*://|\1 |' \
          | awk 'NF==2 && $2 ~ /^[A-Za-z0-9._-]+:[0-9]+$/ {print $1" "$2}' \
          | sort -u > "$RAW_FILE" 2>/dev/null || true

        # 2) Skip already-validated proxies
        if [ -s "$CHECKED_HISTORY" ]; then
            sort -u "$CHECKED_HISTORY" 2>/dev/null > "$CHECKED_HISTORY.tmp" || true
            mv "$CHECKED_HISTORY.tmp" "$CHECKED_HISTORY" 2>/dev/null || true
            comm -23 "$RAW_FILE" "$CHECKED_HISTORY" > "$QUEUE_FILE" 2>/dev/null || true
        else
            cp "$RAW_FILE" "$QUEUE_FILE" 2>/dev/null || true
        fi

        TOTAL=$(wc -l < "$RAW_FILE" 2>/dev/null || echo 0)
        QUEUED=$(wc -l < "$QUEUE_FILE" 2>/dev/null || echo 0)
        : > "$VALID_FILE" 2>/dev/null || true

        if [ "$TOTAL" -eq 0 ]; then
            echo "[$(date '+%H:%M:%S')] DEBUG raw samples | http=[$(head -n 3 "$SOURCE_DIR/http.txt" 2>/dev/null | tr '\n' '|')] socks4=[$(head -n 3 "$SOURCE_DIR/socks4.txt" 2>/dev/null | tr '\n' '|')] socks5=[$(head -n 3 "$SOURCE_DIR/socks5.txt" 2>/dev/null | tr '\n' '|')]"
        fi

        # 3) Validate in parallel (self-contained child shell)
        if [ -s "$QUEUE_FILE" ]; then
            xargs -a "$QUEUE_FILE" -P "$CONCURRENCY" -n 2 bash -c '
                scheme="$1"; proxy="$2"; url="" resp="" code=""
                case "$scheme" in
                    http)   url="http://$proxy" ;;
                    socks4) url="socks4://$proxy" ;;
                    socks5) url="socks5h://$proxy" ;;
                    *) exit 0 ;;
                esac
                resp=$(curl -s --connect-timeout 4 --max-time 10 -x "$url" "$CHECK_GEO" 2>/dev/null) || resp=""
                case "$resp" in
                    *"\"status\":\"success\""*)
                        printf "%s %s\n" "$scheme" "$proxy" >> "$VALID_FILE" 2>/dev/null
                        exit 0 ;;
                esac
                code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 4 --max-time 10 \
                            -x "$url" "$CHECK_HTTP" 2>/dev/null) || code="000"
                case "$code" in
                    2*|3*|4*) printf "%s %s\n" "$scheme" "$proxy" >> "$VALID_FILE" 2>/dev/null ;;
                esac
                exit 0
            ' _ 2>/dev/null || true
        fi

        # 4) Transfer validated proxies + remember them
        PASSED=$(wc -l < "$VALID_FILE" 2>/dev/null || echo 0)
        if [ "$PASSED" -gt 0 ]; then
            awk '{print $2}' "$VALID_FILE" 2>/dev/null >> "$OUTPUT_FILE" || true
            cat "$VALID_FILE" >> "$CHECKED_HISTORY" 2>/dev/null || true
            FAIL_STREAK=0
        fi

        # 5) Same 20k cap logic as before
        COUNT=$(wc -l < "$OUTPUT_FILE" 2>/dev/null || echo 0)

        if [ "$COUNT" -ge "$MAX_PROXIES" ]; then
            echo "[$(date '+%H:%M:%S')] $COUNT proxies reached. Clearing proxies.txt..."
            > "$OUTPUT_FILE"
            > "$CHECKED_HISTORY"
        else
            echo "[$(date '+%H:%M:%S')] Updated proxies.txt ($COUNT proxies) | total=$TOTAL queued=$QUEUED passed=$PASSED"
        fi

        # 6) If proxies keep failing, test ONE sample in the foreground and
        #    print the actual curl error code (7=refused, 28=timeout, 5=proxy
        #    error, 6=DNS, 35=SSL) so we know WHY they fail.
        if [ "$QUEUED" -gt 0 ] && [ "$PASSED" -eq 0 ]; then
            FAIL_STREAK=$((FAIL_STREAK + 1))
            if [ "$FAIL_STREAK" -ge 3 ]; then
                FAIL_STREAK=0
                line=$(head -n 1 "$QUEUE_FILE" 2>/dev/null || true)
                scheme=${line%% *}; proxy=${line##* }
                if [ -n "$proxy" ]; then
                    case "$scheme" in
                        http)   url="http://$proxy" ;;
                        socks4) url="socks4://$proxy" ;;
                        *)      url="socks5h://$proxy" ;;
                    esac
                    out=$(curl -s -o /dev/null --connect-timeout 5 --max-time 12 -x "$url" -w "HTTP:%{http_code}" "$CHECK_HTTP" 2>&1) || true
                    ec=$?
                    echo "[$(date '+%H:%M:%S')] DIAG proxy=$proxy ($scheme) curl_exit=$ec result=$out"
                fi
            fi
        fi
    } || true

    sleep 5 || true
done
