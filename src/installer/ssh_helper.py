import time
from typing import Callable, Optional
import os
import paramiko
from scp import SCPClient
import hashlib


class RemoteInfo:
    def __init__(self, ip: str, username: str, password: str):
        self.ip = ip
        self.username = username
        self.password = password


class SSHHelper:
    def __init__(self, ssm_info: RemoteInfo, acu_info: RemoteInfo) -> None:
        self.ssm_info: RemoteInfo = ssm_info
        self.acu_info: RemoteInfo = acu_info
        self.ssm_client: paramiko.SSHClient = paramiko.SSHClient()
        self.ssm_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.acu_client: Optional[paramiko.SSHClient] = None

    def connect_acu(self, timeout_secs: int = 10) -> None:
        start_time: float = time.time()
        print(f"Connecting to ssm ...", flush=True)
        self.ssm_client.connect(self.ssm_info.ip, username=self.ssm_info.username,
                                password=self.ssm_info.password, timeout=self.get_remain_secs(timeout_secs, start_time))
        transport: paramiko.Transport = self.ssm_client.get_transport()
        print("Connecting acu ...", flush=True)
        acu_channel: paramiko.Channel = transport.open_channel(
            "direct-tcpip", (self.acu_info.ip, 22), ('127.0.0.1', 2200), timeout=self.get_remain_secs(timeout_secs, start_time))
        self.acu_client = paramiko.SSHClient()
        self.acu_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.acu_client.connect('127.0.0.1', port=2200, username=self.acu_info.username,
                                password=self.acu_info.password, sock=acu_channel, timeout=self.get_remain_secs(timeout_secs, start_time))

    def get_remain_secs(self, timeout_secs: int, start_time: int) -> int:
        elapse_time: int = time.time() - start_time
        remain_secs: int = timeout_secs - elapse_time
        return remain_secs

    def close_connections(self):
        if self.acu_client:
            self.acu_client.close()
        self.ssm_client.close()

    def exec_command_acu(self, command: str):
        target_client = self.acu_client
        stdin, stdout, stderr = target_client.exec_command(command)
        return stdout.read().decode()

    def transfer_file(self, local_file_path: str, remote_file_path: str, update_progress: Callable[[bytes, int, int], None]) -> str:
        """@param update_progress: (filename, size, sent)"""
        with SCPClient(self.acu_client.get_transport(), progress=update_progress) as scp:
            print(f"Transfering {local_file_path} to {remote_file_path}", flush=True)
            scp.put(local_file_path, remote_file_path)

    def verify_file(self, local_file_path, remote_file_path):
        local_sha256 = self.compute_sha256(local_file_path)
        check_sum_remote_cmd = f"sha256sum {remote_file_path} | cut -d' ' -f1"
        remote_sha256 = self.exec_command_acu(check_sum_remote_cmd)
        return local_sha256.strip() == remote_sha256.strip()

    @staticmethod
    def compute_sha256(file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
