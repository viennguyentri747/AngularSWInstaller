from ssh_helper import SSHHelper
import traceback


class FileTransferer:
    def __init__(self, ssh_helper: SSHHelper) -> None:
        self.ssh_helper = ssh_helper

    def transfer(self, local_file_path: str, remote_file_path: str, connect_timeout_secs: int) -> bool:
        try:
            self.ssh_helper.connect_acu(timeout_secs=connect_timeout_secs)
            self.ssh_helper.transfer_file(local_file_path, remote_file_path,
                                          update_progress=lambda _, size, sent: print(
                                              f"\rTransferring: {float(sent) / float(size) * 100:.2f}% complete", flush=True))
            is_valid = self.ssh_helper.verify_file(local_file_path, remote_file_path)
            print(f"Transfer {'successful' if is_valid else 'failed'} for {local_file_path}")
            return is_valid
        except Exception as e:
            print(f"Error during file transfer: {e}. {traceback.format_exc()}")
            return False
