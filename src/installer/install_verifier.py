from ssh_helper import SSHHelper
from binary_installer import InstallInfo, get_partition_number, get_rootfs
import re as regex


def is_install_ok(ssh_helper: SSHHelper, installed_info: InstallInfo) -> bool:
    current_partition_number: str = get_partition_number(ssh_helper)
    current_rootfs: str = get_rootfs(ssh_helper, current_partition_number)
    current_version: str = _get_current_version(ssh_helper)

    return (current_partition_number == installed_info.installed_partition and
            current_rootfs == installed_info.installed_rootfs, current_version == installed_info.installed_version)


def _get_current_version(ssh_helper: SSHHelper) -> str:
    pkg_str: str = ssh_helper.exec_command_acu("cat /opt/etc/pkg_name/pkg_name.txt")
    #Sample
    # master-de734428. Generated on Thu Apr  4 14:14:34 EDT 2024
    # firmware_version_current=0.9.6.1
    #Output: 0.9.6.1
    version_match = regex.search(r'firmware_version_current=(\d+\.\d+\.\d+\.\d+)', pkg_str)
    if version_match:
        current_version = version_match.group(1)
        return current_version
    else:
        raise Exception(f"Failed to extract current version from pkg_str, pkg_str = {pkg_str}")
