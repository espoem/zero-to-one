"""Hermetic pytest suite proving FastAPI 0.165+ OAuth 2.1 BFF and RFC 8725 defenses."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json

from cryptography.hazmat.primitives import serialization
from fastapi.testclient import TestClient

from auth_service import (
    API_AUDIENCE,
    AS_ISSUER,
    CLIENT_ID,
    REDIRECT_URI,
    SESSION_COOKIE,
    InMemoryAuthorizationServer,
    compute_s256_challenge,
    create_app,
)


def _b64url_json(obj: dict[str, object]) -> str:
    raw = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _complete_bff_login(client: TestClient, auth_server: InMemoryAuthorizationServer) -> str:
    login_resp = client.get("/auth/login")
    assert login_resp.status_code == 200
    login_data = login_resp.json()

    auth_resp = auth_server.authorize(
        client_id=CLIENT_ID,
        redirect_uri=REDIRECT_URI,
        code_challenge=login_data["code_challenge"],
        code_challenge_method="S256",
        nonce=login_data["nonce"],
        sub="alice-42",
    )

    cb_resp = client.get(
        "/auth/callback",
        params={
            "code": auth_resp["code"],
            "state": login_data["state"],
            "iss": auth_resp["iss"],
        },
    )
    assert cb_resp.status_code == 200
    assert cb_resp.json()["sub"] == "alice-42"
    set_cookie = cb_resp.headers["set-cookie"]
    assert f"{SESSION_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "access_token" not in cb_resp.json()
    return client.cookies[SESSION_COOKIE]


def test_oauth21_bff_pkce_login_and_cookie_order_flow() -> None:
    auth_server = InMemoryAuthorizationServer()
    app = create_app(auth_server)

    with TestClient(app, base_url="https://app.example.com") as client:
        _complete_bff_login(client, auth_server)

        order_resp = client.post(
            "/bff/orders",
            json={"item": "yubikey-5c", "quantity": 2},
            headers={"Sec-Fetch-Site": "same-origin"},
        )
        assert order_resp.status_code == 200
        assert order_resp.json()["owner"] == "alice-42"
        assert order_resp.headers["cache-control"] == "no-store"
        assert order_resp.headers["x-content-type-options"] == "nosniff"


def test_blocks_rfc9207_mixup_and_cross_site_csrf() -> None:
    auth_server = InMemoryAuthorizationServer()
    app = create_app(auth_server)

    with TestClient(app, base_url="https://app.example.com") as client:
        login_data = client.get("/auth/login").json()
        auth_resp = auth_server.authorize(
            client_id=CLIENT_ID,
            redirect_uri=REDIRECT_URI,
            code_challenge=login_data["code_challenge"],
            code_challenge_method="S256",
            nonce=login_data["nonce"],
        )

        mixup_resp = client.get(
            "/auth/callback",
            params={
                "code": auth_resp["code"],
                "state": login_data["state"],
                "iss": "https://evil-idp.example.com",
            },
        )
        assert mixup_resp.status_code == 400
        assert mixup_resp.json()["detail"] == "issuer_mixup_detected"

        # Complete legitimate login, then attempt cross-site POST
        _complete_bff_login(client, auth_server)
        csrf_resp = client.post(
            "/bff/orders",
            json={"item": "attacker-order", "quantity": 1},
            headers={"Sec-Fetch-Site": "cross-site"},
        )
        assert csrf_resp.status_code == 403
        assert csrf_resp.json()["detail"] == "cross_site_csrf_blocked"


def test_resource_server_enforces_rfc8725_jwt_invariants() -> None:
    auth_server = InMemoryAuthorizationServer()
    app = create_app(auth_server)

    with TestClient(app, base_url="https://app.example.com") as client:
        valid_at = auth_server.mint_access_token(sub="alice-42", scope="orders:read")
        ok = client.get("/api/orders", headers={"Authorization": f"Bearer {valid_at}"})
        assert ok.status_code == 200
        assert ok.json()["sub"] == "alice-42"

        # 1. alg: none bypass attempt
        alg_none = (
            f"{_b64url_json({'alg': 'none', 'typ': 'at+jwt'})}."
            f"{_b64url_json({'iss': AS_ISSUER, 'sub': 'admin', 'aud': API_AUDIENCE, 'exp': 9999999999, 'iat': 1700000000, 'jti': 'x'})}."
        )
        assert (
            client.get("/api/orders", headers={"Authorization": f"Bearer {alg_none}"}).status_code
            == 401
        )

        # 2. RS256/HS256 algorithm confusion using raw public SPKI PEM as HMAC secret
        pub_pem = auth_server.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        signing_input = (
            f"{_b64url_json({'alg': 'HS256', 'typ': 'at+jwt'})}."
            f"{_b64url_json({'iss': AS_ISSUER, 'sub': 'attacker', 'aud': API_AUDIENCE, 'iat': 1700000000, 'exp': 9999999999, 'jti': 'confused'})}"
        )
        forged_sig = (
            base64.urlsafe_b64encode(
                hmac.new(pub_pem, signing_input.encode("ascii"), hashlib.sha256).digest()
            )
            .rstrip(b"=")
            .decode("ascii")
        )
        confused_token = f"{signing_input}.{forged_sig}"
        assert (
            client.get(
                "/api/orders", headers={"Authorization": f"Bearer {confused_token}"}
            ).status_code
            == 401
        )

        # 3. Token confusion: ID token (typ: JWT) presented as access token
        id_token = auth_server.mint_id_token(sub="alice-42", nonce="n1", access_token=valid_at)
        wrong_typ = client.get("/api/orders", headers={"Authorization": f"Bearer {id_token}"})
        assert wrong_typ.status_code == 401
        assert wrong_typ.json()["detail"] == "invalid_token_type"

        # 4. Audience mismatch (token minted for Billing API presented to Orders API)
        billing_at = auth_server.mint_access_token(
            sub="alice-42", scope="billing:read", aud="https://billing.example.com"
        )
        assert (
            client.get("/api/orders", headers={"Authorization": f"Bearer {billing_at}"}).status_code
            == 401
        )

        # 5. Expired token
        expired_at = auth_server.mint_access_token(
            sub="alice-42", scope="orders:read", exp_offset_s=-120
        )
        assert (
            client.get("/api/orders", headers={"Authorization": f"Bearer {expired_at}"}).status_code
            == 401
        )


def test_rtr_reuse_detection_revokes_family_and_bff_session() -> None:
    auth_server = InMemoryAuthorizationServer()
    app = create_app(auth_server)

    with TestClient(app, base_url="https://app.example.com") as client:
        sid = _complete_bff_login(client, auth_server)
        stolen_rt = app.state.sessions[sid].refresh_token

        # Legitimate rotation RT1 -> RT2
        r1 = client.post("/bff/refresh", headers={"Sec-Fetch-Site": "same-origin"})
        assert r1.status_code == 200
        assert app.state.sessions[sid].refresh_token != stolen_rt

        # Attacker replays RT1 directly against AS -> family marked compromised
        try:
            auth_server.rotate_refresh_token(stolen_rt)
            raise AssertionError("Expected reuse detection error")
        except Exception as exc:
            assert "refresh_token_reuse_detected" in str(exc)

        # Legitimate BFF attempt with RT2 is now rejected and BFF session is purged
        r2 = client.post("/bff/refresh", headers={"Sec-Fetch-Site": "same-origin"})
        assert r2.status_code == 401
        assert sid not in app.state.sessions
        set_cookie = r2.headers.get("set-cookie", "").lower()
        assert "__host-sid=" in set_cookie and "max-age=0" in set_cookie


def test_pkce_s256_vector_stability() -> None:
    # RFC 7636 Appendix B test vector
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert compute_s256_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
