"""
Pure-Python SHA-256 implementation for educational purposes.

Demonstrates the SHA-256 hashing algorithm used as the proof-of-work
function in Bitcoin and many other blockchain systems.
"""

import struct

# SHA-256 constants: first 32 bits of the fractional parts of the
# cube roots of the first 64 primes (2..311).
K = [
    0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
    0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
    0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
    0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
    0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
    0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
    0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
    0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
    0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
    0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
    0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
    0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
    0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
    0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
    0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
    0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
]

# Initial hash values: first 32 bits of the fractional parts of the
# square roots of the first 8 primes (2..19).
H_INIT = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
]


def _right_rotate(value, amount):
    """Right-rotate a 32-bit integer by *amount* bits."""
    return ((value >> amount) | (value << (32 - amount))) & 0xFFFFFFFF


def _pad_message(message: bytes) -> bytes:
    """Pad the message to a multiple of 512 bits (64 bytes) per FIPS 180-4."""
    length = len(message)
    bit_length = length * 8

    # Append bit '1' (0x80 byte)
    message += b"\x80"

    # Append zeros until message length is 56 mod 64
    message += b"\x00" * ((56 - (length + 1) % 64) % 64)

    # Append original length in bits as 64-bit big-endian
    message += struct.pack(">Q", bit_length)

    return message


def sha256(data: bytes) -> str:
    """
    Compute the SHA-256 hash of *data* and return the hex digest.

    Parameters
    ----------
    data : bytes
        The input message to hash.

    Returns
    -------
    str
        The 64-character lowercase hex digest.
    """
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError(f"Expected bytes, got {type(data).__name__}")

    padded = _pad_message(data)
    h = list(H_INIT)

    # Process each 512-bit (64-byte) block
    for block_start in range(0, len(padded), 64):
        block = padded[block_start : block_start + 64]
        w = list(struct.unpack(">16I", block))

        # Extend the sixteen 32-bit words into sixty-four 32-bit words
        for i in range(16, 64):
            s0 = (
                _right_rotate(w[i - 15], 7)
                ^ _right_rotate(w[i - 15], 18)
                ^ (w[i - 15] >> 3)
            )
            s1 = (
                _right_rotate(w[i - 2], 17)
                ^ _right_rotate(w[i - 2], 19)
                ^ (w[i - 2] >> 10)
            )
            w.append((w[i - 16] + s0 + w[i - 7] + s1) & 0xFFFFFFFF)

        a, b, c, d, e, f, g, hh = h

        for i in range(64):
            s1 = (
                _right_rotate(e, 6) ^ _right_rotate(e, 11) ^ _right_rotate(e, 25)
            )
            ch = (e & f) ^ (~e & g) & 0xFFFFFFFF
            temp1 = (hh + s1 + ch + K[i] + w[i]) & 0xFFFFFFFF
            s0 = (
                _right_rotate(a, 2) ^ _right_rotate(a, 13) ^ _right_rotate(a, 22)
            )
            maj = (a & b) ^ (a & c) ^ (b & c)
            temp2 = (s0 + maj) & 0xFFFFFFFF

            hh = g
            g = f
            f = e
            e = (d + temp1) & 0xFFFFFFFF
            d = c
            c = b
            b = a
            a = (temp1 + temp2) & 0xFFFFFFFF

        for i in range(8):
            h[i] = (h[i] + [a, b, c, d, e, f, g, hh][i]) & 0xFFFFFFFF

    return "".join(f"{v:08x}" for v in h)


def double_sha256(data: bytes) -> str:
    """Compute SHA-256(SHA-256(data)) — the hash function used in Bitcoin."""
    first = sha256(data)
    return sha256(bytes.fromhex(first))
