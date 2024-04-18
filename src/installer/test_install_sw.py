from typing import Optional
from fabric import Connection
from sshtunnel import SSHTunnelForwarder
import traceback
from file_transfer import *
import time
import requests


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
        print("Install complete!")

    def open_tunnel_acu(self):
        self.current_tunnel = SSHTunnelForwarder(
            (ssm_info.ip, 22),  # PRIVATE IP SSM
            ssh_username=ssm_info.username,
            ssh_password=ssm_info.password,
            remote_bind_address=(acu_info.ip, 22)  # PRIVATE IP ACU
        )
        self.current_tunnel.start()

    def try_connect_acu(self, time_out_secs=500) -> bool:
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
                break
            except Exception as e:
                print(f"Connect attempt fail {e}")
                time.sleep(0.5)

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
        try:
            partition_device: str = f"mmcblk1p{partition_number}"
            mount_points: str = self.run_command(f"lsblk -no MOUNTPOINT /dev/{partition_device}")
            if (mount_points):
                for mount_point_path in mount_points.split('\n'):
                    rootfs: str = os.path.basename(mount_point_path)
                    if (rootfs.startswith("rootfs")):
                        return rootfs
        except Exception as e:
            print(f"Error retrieving mount point: {str(e)}")
            return None

        return None

    def install_sw(self, installer_path: str, partition_number: str, rootfs: str):
        installer_file_name: str = os.path.basename(installer_path)
        is_on_eMMC = True  # Install on eMMC (instead of SD Card)
        is_u_env = False  # False if tested
        install_cmd: str = f"{installer_path} -e {is_on_eMMC} -b {partition_number} -l {rootfs} -u {is_u_env}"
        print(install_cmd)
        # self.run_command(f"{installer_path} -h")
        pass

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
        print(f"Running command: {shell_command}")
        result = self.current_connection.run(shell_command, hide=is_hide)
        return result.stdout


if __name__ == "__main__":
    local_file_path: str = "ow_core_apps-release-master-0.9.6.1.iesa"
    install_file_name: str = os.path.basename(local_file_path)
    remote_file_path: str = f"/vien/install/{install_file_name}"
    ssm_info: RemoteInfo = RemoteInfo('172.16.20.136', 'root', 'use4Tst!')
    acu_info: RemoteInfo = RemoteInfo('192.168.100.254', 'root', 'your_password')
    installer: Installer = Installer(ssm_info=ssm_info, acu_info=acu_info, remote_installer_path=remote_file_path)
    try:
        # installer.open_tunnel_acu()
        transfer_file(local_file_path=local_file_path, remote_dir_path=remote_file_path,
                      ssm_info=ssm_info, acu_info=acu_info)
        installer.run_install()
    except Exception as e:
        traceback_str = traceback.format_exc()
        print(f"Unexpected exception {e}, traceback = {traceback_str}")
