import os, json
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import base64

KEY_ID = os.getenv("LTI_KID", "gemelo-kid-1")

def _b64url_uint(n: int) -> str:
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")

# Generar llave una vez si no existe archivo (persistencia simple)
KEY_PATH = os.getenv("LTI_PRIVATE_KEY_PATH", "/app/keys/lti_private.pem")

_private_key = None

def load_or_create_key():
    global _private_key
    if _private_key:
        return _private_key

    os.makedirs(os.path.dirname(KEY_PATH), exist_ok=True)

    if os.path.exists(KEY_PATH):
        with open(KEY_PATH, "rb") as f:
            _private_key = serialization.load_pem_private_key(
                f.read(), password=None, backend=default_backend()
            )
        return _private_key

    # crear nueva
    _private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = _private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    with open(KEY_PATH, "wb") as f:
        f.write(pem)

    return _private_key

def get_jwks():
    key = load_or_create_key()
    pub = key.public_key().public_numbers()

    jwk = {
        "kty": "RSA",
        "kid": KEY_ID,
        "use": "sig",
        "alg": "RS256",
        "n": _b64url_uint(pub.n),
        "e": _b64url_uint(pub.e),
    }
    return {"keys": [jwk]}
