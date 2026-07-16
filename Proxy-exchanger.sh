#!/bin/bash

SOURCE_DIR="$HOME/IP-CHANGER/Ip-bot-2.0"
DEST_DIR="$HOME/New OpenCode"
OUTPUT_FILE="$DEST_DIR/proxies.txt"
MAX_PROXIES=20000

mkdir -p "$DEST_DIR"

echo "Started proxy sync..."

while true; do
    {
        [ -f "$SOURCE_DIR/http.txt" ] && cat "$SOURCE_DIR/http.txt"
        [ -f "$SOURCE_DIR/socks4.txt" ] && cat "$SOURCE_DIR/socks4.txt"
        [ -f "$SOURCE_DIR/socks5.txt" ] && cat "$SOURCE_DIR/socks5.txt"
    } | sed '/^\s*$/d' | sort -u > "$OUTPUT_FILE"

    COUNT=$(wc -l < "$OUTPUT_FILE")

    if [ "$COUNT" -ge "$MAX_PROXIES" ]; then
        echo "[$(date '+%H:%M:%S')] $COUNT proxies reached. Clearing proxies.txt..."
        > "$OUTPUT_FILE"
    else
        echo "[$(date '+%H:%M:%S')] Updated proxies.txt ($COUNT proxies)"
    fi

    sleep 5
done
