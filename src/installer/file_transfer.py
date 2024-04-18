import paramiko
from scp import SCPClient
import sys
import os
import hashlib


class RemoteInfo:
    def __init__(self, ip: str, username: str, password: str):
        self.ip = ip
        self.username = username
        self.password = password


def transfer_file(local_file_path: str, remote_dir_path: str, ssm_info: RemoteInfo, acu_info: RemoteInfo) -> bool:
    ssm_client = create_ssh_client(ssm_info)

    try:
        # Setup the SSH tunnel
        transport = ssm_client.get_transport()
        dest_addr = (acu_info.ip, 22)  # Destination is ACU server
        local_addr = ('127.0.0.1', 2200)  # Local address
        channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)

        # Create an SSH client for the ACU server using the tunnel
        acu_client = paramiko.SSHClient()
        acu_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        acu_client.connect('127.0.0.1', port=2200, username=acu_info.username, password=acu_info.password, sock=channel)

        # Use the mkdir command to create the directory if it doesn't exist
        stdin, stdout, stderr = acu_client.exec_command(f"mkdir -p {remote_dir_path}")

        def update_progress(filename, size, sent):
            percent_complete = float(sent) / float(size) * 100
            sys.stdout.write(f"\rTransferring: {percent_complete:.2f}% complete")
            sys.stdout.flush()

        # SCP transfer over the established connection
        with SCPClient(acu_client.get_transport(), progress=update_progress) as scp:
            print("Start transfer")
            full_remote_path = os.path.join(remote_dir_path, os.path.basename(local_file_path))
            scp.put(local_file_path, full_remote_path)
            is_same: bool = is_same_file(acu_client, local_file_path, full_remote_path)
            print(f"File transferred to {full_remote_path} on ACU server, is file ok = {is_same}")
            return is_same
    except Exception as e:
        print(f"Exception {e}")
        return False
    finally:
        # Cleanup
        acu_client.close()
        ssm_client.close()
        channel.close()


def create_ssh_client(remote_info: RemoteInfo) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(remote_info.ip, username=remote_info.username, password=remote_info.password)
    return client


def is_same_file(client, local_file_path, remote_file_path) -> bool:
    """ Verify that the transferred file matches the SHA-256 checksum on both ends. """
    local_sha256 = compute_sha256(local_file_path)
    remote_sha256 = get_remote_sha256(client, remote_file_path)
    print(f"Local SHA-256: {local_sha256}")
    print(f"Remote SHA-256: {remote_sha256}")
    is_same_file = local_sha256 == remote_sha256
    return is_same_file


def compute_sha256(file_path):
    """ Compute the SHA-256 checksum of a file. """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read and update hash string value in blocks of 4K
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def get_remote_sha256(client, remote_path):
    """ Get the SHA-256 checksum of a remote file using the remote SSH client. """
    stdin, stdout, stderr = client.exec_command(f"sha256sum {remote_path} | cut -d' ' -f1")
    return stdout.read().strip().decode('utf-8')
