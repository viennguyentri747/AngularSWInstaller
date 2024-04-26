import os
from custom_log import LOG
from ssh_helper import SSHHelper, RemoteInfo
from binary_transferer import transfer
from binary_installer import InstallInfo, install
from install_verifier import is_install_ok
import traceback
import argparse
import time


def format_time(seconds: int) -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    seconds = seconds % 60

    # Build a list of time components that are non-zero
    time_components = []
    if hours:
        time_components.append(f"{hours} hour{'s' if hours > 1 else ''}")
    if minutes:
        time_components.append(f"{minutes} minute{'s' if minutes > 1 else ''}")
    if seconds or not time_components:
        time_components.append(f"{seconds} second{'s' if seconds > 1 else ''}")

    # Join all components with commas
    return ', '.join(time_components)


if __name__ == "__main__":
    start_time: int = time.time()
    try:
        parser = argparse.ArgumentParser(prog='Install software', description='Prompt spibeam to verify readbacks')
        parser.add_argument('-path', '--bin_path', required=True,
                            help='Path to installer. Ex:./ow_core_apps-release-master-0.9.6.1.iesa', type=str, default='127.0.0.1')
        parser.add_argument('-ip', '--ut_ip', required=True,
                            help='UT ip to install. Ex: 192.168.100.64', type=str, default='127.0.0.1')
        parser.add_argument('-version', '--target_version', required=True,
                            help='Target binary version. Ex: 0.9.8.4', type=str, default='0.9.8.4')
        parser.add_argument('-pw', '--ut_pw', required=False, help='UT password', type=str, default='use4Tst!')
        parser.add_argument('-acu_ip', '--acu_ip', required=False,
                            help='ACU ip. Ex: 192.168.100.254', type=str, default='192.168.100.254')
        parser.add_argument('-secs_timeout_per_connect', "--secs_timeout_per_connect", required=False,
                            help='Connect timeout in secs for connect to acu, transfer file ... Ex: 3', type=int, default=3)
        parser.add_argument('-secs_total_connect_timeout', "--secs_total_connect_timeout", required=False,
                            help='Connect timeout in secs for connect to acu, transfer file ... Ex: 10', type=int, default=10)
        parser.add_argument('-reboot_timeout', "--reboot_timeout_secs", required=False,
                            help='Reboot time out in secs for verify. Ex: 600', type=int, default=600)
        args = parser.parse_args()
        local_file_path: str = args.bin_path
        ut_ip: str = args.ut_ip
        ut_pw: str = args.ut_pw
        acu_ip: str = args.acu_ip
        target_version: str = args.target_version
        total_secs_connect_timeout: str = args.secs_total_connect_timeout
        secs_timeout_per_connect: str = args.secs_timeout_per_connect
        rebooot_timeout_secs: int = args.reboot_timeout_secs

        install_file_name: str = os.path.basename(local_file_path)
        remote_file_path: str = f"/vien/install/{install_file_name}"
        ssm_info: RemoteInfo = RemoteInfo(ut_ip, 'root', ut_pw)
        acu_info: RemoteInfo = RemoteInfo(acu_ip, 'root', '')
        ssh_helper: SSHHelper = SSHHelper(ssm_info, acu_info)
        ssh_helper.connect_acu(secs_timeout_per_connect=secs_timeout_per_connect,
                               secs_total_connect_timeout=total_secs_connect_timeout)

        if transfer(ssh_helper, local_file_path=local_file_path, remote_file_path=remote_file_path, connect_timeout_secs=total_secs_connect_timeout):
            installed_info: InstallInfo = install(
                ssh_helper, remote_installer_path=remote_file_path, target_version=target_version)
            ssh_helper.close_connections()

            LOG("Install done -> Verifying ...", flush=True)
            ssh_helper.connect_acu(secs_timeout_per_connect=secs_timeout_per_connect,
                                   secs_total_connect_timeout=total_secs_connect_timeout)
            is_ok: bool = is_install_ok(ssh_helper, installed_info=installed_info)
            total_install_time: int = time.time() - start_time
            install_result: str = "successful" if is_ok else "failed"
            LOG(f"The installation to target was {install_result}. Total time taken: {format_time(total_install_time)}. Install Target: {str(installed_info)}")
            if (is_ok):
                exit(0)
        else:
            LOG("Transferring file failed", flush=True)
    except Exception as e:
        LOG(f"Unexpected exception: {e}. {traceback.format_exc()}", flush=True)

    exit(1)
