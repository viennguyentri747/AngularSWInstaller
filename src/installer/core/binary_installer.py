from core.custom_logger import LOG
from core.ssh_helper import SSHHelper
import time


class InstallInfo:
    def __init__(self, installed_rootfs: str, installed_partition: str, installed_version: str) -> None:
        self.installed_rootfs: str = installed_rootfs
        self.installed_partition: str = installed_partition
        self.installed_version: str = installed_version

    def __str__(self) -> str:
        return f"Rootfs: {self.installed_rootfs}, Partition: {self.installed_partition}, Version: {self.installed_version}"


def install(ssh_helper: SSHHelper, target_version: str, remote_installer_path: str) -> InstallInfo:
    target_install_info: InstallInfo = _get_target_install_info(ssh_helper, target_version=target_version)
    _set_installer_permissions(ssh_helper, remote_installer_path)
    _install_sw(ssh_helper, remote_installer_path, target_install_info)
    return target_install_info


def _get_target_install_info(ssh_helper: SSHHelper, target_version: str) -> InstallInfo:
    target_partition: str = _get_target_partition_number(ssh_helper)
    target_rootfs: str = get_rootfs(ssh_helper, target_partition)

    return InstallInfo(installed_rootfs=target_rootfs, installed_partition=target_partition,
                       installed_version=target_version)


def _set_installer_permissions(ssh_helper: SSHHelper, remote_installer_path) -> None:
    ssh_helper.exec_command_acu(f"chmod 775 {remote_installer_path}")


def _get_target_partition_number(ssh_helper: SSHHelper) -> str:
    partition_number = get_partition_number(ssh_helper=ssh_helper)
    if partition_number == '2':
        return '3'
    elif partition_number == '3':
        return '2'
    else:
        raise Exception(
            f"Can't get appropriate partion number, partition number = {partition_number}")


def get_partition_number(ssh_helper: SSHHelper) -> str:
    boot_txt: str = ssh_helper.exec_command_acu("cat /run/media/boot/bootpart.txt").strip()
    LOG(f"boot_txt{boot_txt}", flush=True)
    partition_info: str = boot_txt.split('=')[1]  # "bootpart=1:2" will output "1:2"
    partition_number = partition_info.split(':')[1]  # "1:2" will output "2"
    return partition_number


def get_rootfs(ssh_helper: SSHHelper, partition_number: str) -> str:
    fs_details: str = ssh_helper.exec_command_acu(
        f"lsblk -f -no LABEL /dev/mmcblk1p{partition_number}")
    rootfs: str = fs_details.strip()
    if rootfs in ("rootfs_a", "rootfs_b", "rootfs_sd_a", "rootfs_sd_b"):
        return rootfs

    raise Exception(f"Unexpected rootfs: {rootfs}, partition number = {partition_number}")


def _install_sw(ssh_helper: SSHHelper, remote_installer_path: str, install_info: InstallInfo) -> None:
    is_install_on_emmc: bool = True
    is_sw_not_tested: bool = False
    # Sample: /vien/install/ow_core_apps-release-master-0.9.8.4.iesa -e <true/false> -b <1-4> -l <rootfs_a/rootfs_b> -u <true/false> -h
    install_cmd: str = f"{remote_installer_path} -e {str(is_install_on_emmc).lower()} -b {install_info.installed_partition} -l {install_info.installed_rootfs} -u {str(is_sw_not_tested).lower()}"
    LOG(f"Executing install cmd: {install_cmd} ....", flush=True)
    time.sleep(10)
    result = ssh_helper.exec_command_acu(install_cmd, is_stream_output=True)
    LOG(result, flush=True)
    ssh_helper.exec_command_acu(f"reboot")
