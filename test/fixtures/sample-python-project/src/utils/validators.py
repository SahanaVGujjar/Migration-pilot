"""Validation helpers."""

def is_email(value: str) -> bool:
    return "@" in value and "." in value.split("@")[-1]

def is_required(value) -> bool:
    return value is not None and str(value).strip() != ""
