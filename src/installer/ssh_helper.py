import time
from typing import Callable, Optional
import paramiko
from scp import SCPClient
from custom_log import LOG, ELogDest


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

    def connect_acu(self, secs_timeout_per_connect, secs_total_connect_timeout: int) -> None:
        start_time: float = time.time()
        connected: bool = False
        while True:
            try:
                elapsed_time = time.time() - start_time
                if elapsed_time >= secs_total_connect_timeout:
                    break
                LOG(f"Attempting to connect to SSM... Elapsed time: {elapsed_time:.2f}s", flush=True)
                self.ssm_client.connect(self.ssm_info.ip, username=self.ssm_info.username,
                                        password=self.ssm_info.password, timeout=secs_timeout_per_connect)
                transport: paramiko.Transport = self.ssm_client.get_transport()
                LOG("SSM connection established. Connecting to ACU...", flush=True)
                local_ip: str = '127.0.0.1'
                default_port: int = 22
                acu_channel: paramiko.Channel = transport.open_channel(
                    "direct-tcpip", (self.acu_info.ip, 22), (local_ip, default_port), timeout=secs_timeout_per_connect)
                self.acu_client = paramiko.SSHClient()
                self.acu_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                self.acu_client.connect(local_ip, port=default_port, username=self.acu_info.username,
                                        password=self.acu_info.password, sock=acu_channel, timeout=secs_timeout_per_connect)
                connected = True
                break
            except Exception as e:
                LOG(f"Error occurred: {e}, Retrying connect now")

        if not connected:
            raise Exception("Failed to connect within the specified timeout period.")

    def exec_command_acu(self, command: str, is_stream_output: bool = False) -> str:
        full_command: str = f"bash -l -c \"{command}\""  # Use this to make sure have same env as login
        LOG(f"Start command: \"{command}\"", dest=ELogDest.TO_SERVER)
        # Exec return immediately in theory but may have some delay due to network ...
        stdin, stdout, stderr = self.acu_client.exec_command(full_command)
        # Show + capture outputs
        output_lines: list[str] = []  # List to store each line of output
        while True:
            line = stdout.readline()
            if not line:
                break
            if is_stream_output:
                LOG(line, end='', flush=True)  # LOG each line immediately if streaming is enabled
            output_lines.append(line)  # Store the line in the list

        exit_code: int = stdout.channel.recv_exit_status()  # Get exit status, this block until command exit.
        LOG(f"Command \"{command}\" exit with code {exit_code}", flush=True, dest=ELogDest.TO_SERVER)
        if (exit_code != 0):
            LOG(f"Command \"{command}\" failed", dest=ELogDest.TO_SERVER)
            command_error: str = stderr.read().decode()
            raise Exception(f"Command error: {command_error}")

        full_output: str = ''.join(output_lines)
        return full_output

    def transfer_file(self, local_file_path: str, remote_file_path: str, update_progress: Callable[[bytes, int, int], None], connect_timeout_secs=10) -> None:
        with SCPClient(self.acu_client.get_transport(), progress=update_progress, socket_timeout=connect_timeout_secs) as scp:
            LOG(f"Transferring {local_file_path} to {remote_file_path}", flush=True)
            scp.put(local_file_path, remote_file_path)

    def _get_remain_secs(self, timeout_secs: int, start_time: float) -> int:
        elapsed_time: float = time.time() - start_time
        remaining_secs: int = max(0, int(timeout_secs - elapsed_time))
        return remaining_secs

    def close_connections(self):
        if self.acu_client:
            self.acu_client.close()
        self.ssm_client.close()
