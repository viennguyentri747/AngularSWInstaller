UT_PW="use4Tst!"
ACU_IP="192.168.100.254"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --ut_ip) UT_IP="$2"; shift ;;
        --reboot_timeout_secs) REBOOT_TIMEOUT="$2"; shift ;;
        --version) EXPECTED_VERSION="$2";     shift;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

timeout=30
connected=false
start_time=$(date +%s)
function remote_exec() {
    ssh -J $JUMP_HOST $IGNORE_ARG -q "$DESTINATION_HOST" "$@"
}

while [[ $(($(date +%s) - start_time)) -lt $timeout ]]; do
    if remote_exec "echo 'Connection test'"; then
        connected=true
        break
    fi
    else
        echo "Trying to connect, elapsed time: $(($(date +%s) - start_time)) seconds"
    fi

    sleep 1
done

if $connected; then
        
    exit 0


exit 1
