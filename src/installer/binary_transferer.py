import hashlib
from custom_log import LOG
from ssh_helper import SSHHelper
import os


def transfer(ssh_helper: SSHHelper, local_file_path: str, remote_file_path: str, connect_timeout_secs: int = 10) -> bool:
    remote_folder_path: str = os.path.dirname(remote_file_path)
    # Create folder if doesn't exists
    ssh_helper.exec_command_acu(f"mkdir -p {remote_folder_path}")
    ssh_helper.transfer_file(local_file_path, remote_file_path,
                             update_progress=_update_transfer_progress, connect_timeout_secs=connect_timeout_secs)
    is_transferred_file_ok: bool = _is_same_file(
        ssh_helper, local_file_path=local_file_path, remote_file_path=remote_file_path)
    LOG(f"Transfer {'successful' if is_transferred_file_ok else 'failed'} for {local_file_path}")
    return is_transferred_file_ok


def _update_transfer_progress(_, total_size: int, sent: int) -> None:
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    while total_size >= 1024 and unit_index < len(units) - 1:
        total_size /= 1024
        sent /= 1024
        unit_index += 1

    # Calculate the percentage of the file transferred
    percent_transferred = (float(sent) / float(total_size)) * 100 if total_size > 0 else 0
    LOG(
        f"\rTransferring: {percent_transferred:.2f}% ({sent:.2f}/{total_size:.2f} {units[unit_index]})", flush=True)


def _is_same_file(ssh_helper: SSHHelper, local_file_path: str, remote_file_path: str) -> bool:
    local_sha256: str = _compute_sha256(local_file_path)
    check_sum_remote_cmd: str = f"sha256sum {remote_file_path} | cut -d' ' -f1"
    LOG(f"Check sum command: {check_sum_remote_cmd}")
    remote_sha256: str = ssh_helper.exec_command_acu(check_sum_remote_cmd)
    LOG(f"Local SHA: {local_sha256.strip()} vs Remote SHA: {remote_sha256.strip()}")
    return local_sha256.strip() == remote_sha256.strip()


def _compute_sha256(file_path: str) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()
