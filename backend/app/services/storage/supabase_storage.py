import hashlib
from pathlib import PurePosixPath
from uuid import uuid4

from supabase import Client

from app.schemas.ingestion import StorageResult


class SupabaseStorageService:
    def __init__(self, client: Client, bucket: str):
        self.client = client
        self.bucket = bucket

    def upload_memory_object(
        self,
        *,
        user_id: str,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> StorageResult:
        checksum = hashlib.sha256(data).hexdigest()
        suffix = PurePosixPath(filename).suffix
        path = f"{user_id}/{uuid4()}{suffix}"

        self.client.storage.from_(self.bucket).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": "false"},
        )

        return StorageResult(
            bucket=self.bucket,
            path=path,
            preview_bucket=self.bucket if content_type.startswith("image/") else None,
            preview_path=path if content_type.startswith("image/") else None,
            checksum_sha256=checksum,
            thumbnail_metadata={"content_type": content_type},
        )

    def download_memory_object(self, *, bucket: str, path: str) -> bytes:
        return self.client.storage.from_(bucket).download(path)

    def create_signed_url(self, *, bucket: str, path: str, expires_in: int = 3600) -> str | None:
        if not bucket or not path:
            return None
        response = self.client.storage.from_(bucket).create_signed_url(path, expires_in)
        if isinstance(response, dict):
            return response.get("signedURL") or response.get("signedUrl") or response.get("signed_url")
        return getattr(response, "signed_url", None) or getattr(response, "signedURL", None)
