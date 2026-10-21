
import re
import secrets
import string
from datetime import datetime, timezone
from urllib.parse import urlparse

RESERVED_ALIASES = {
    "api", "static", "stats", "admin", "expired", "favicon.ico", "robots.txt"
}
ALPHABET = string.ascii_letters + string.digits
ALIAS_PATTERN = re.compile(r"[a-zA-Z0-9_-]{3,30}")


def validate_url(url: str) -> bool:
    if not isinstance(url, str) or not url or url != url.strip():
        return False
    try:
        parsed = urlparse(url)
        return (
            parsed.scheme in {"http", "https"}
            and parsed.hostname is not None
            and (parsed.port is None or 1 <= parsed.port <= 65535)
            and not parsed.netloc.endswith(":")
        )
    except ValueError:
        return False


def validate_alias(alias: str) -> bool:
    return (
        isinstance(alias, str)
        and ALIAS_PATTERN.fullmatch(alias) is not None
        and alias not in RESERVED_ALIASES
    )


def generate_code(length: int = 6) -> str:
    if isinstance(length, bool) or not isinstance(length, int) or length < 1:
        raise ValueError("length must be a positive integer")
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def parse_expiry(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("Expiry must be a UTC ISO timestamp")
    try:
        expiry = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid ISO 8601 expiry timestamp") from exc
    if expiry.tzinfo is None or expiry.utcoffset() is None:
        raise ValueError("Expiry timestamp must include a timezone")
    expiry = expiry.astimezone(timezone.utc)
    if expiry <= datetime.now(timezone.utc):
        raise ValueError("Expiry must be in the future")
    return expiry.isoformat(timespec="milliseconds").replace("+00:00", "Z")


if __name__ == "__main__":
    assert validate_url("https://example.com/path")
    assert validate_url("http://localhost:5000")
    assert not validate_url("")
    assert not validate_url("ftp://x.com")
    assert not validate_url("http://")
    assert not validate_url("javascript:alert(1)")
    assert not validate_url("https://example.com:invalid")

    assert validate_alias("my-resume")
    assert validate_alias("abc_123")
    assert not validate_alias("a")
    assert not validate_alias("my resume")
    assert not validate_alias("api")
    assert not validate_alias("a" * 31)

    code = generate_code()
    assert len(code) == 6
    assert all(char in ALPHABET for char in code)

    assert parse_expiry(None) is None
    assert parse_expiry("") is None
    future = "2099-10-28T12:30:00.000Z"
    assert parse_expiry(future) == future

    for value in ("2000-01-01T12:00:00.000Z", "2026-10-28T12:30:00"):
        try:
            parse_expiry(value)
            raise AssertionError(f"Expected ValueError for {value}")
        except ValueError as exc:
            if str(exc).startswith("Expected ValueError"):
                raise

    print("All helper tests passed!")
