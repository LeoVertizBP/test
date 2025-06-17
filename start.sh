#!/usr/bin/env bash
set -e

# Ensure INSTANCE_CONNECTION_NAME is available
if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: INSTANCE_CONNECTION_NAME environment variable is not set."
  exit 1
fi

# Ensure PGHOST is available for the socket path check and proxy usage
if [ -z "$PGHOST" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: PGHOST environment variable is not set (should be /cloudsql/INSTANCE_CONNECTION_NAME)."
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting Cloud SQL Proxy for instance: $INSTANCE_CONNECTION_NAME"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Target socket directory (PGHOST): $PGHOST"

# Ensure the specific socket directory itself exists (it's a subdirectory under /cloudsql)
# The parent /cloudsql directory is created and chowned in Dockerfile.
# The proxy needs $PGHOST to exist to place its .s.PGSQL.5432 file inside it.
echo "$(date '+%Y-%m-%d %H:%M:%S') - Ensuring specific socket directory $PGHOST exists..."
# Proxy v2 creates subdirectories automatically, so this might not be needed
# mkdir -p "$PGHOST"
# The ownership of $PGHOST will be inherited from /cloudsql (nodeuser) or created by nodeuser.

# 1. Launch proxy in the background and capture its PID
# Direct proxy output (stdout/stderr) to files for potential later inspection if needed
PROXY_LOG_DIR="/tmp/cloudsqlproxy" # /tmp is generally writable by any user
mkdir -p "$PROXY_LOG_DIR"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Launching Cloud SQL Proxy in background. Logs will be in $PROXY_LOG_DIR"
# Use modern v2 syntax: instance-connection-name followed by --unix-socket flag
# The proxy v2 will automatically create the subdirectory structure under /cloudsql
# The proxy will create .s.PGSQL.5432 inside the instance-specific directory under /cloudsql.
/usr/local/bin/cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" \
  --unix-socket="/cloudsql" \
  --structured-logs \
  --debug-logs \
  --private-ip \
  > "$PROXY_LOG_DIR/proxy.log" 2> "$PROXY_LOG_DIR/proxy.err" &
PROXY_PID=$!

# 2. Robust wait for the socket file to be created
# The actual socket file will be $PGHOST/.s.PGSQL.5432
SOCKET_FILE_PATH="$PGHOST/.s.PGSQL.5432"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for proxy (PID: $PROXY_PID) to create socket file: $SOCKET_FILE_PATH"
for i in {1..15}; do
  if [ -S "$SOCKET_FILE_PATH" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ✓ Socket file $SOCKET_FILE_PATH created successfully after $i attempt(s)."
    break
  fi
  # Check if proxy process is still running
  if ! ps -p $PROXY_PID > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: Cloud SQL Proxy process (PID: $PROXY_PID) exited prematurely."
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy stdout log ($PROXY_LOG_DIR/proxy.log):"
    cat "$PROXY_LOG_DIR/proxy.log" || echo "Could not cat proxy.log"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy stderr log ($PROXY_LOG_DIR/proxy.err):"
    cat "$PROXY_LOG_DIR/proxy.err" || echo "Could not cat proxy.err"
    exit 1
  fi
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for socket... attempt $i of 15. Proxy (PID: $PROXY_PID) is running."
  sleep 1
  if [ $i -eq 15 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: Timeout waiting for socket file $SOCKET_FILE_PATH to be created."
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy (PID: $PROXY_PID) is still running but socket not found."
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy stdout log ($PROXY_LOG_DIR/proxy.log):"
    cat "$PROXY_LOG_DIR/proxy.log" || echo "Could not cat proxy.log"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy stderr log ($PROXY_LOG_DIR/proxy.err):"
    cat "$PROXY_LOG_DIR/proxy.err" || echo "Could not cat proxy.err"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Current directory content of $PGHOST:"
    ls -la "$PGHOST" || echo "$(date '+%Y-%m-%d %H:%M:%S') - Socket directory $PGHOST not found or ls failed."
    kill $PROXY_PID # Attempt to clean up the proxy if it's still running
    exit 1 # Exit if socket not created after timeout
  fi
done

# 3. Log socket directory contents (for verification)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Verifying socket directory contents ($PGHOST):"
ls -la "$PGHOST"

# --- BEGIN ADDITION (tail proxy logs) ---
echo "$(date '+%Y-%m-%d %H:%M:%S') - Displaying current Cloud SQL Proxy logs (last 20 lines):"
echo "--- Proxy STDOUT ($PROXY_LOG_DIR/proxy.log) ---"
tail -n 20 "$PROXY_LOG_DIR/proxy.log" 2>/dev/null || echo "No stdout log or tail failed."
echo "--- End of Proxy STDOUT ---"
echo "--- Proxy STDERR ($PROXY_LOG_DIR/proxy.err) ---"
tail -n 20 "$PROXY_LOG_DIR/proxy.err" 2>/dev/null || echo "No stderr log or tail failed."
echo "--- End of Proxy STDERR ---"
# --- END ADDITION (tail proxy logs) ---

# 4. Start Node as normal, keep proxy running
# Use `exec` to replace the shell process with the Node process
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting Node application: node dist/server.js"

# Setup trap to clean up proxy when the script exits (e.g. if node app exits)
# This will execute when the script receives SIGINT, SIGTERM, or on EXIT.
cleanup() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Script exiting. Cleaning up Cloud SQL Proxy (PID: $PROXY_PID)..."
    
    # --- BEGIN ADDITION (cat proxy logs) ---
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Attempting to output full Cloud SQL Proxy logs:"
    echo "--- Full Proxy STDOUT ($PROXY_LOG_DIR/proxy.log) ---"
    cat "$PROXY_LOG_DIR/proxy.log" 2>/dev/null || echo "Failed to cat $PROXY_LOG_DIR/proxy.log"
    echo "--- End of Full Proxy STDOUT ---"
    echo "--- Full Proxy STDERR ($PROXY_LOG_DIR/proxy.err) ---"
    cat "$PROXY_LOG_DIR/proxy.err" 2>/dev/null || echo "Failed to cat $PROXY_LOG_DIR/proxy.err"
    echo "--- End of Full Proxy STDERR ---"
    # --- END ADDITION (cat proxy logs) ---

    # Check if proxy is still running before trying to kill
    if ps -p $PROXY_PID > /dev/null; then
        kill $PROXY_PID
        # Wait for a short period for the proxy to terminate
        for _ in {1..5}; do
            if ! ps -p $PROXY_PID > /dev/null; then
                break
            fi
            sleep 0.2
        done
        if ps -p $PROXY_PID > /dev/null; then
             echo "$(date '+%Y-%m-%d %H:%M:%S') - Proxy (PID: $PROXY_PID) did not terminate gracefully, sending SIGKILL."
             kill -9 $PROXY_PID
        else
            echo "$(date '+%Y-%m-%d %H:%M:%S') - Cloud SQL Proxy (PID: $PROXY_PID) shut down."
        fi
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Cloud SQL Proxy (PID: $PROXY_PID) already exited."
    fi
}
trap cleanup SIGINT SIGTERM EXIT

exec node dist/server.js
