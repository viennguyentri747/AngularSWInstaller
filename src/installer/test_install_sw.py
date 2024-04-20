from typing import Optional
from fabric import Connection
from sshtunnel import SSHTunnelForwarder
import traceback
from file_transfer import *
import time
import requests
import argparse
import re as regex


class Installer:
    def __init__(self, ssm_info: RemoteInfo, acu_info: RemoteInfo, remote_installer_path: str) -> None:
        self.acu_info: RemoteInfo = acu_info
        self.ssm_info: RemoteInfo = ssm_info

        self.remote_installer_path: str = remote_installer_path
        self.current_connection: Connection = None
        self.current_tunnel: SSHTunnelForwarder = None

    def run_install(self):
        self.open_tunnel_acu()
        self.try_connect_acu()

        target_partition: str = self.get_partition_number()
        target_rootfs: str = self.get_rootfs(target_partition)
        self.run_command(f"chmod 775 {self.remote_installer_path}")
        self.install_sw(installer_path=self.remote_installer_path,
                        partition_number=target_partition, rootfs=target_rootfs)

        self.close_current_connection()

    def is_install_ok(self, expected_version, time_out=300) -> bool:
        is_ok: bool = False
        print("Trying to connect to acu ...")
        self.open_tunnel_acu()  # Establish SSH tunnel
        can_connect = self.try_connect_acu()  # Try to connect via the tunnel

        print(f"Connected to acu {"success!" if is_ok else "fail!"}")
        if (can_connect):
            output = self.run_command(f"cat /opt/etc/pkg_name/pkg_name.txt")

            self.close_current_connection()
            match = regex.search(r'firmware_version_current=([\d.]+)', output)
            if match:
                version = match.group(1)
                is_ok = version == expected_version
        return is_ok

    def open_tunnel_acu(self):
        self.current_tunnel = SSHTunnelForwarder(
            (ssm_info.ip, 22),  # PRIVATE IP SSM
            ssh_username=ssm_info.username,
            ssh_password=ssm_info.password,
            remote_bind_address=(acu_info.ip, 22)  # PRIVATE IP ACU
        )
        self.current_tunnel.start()

    def try_connect_acu(self, time_out_secs=5) -> bool:
        local_host_ip = '127.0.0.1'
        self.current_connection: Connection = Connection(
            host=local_host_ip,
            port=self.current_tunnel.local_bind_port,
            user=ssm_info.username,
            connect_kwargs={"password": ssm_info.password}
        )

        start_time = time.time()
        while (time.time() - start_time <= time_out_secs):
            try:
                print("Try connecting")
                self.current_connection.open()
                print("Connect success!")
                return True
            except Exception as e:
                print(f"Connect attempt fail {e}")
                time.sleep(0.5)
        return False

    def get_partition_number(self) -> str:
        boot_txt: str = self.run_command("cat /run/media/boot/bootpart.txt").strip()
        # Ex: boot_txt = "bootpart=1:2"
        partition_info = boot_txt.split('=')[1]
        current_partition = partition_info.split(':')[1]
        if (current_partition != '2' and current_partition != '3'):
            raise Exception("ERROR: Current partition number is not 2 or 3")
        target_partition: str = '2' if current_partition == '3' else '3'
        return target_partition

    def get_rootfs(self, partition_number: str) -> Optional[str]:
        partition_device: str = f"mmcblk1p{partition_number}"
        mount_points: str = self.run_command(f"lsblk -no MOUNTPOINT /dev/{partition_device}")
        if (mount_points):
            for mount_point_path in mount_points.split('\n'):
                rootfs: str = os.path.basename(mount_point_path)
                if (rootfs.startswith("rootfs")):
                    return rootfs

        raise Exception(f"Error retrieving rootfs")

    def install_sw(self, installer_path: str, partition_number: str, rootfs: str) -> bool:
        installer_file_name: str = os.path.basename(installer_path)
        is_on_eMMC = True  # Install on eMMC (instead of SD Card)
        is_u_env = False  # False if tested
        install_cmd: str = f"{installer_path} -e {is_on_eMMC} -b {partition_number} -l {rootfs} -u {is_u_env}"
        print(install_cmd, flush=True)
        # self.run_command(f"{installer_path} -h")
        return True

    def reboot_ssm() -> None:
        ssm_reset_url = f"http://{ssm_info.ip}/api/system/aim_reset"
        r = requests.get(ssm_reset_url)
        print(r.status_code)

    def close_current_connection(self) -> None:
        if (self.current_connection):
            self.current_connection.close()
        if (self.current_tunnel):
            self.current_tunnel.close()

    def run_command(self, shell_command: str, is_hide=False) -> str:
        print(f"Running command: {shell_command}", flush=True)
        result = self.current_connection.run(shell_command, hide=is_hide)
        return result.stdout


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(prog='Install software', description='Prompt spibeam to verify readbacks')
        parser.add_argument('-path', '--bin_path', required=True,
                            help='Path to installer. Ex:./ow_core_apps-release-master-0.9.6.1.iesa', type=str, default='127.0.0.1')
        parser.add_argument('-ip', '--ut_ip', required=True,
                            help='UT ip to install. Ex: 192.168.100.64', type=str, default='127.0.0.1')
        parser.add_argument('-pw', '--ut_pw', required=False, help='UT password', type=str, default='use4Tst!')
        parser.add_argument('-acu_ip', '--acu_ip', required=False,
                            help='ACU ip. Ex: 192.168.100.254', type=str, default='192.168.100.254')
        parser.
        args = parser.parse_args()

        local_file_path: str = args.bin_path
        ut_ip: str = args.ut_ip
        ut_pw: str = args.ut_pw
        acu_ip: str = args.acu_ip
        install_file_name: str = os.path.basename(local_file_path)
        remote_file_path: str = f"/vien/install/{install_file_name}"
        ssm_info: RemoteInfo = RemoteInfo(ut_ip, 'root', ut_pw)
        acu_info: RemoteInfo = RemoteInfo(acu_ip, 'root', '')
        installer: Installer = Installer(ssm_info=ssm_info, acu_info=acu_info, remote_installer_path=remote_file_path)
        print(f"Transfering file from {local_file_path} to {remote_file_path}", flush=True)
        is_transferred: bool = transfer_file(local_file_path=local_file_path,
                                             remote_dir_path=remote_file_path, ssm_info=ssm_info, acu_info=acu_info)
        if (is_transferred):
            installer.run_install()
            print("Install success! -> Wait for verifying", flush=True)
            is_install_ok: bool = installer.is_install_ok()
            if (is_install_ok):
                print("Install is ok! -> Done", flush=True)
                exit(0)
            else:
                print("Install is not ok!", flush=True, file=sys.stderr)
        else:
            print("Transfering file failed", flush=True, file=sys.stderr)
    except Exception as e:
        print(f"Unexpected exception {e}, traceback = {traceback.format_exc()}")
    exit(1)
