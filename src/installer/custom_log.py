from enum import Enum


def LOG(message: str, flush: bool = True, end="\n"):
    print(message, end=end, flush=flush)
