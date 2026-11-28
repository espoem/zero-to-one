"""FastAPI 0.165+ OAuth 2.1 BFF & RFC 8725 JWT Resource Server reference implementation."""

import base64
import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass, field
from typing import Annotated, Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

AS_ISSUER = "https://auth.example.com"
CLIENT_ID = "bff-web-app"
REDIRECT_URI = "https://app.example.com/auth/callback"
API_AUDIENCE = "https://api.example.com"
SESSION_COOKIE = "__Host-sid"


def b64url(data: bytes) -> str:
    """Encode bytes as unpadded Base64URL per RFC 7515 / RFC 7636."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def compute_s256_challenge(verifier: str) -> str:
    """Compute PKCE S256 code_challenge = BASE64URL(SHA256(code_verifier))."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return b64url(digest)


def compute_at_hash(access_token: str) -> str:
    """Compute OIDC Core 1.0 at_hash (left half of SHA-256 of ASCII access token)."""
    digest = hashlib.sha256(access_token.encode("ascii")).digest()
    return b64url(digest[:16])


@dataclass
class TokenFamily:
    """Tracks refresh token lineage for RFC 9700 §4.14 reuse detection."""

    sub: str
    current_token: str
    used_tokens: set[str] = field(default_factory=set)
    compromised: bool = False


class InMemoryAuthorizationServer:
    """Hermetic OAuth 2.1 / OIDC Core 1.0 Authorization Server simulator."""

    def __init__(self) -> None:
        self.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.public_key = self.private_key.public_key()
        self.kid = "as-rsa-2026-11"
        self.auth_codes: dict[str, dict[str, str]] = {}
        self.families: dict[str, TokenFamily] = {}
        self.token_to_family: dict[str, str] = {}

    def authorize(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        code_challenge_method: str,
        nonce: str,
        sub: str = "user-42",
    ) -> dict[str, str]:
        if client_id != CLIENT_ID or redirect_uri != REDIRECT_URI:
            raise HTTPException(status_code=400, detail="invalid_request")
        if code_challenge_method != "S256":
            raise HTTPException(status_code=400, detail="plain_pkce_forbidden")

        code = f"code_{secrets.token_urlsafe(24)}"
        self.auth_codes[code] = {
            "sub": sub,
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "nonce": nonce,
        }
        return {"code": code, "iss": AS_ISSUER}

    def exchange_code(self, *, code: str, redirect_uri: str, code_verifier: str) -> dict[str, Any]:
        record = self.auth_codes.pop(code, None)
        if record is None or record["redirect_uri"] != redirect_uri:
            raise HTTPException(status_code=400, detail="invalid_grant")

        expected = record["code_challenge"]
        computed = compute_s256_challenge(code_verifier)
        if not hmac.compare_digest(computed, expected):
            raise HTTPException(status_code=400, detail="invalid_pkce_verifier")

        family_id = f"fam_{secrets.token_urlsafe(12)}"
        refresh_token = f"rt_{secrets.token_urlsafe(24)}"
        self.families[family_id] = TokenFamily(sub=record["sub"], current_token=refresh_token)
        self.token_to_family[refresh_token] = family_id

        access_token = self.mint_access_token(sub=record["sub"], scope="orders:read orders:write")
        id_token = self.mint_id_token(
            sub=record["sub"], nonce=record["nonce"], access_token=access_token
        )
        return {
            "access_token": access_token,
            "id_token": id_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": 300,
        }

    def rotate_refresh_token(self, refresh_token: str) -> dict[str, Any]:
        family_id = self.token_to_family.get(refresh_token)
        if family_id is None:
            raise HTTPException(status_code=400, detail="invalid_grant")

        family = self.families[family_id]
        if family.compromised or refresh_token in family.used_tokens:
            family.compromised = True
            raise HTTPException(status_code=400, detail="refresh_token_reuse_detected")

        if not hmac.compare_digest(family.current_token, refresh_token):
            family.compromised = True
            raise HTTPException(status_code=400, detail="refresh_token_reuse_detected")

        family.used_tokens.add(refresh_token)
        next_rt = f"rt_{secrets.token_urlsafe(24)}"
        family.current_token = next_rt
        self.token_to_family[next_rt] = family_id

        return {
            "access_token": self.mint_access_token(
                sub=family.sub, scope="orders:read orders:write"
            ),
            "refresh_token": next_rt,
            "token_type": "Bearer",
            "expires_in": 300,
        }

    def mint_access_token(
        self,
        *,
        sub: str,
        scope: str,
        aud: str = API_AUDIENCE,
        typ: str = "at+jwt",
        exp_offset_s: int = 300,
    ) -> str:
        now = int(time.time())
        payload = {
            "iss": AS_ISSUER,
            "sub": sub,
            "aud": aud,
            "iat": now,
            "nbf": now,
            "exp": now + exp_offset_s,
            "jti": secrets.token_hex(16),
            "scope": scope,
        }
        return jwt.encode(
            payload,
            self.private_key,
            algorithm="RS256",
            headers={"kid": self.kid, "typ": typ},
        )

    def mint_id_token(self, *, sub: str, nonce: str, access_token: str) -> str:
        now = int(time.time())
        payload = {
            "iss": AS_ISSUER,
            "sub": sub,
            "aud": CLIENT_ID,
            "iat": now,
            "exp": now + 300,
            "nonce": nonce,
            "at_hash": compute_at_hash(access_token),
            "email": "alice@example.com",
            "email_verified": True,
        }
        return jwt.encode(
            payload,
            self.private_key,
            algorithm="RS256",
            headers={"kid": self.kid, "typ": "JWT"},
        )


@dataclass
class BffSession:
    sub: str
    email: str
    access_token: str
    refresh_token: str


class OrderPayload(BaseModel):
    item: str
    quantity: int


def create_app(auth_server: InMemoryAuthorizationServer | None = None) -> FastAPI:
    """Build a FastAPI 0.165+ app hosting the OAuth 2.1 BFF and RFC 8725 Resource API."""
    as_instance = auth_server or InMemoryAuthorizationServer()
    pending_auth_tx: dict[str, dict[str, str]] = {}
    sessions: dict[str, BffSession] = {}
    bearer_scheme = HTTPBearer(auto_error=False)

    app = FastAPI(title="Zero-to-One OAuth 2.1 BFF & Resource API")
    app.state.auth_server = as_instance
    app.state.sessions = sessions

    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next: Any) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    def enforce_same_site_post(
        request: Request,
        sec_fetch_site: Annotated[str | None, Header()] = None,
    ) -> None:
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and sec_fetch_site == "cross-site":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="cross_site_csrf_blocked",
            )

    def verify_access_token(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    ) -> dict[str, Any]:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="missing_bearer_token")

        token = credentials.credentials
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="malformed_jwt_header") from exc

        if header.get("typ") != "at+jwt":
            raise HTTPException(status_code=401, detail="invalid_token_type")

        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                as_instance.public_key,
                algorithms=["RS256"],
                audience=API_AUDIENCE,
                issuer=AS_ISSUER,
                leeway=60,
                options={"require": ["exp", "iat", "iss", "aud", "sub", "jti"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="invalid_access_token") from exc

        return claims

    @app.get("/auth/login")
    def auth_login() -> dict[str, str]:
        state = secrets.token_urlsafe(24)
        nonce = secrets.token_urlsafe(24)
        verifier = secrets.token_urlsafe(48)
        challenge = compute_s256_challenge(verifier)
        pending_auth_tx[state] = {"nonce": nonce, "verifier": verifier}
        return {
            "authorization_url": (
                f"{AS_ISSUER}/authorize?response_type=code&client_id={CLIENT_ID}"
                f"&redirect_uri={REDIRECT_URI}&state={state}&nonce={nonce}"
                f"&code_challenge={challenge}&code_challenge_method=S256"
            ),
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
        }

    @app.get("/auth/callback")
    def auth_callback(code: str, state: str, iss: str) -> Response:
        if iss != AS_ISSUER:
            raise HTTPException(status_code=400, detail="issuer_mixup_detected")

        tx = pending_auth_tx.pop(state, None)
        if tx is None:
            raise HTTPException(status_code=400, detail="invalid_or_replayed_state")

        tokens = as_instance.exchange_code(
            code=code,
            redirect_uri=REDIRECT_URI,
            code_verifier=tx["verifier"],
        )

        id_claims: dict[str, Any] = jwt.decode(
            tokens["id_token"],
            as_instance.public_key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=AS_ISSUER,
            leeway=60,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
        )
        if not hmac.compare_digest(str(id_claims["nonce"]), tx["nonce"]):
            raise HTTPException(status_code=401, detail="invalid_oidc_nonce")
        if id_claims.get("email_verified") is not True:
            raise HTTPException(status_code=403, detail="unverified_email_rejected")

        expected_at_hash = compute_at_hash(tokens["access_token"])
        if not hmac.compare_digest(str(id_claims.get("at_hash", "")), expected_at_hash):
            raise HTTPException(status_code=401, detail="invalid_at_hash")

        sid = secrets.token_urlsafe(32)
        sessions[sid] = BffSession(
            sub=str(id_claims["sub"]),
            email=str(id_claims["email"]),
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )

        response = JSONResponse({"authenticated": True, "sub": id_claims["sub"]})
        response.set_cookie(
            key=SESSION_COOKIE,
            value=sid,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
            max_age=3600,
        )
        return response

    @app.post("/bff/refresh", dependencies=[Depends(enforce_same_site_post)])
    def bff_refresh(
        sid: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    ) -> Response:
        if sid is None or sid not in sessions:
            raise HTTPException(status_code=401, detail="unauthenticated")

        session = sessions[sid]
        try:
            rotated = as_instance.rotate_refresh_token(session.refresh_token)
        except HTTPException:
            sessions.pop(sid, None)
            resp = JSONResponse({"detail": "session_revoked_on_reuse"}, status_code=401)
            resp.delete_cookie(SESSION_COOKIE, path="/")
            raise HTTPException(status_code=401, detail="session_revoked_on_reuse") from None

        session.access_token = rotated["access_token"]
        session.refresh_token = rotated["refresh_token"]
        return JSONResponse({"refreshed": True})

    @app.post("/bff/orders", dependencies=[Depends(enforce_same_site_post)])
    def bff_create_order(
        order: OrderPayload,
        sid: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    ) -> dict[str, Any]:
        if sid is None or sid not in sessions:
            raise HTTPException(status_code=401, detail="unauthenticated")

        session = sessions[sid]
        claims = jwt.decode(
            session.access_token,
            as_instance.public_key,
            algorithms=["RS256"],
            audience=API_AUDIENCE,
            issuer=AS_ISSUER,
        )
        return {"order": order.model_dump(), "owner": claims["sub"], "via": "bff"}

    @app.get("/api/orders")
    def resource_list_orders(
        claims: Annotated[dict[str, Any], Depends(verify_access_token)],
    ) -> dict[str, Any]:
        return {"sub": claims["sub"], "scope": claims["scope"], "orders": [{"id": "ord-1"}]}

    return app
