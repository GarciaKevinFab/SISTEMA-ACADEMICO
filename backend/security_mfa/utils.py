import hashlib
import os
import string
import secrets
import base64

ALPHABET = string.ascii_uppercase + string.digits

def gen_secret_base32():
    # 20 bytes -> base32 para TOTP
    return base64.b32encode(os.urandom(20)).decode("utf-8").replace("=", "")

def gen_backup_codes(n=10, length=10):
    return ["".join(secrets.choice(ALPHABET) for _ in range(length)) for _ in range(n)]

def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()

def hash_codes(codes):
    return [hash_code(c) for c in codes]

def consume_backup_code(hashed_list, plain_code):
    h = hash_code(plain_code)
    if h in hashed_list:
        new_list = [x for x in hashed_list if x != h]
        return True, new_list
    return False, hashed_list
