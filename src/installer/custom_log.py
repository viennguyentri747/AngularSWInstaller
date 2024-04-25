from enum import Enum


class ELogDest(Enum):
    TO_SERVER = "TO_SERVER"
    TO_APP = "TO_APP"
    TO_ALL = "TO_ALL"


def LOG(message: str, flush: bool = True, end="\n", dest: ELogDest = ELogDest.TO_ALL):
    log_prefix: str = dest.value
    print(f"{log_prefix}:{repr(message)}", end=end, flush=flush)