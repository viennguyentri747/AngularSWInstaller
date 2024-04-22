import os
from ssh_helper import SSHHelper, RemoteInfo
from file_transferer import FileTransferer
import traceback
import argparse


class Installer:
    def __init__(self, ssh_manager: SSHHelper, remote_installer_path: str):
        self.ssh_manager = ssh_manager
        self.remote_installer_path = remote_installer_path

    def run_install(self):
        self.ssh_manager.connect_acu()
        target_partition = self.get_partition_number()
        target_rootfs = self.get_rootfs(target_partition)
        self.ssh_manager.exec_command_acu(f"chmod 775 {self.remote_installer_path}")
        self.install_sw(partition_number=target_partition, rootfs=target_rootfs)
        self.ssh_manager.close_connections()

    def get_partition_number(self):
        boot_txt = self.ssh_manager.exec_command_acu("cat /run/media/boot/bootpart.txt").strip()
        partition_info = boot_txt.split('=')[1]
        return '2' if partition_info == '3' else '3'

    def get_rootfs(self, partition_number):
        mount_points = self.ssh_manager.exec_command_acu(
            f"lsblk -no MOUNTPOINT /dev/mmcblk1p{partition_number}")
        return mount_points.split('\n')[0]

    def install_sw(self, partition_number, rootfs):
        install_cmd = f"{self.remote_installer_path} -e True -b {partition_number} -l {rootfs} -u False"
        print(f"Executing install cmd: {install_cmd}", flush= True)
        result = self.ssh_manager.exec_command_acu(install_cmd)
        print(result, flush=True)


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
        args = parser.parse_args()
        local_file_path: str = args.bin_path
        ut_ip: str = args.ut_ip
        ut_pw: str = args.ut_pw
        acu_ip: str = args.acu_ip

        install_file_name: str = os.path.basename(local_file_path)
        remote_file_path: str = f"/vien/install/{install_file_name}"
        ssm_info: RemoteInfo = RemoteInfo(ut_ip, 'root', ut_pw)
        acu_info: RemoteInfo = RemoteInfo(acu_ip, 'root', '')
        ssh_manager = SSHHelper(ssm_info, acu_info)

        file_transferer: FileTransferer = FileTransferer(ssh_helper=ssh_manager)
        is_transfer_success: bool = file_transferer.transfer(
            local_file_path=local_file_path, remote_file_path=remote_file_path, connect_timeout_secs=10)
        if (is_transfer_success):
            installer = Installer(ssh_manager, remote_installer_path=remote_file_path)
            installer.run_install()
            print("Install success!", flush=True)
            # TODO: VERIFYING
            # # is_install_ok: bool = installer.is_install_ok()
            # if (is_install_ok):
            #     print("Install is ok! -> Done", flush=True)
            exit(0)
            # else:
            #     print("Install is not ok!", flush=True)
        else:
            print("Transfering file failed", flush=True)
    except Exception as e:
        print(f"Unexpected exception {e}. {traceback.format_exc()}", flush= True)

    exit(1)
