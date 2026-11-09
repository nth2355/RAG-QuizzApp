from pydantic import BaseModel, EmailStr, Field, field_validator
from enum import Enum

class UserRole(str, Enum):
    TEACHER = "teacher"
    STUDENT = "student"

class PasswordInput(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
        return value

class UserCreate(PasswordInput):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    # role is intentionally NOT accepted from the client to prevent privilege escalation.
    # All new users are registered as 'student' by the server.

class UserLogin(PasswordInput):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
