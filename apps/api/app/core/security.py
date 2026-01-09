from fastapi import HTTPException, Header
import jwt
from jwt import PyJWKClient
from app.core.config import CLERK_JWKS_URL

jwks_client = PyJWKClient(CLERK_JWKS_URL)


async def verify_clerk_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")

        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token, signing_key.key, algorithms=["RS256"], options={"verify_exp": True}
        )

        email = None

        if "primary_email" in payload:
            email = payload["primary_email"]
        elif "email" in payload:
            email = payload["email"]
        elif "email_addresses" in payload and len(payload["email_addresses"]) > 0:
            email = payload["email_addresses"][0]

        if not email:
            print("JWT Payload:", payload)
            raise HTTPException(
                status_code=401,
                detail="Email not found in token. Available claims: "
                + ", ".join(payload.keys()),
            )

        return email

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
