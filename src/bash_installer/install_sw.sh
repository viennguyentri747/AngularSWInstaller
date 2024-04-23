#!/bin/bash
# Usage: ./install_sw.sh --bin_path storage/upload/vien_dummy_installer --ut_ip 192.168.100.64 --ut_pw password --acu_ip 192.168.100.254

# Default values
UT_PW="use4Tst!"
ACU_IP="192.168.100.254"
REMOTE_FOLDER_PATH="/vien/install"
CONNECT_TIMEOUT=5

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --bin_path) BINARY_PATH="$2"; shift ;;
        --ut_ip) UT_IP="$2"; shift ;;
        --ut_pw) UT_PW="$2"; shift ;;
        --acu_ip) ACU_IP="$2"; shift ;;
        --reboot_timeout_secs) REBOOT_TIMEOUT="$2"; shift ;;
        --connect_timeout_secs) CONNECT_TIMEOUT="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

JUMP_HOST="root@$UT_IP"
DESTINATION_HOST="root@$ACU_IP"
IGNORE_ARG="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

function remote_exec() {
    echo "Running command $@"
    if ssh -J $JUMP_HOST $IGNORE_ARG -o ConnectTimeout=$CONNECT_TIMEOUT -q "$DESTINATION_HOST" "$@"; then
        echo "Command $@ successfully!"
    else
        echo "Command $@ failed!"
        exit 1
    fi
}

# Validate required arguments
if [[ -z "$BINARY_PATH" || -z "$UT_IP" ]]; then
    echo "Error: --bin_path and --ut_ip are required."
    exit 1
fi

# Transfer (copy) file to remote -> Create folder if not exist then copy to it
REMOTE_INSTALLER_PATH="$REMOTE_FOLDER_PATH/$(basename $BINARY_PATH)"
remote_exec "mkdir -p $REMOTE_FOLDER_PATH"
echo "Transfering file from $BINARY_PATH to $REMOTE_INSTALLER_PATH"
if scp -o ProxyJump="$JUMP_HOST" -o ConnectTimeout=$CONNECT_TIMEOUT $IGNORE_ARG -r "$BINARY_PATH" "$DESTINATION_HOST:$REMOTE_INSTALLER_PATH"; then
    echo "File transferred successfully."
else
    echo "Failed to transfer file."
    exit 1
fi

echo $REMOTE_INSTALLER_PATH
echo $REMOTE_FOLDER_PATH
sleep 5
# export REMOTE_INSTALLER_PATH  # Make it available in all subshells

# TODO function get rootfs + fix get_partition_number
function get_partition_number() {
    # CALL THIS FROM REMOTE
    local boot_txt=$(cat /run/media/boot/bootpart.txt)
    local partition_info=$(echo "$boot_txt" | tr '=' ' ' | awk '{print $2}')
    local partition_number="3"  # Default to 3 unless the condition is met
    if [[ "$partition_info" == "3" ]]; then
        partition_number="2"
    fi
    echo "$partition_number"
}

function get_rootfs() {
    # CALL THIS FROM REMOTE
    local partition_number="$1"
    local mount_points=$(lsblk -no MOUNTPOINT "/dev/mmcblk1p$partition_number")
    local rootfs=$(echo "$mount_points" | head -n 1)
    echo "$rootfs"
}

echo "Getting partition number..."
PARTITION_NUMBER=$(remote_exec "$(declare -f get_partition_number); get_partition_number")
echo "Partition number is $PARTITION_NUMBER"
echo "Getting rootfs for partition $PARTITION_NUMBER..."
ROOTFS=$(remote_exec "$(declare -f get_rootfs); get_rootfs $PARTITION_NUMBER")
echo "RootFS is $ROOTFS"

# Perform installation
function PerformInstall() {
    local remote_installer_path="$1"  # Pass the path as a parameter
    local partition_number="$2"
    local rootfs="$3"
    echo "Starting remote execution..."
    sleep 3
    echo "Setting permissions for installer path..."
    chmod 775 "$remote_installer_path"
    
    # Run + reboot to applies changes
    echo "Executing install command..."
    local install_cmd="$remote_installer_path -e True -b $partition_number -l $rootfs -u False"
    echo "Running: $install_cmd"
    # local result=$($install_cmd)
    # echo "Installation command log: $result"
    # reboot
}

remote_exec "$(declare -f PerformInstall); PerformInstall '$REMOTE_INSTALLER_PATH' '$PARTITION_NUMBER' '$ROOTFS'"