"""Offline regressions using isolated SQLite, real Qdrant local, and fake AI."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

_temporary = tempfile.TemporaryDirectory(prefix="rag-tests-")
_root = Path(_temporary.name)
os.environ.update({
    "RAG_DATABASE_URL": "sqlite:///" + (_root / "test.db").as_posix(),
    "RAG_STORAGE_DIR": str(_root / "vectors"),
    "RAG_DATA_DIR": str(_root / "pdfs"),
    "RAG_GOOGLE_API_KEY": "offline-test-key",
    "JWT_SECRET_KEY": "offline-only-test-secret-with-at-least-32-characters",
    "RAG_PRELOAD_MODELS": "false",
})

from fastapi.testclient import TestClient
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document as Chunk
from src.api import app, enforce_user_filters
from src.cache import ResultCache, clear_learning_caches
from src.config import settings
from src.database.connection import SessionLocal
from src.database.models import Document
from src.filters import MetadataFilter, filter_to_qdrant
from src.learning import _parse_json
from src.store import get_qdrant_client, get_vector_store


class FakeEmbeddings(Embeddings):
    def embed_documents(self, texts):
        return [[1.0, 0.0, 0.0] for _ in texts]

    def embed_query(self, text):
        return [1.0, 0.0, 0.0]


def fake_chunks(paths, document_id=None, original_filename=None, **kwargs):
    return [Chunk(page_content="Photosynthesis converts light into chemical energy.", metadata={
        "document_id": document_id, "filename": original_filename,
        "source": str(paths[0]), "page": 1, "chunk_id": f"{document_id}:1:0", "section": None,
    })]


class LocalIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.embedding = patch("src.store.get_embedding_model", return_value=FakeEmbeddings())
        cls.embedding.start()
        cls.client = TestClient(app)
        cls.client.__enter__()
        cls.addClassCleanup(cls.embedding.stop)
        cls.addClassCleanup(_temporary.cleanup)
        cls.addClassCleanup(cls.client.__exit__, None, None, None)
        cls.headers = []
        for i in range(2):
            body = {"email": f"user{i}@example.com", "password": "test-password", "full_name": f"Test User {i}"}
            response = cls.client.post("/auth/register", json=body)
            assert response.status_code == 201, response.text
            response = cls.client.post("/auth/login", json={"email": body["email"], "password": body["password"]})
            assert response.status_code == 200, response.text
            cls.headers.append({"Authorization": "Bearer " + response.json()["access_token"]})

    def setUp(self):
        clear_learning_caches()

    def upload(self, name, user=0):
        with patch("src.indexing.build_chunks", side_effect=fake_chunks):
            response = self.client.post("/upload", headers=self.headers[user], files={"file": (name, b"%PDF-1.4\nfixture", "application/pdf")})
        self.assertEqual(response.status_code, 200, response.text)
        return next(d for d in self.client.get("/documents", headers=self.headers[user]).json() if d["filename"] == name)

    def test_auth_and_upload_validation(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/documents").status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": "user0@example.com", "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.post("/auth/register", json={"email": "long@example.com", "password": "é" * 40, "full_name": "Long Password"}).status_code, 422)
        response = self.client.post("/upload", headers=self.headers[0], files={"file": ("fake.pdf", b"not a pdf")})
        self.assertEqual(response.status_code, 400)
        with patch.object(settings, "max_upload_bytes", 1024):
            response = self.client.post("/upload", headers=self.headers[0], files={"file": ("big.pdf", b"%PDF-" + b"x" * 2048)})
            self.assertEqual(response.status_code, 413)

    def test_collection_creation_multi_document_filter_and_ownership(self):
        first = self.upload("first.pdf")
        second = self.upload("second.pdf")
        foreign = self.upload("private.pdf", user=1)
        client = get_qdrant_client()
        with SessionLocal() as db:
            owner = db.query(Document).filter(Document.id == int(first["document_id"])).one().user_id
            filters = enforce_user_filters(None, None, owner, db)
            points, _ = client.scroll(settings.qdrant_collection, scroll_filter=filter_to_qdrant(filters), limit=100)
            ids = {p.payload["metadata"]["document_id"] for p in points}
            self.assertIn(first["document_id"], ids)
            self.assertIn(second["document_id"], ids)
            self.assertNotIn(foreign["document_id"], ids)
            denied = enforce_user_filters(MetadataFilter(document_id=foreign["document_id"]), None, owner, db)
            points, _ = client.scroll(settings.qdrant_collection, scroll_filter=filter_to_qdrant(denied))
            self.assertEqual(points, [])
        self.assertEqual(self.client.delete(f"/document-ids/{first['document_id']}", headers=self.headers[1]).status_code, 404)
        response = self.client.delete(f"/document-ids/{first['document_id']}", headers=self.headers[0])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.delete(f"/document-ids/{first['document_id']}", headers=self.headers[0]).status_code, 404)
        points, _ = client.scroll(settings.qdrant_collection, scroll_filter=filter_to_qdrant({"document_id": first["document_id"]}))
        self.assertEqual(points, [])

    def test_duplicate_upload_and_failed_index_cleanup(self):
        self.upload("duplicate.pdf")
        response = self.client.post("/upload", headers=self.headers[0], files={"file": ("duplicate.pdf", b"%PDF-fixture")})
        self.assertEqual(response.status_code, 409)
        with patch("src.indexing.build_chunks", return_value=[]):
            response = self.client.post("/upload", headers=self.headers[0], files={"file": ("scan.pdf", b"%PDF-fixture")})
        self.assertEqual(response.status_code, 422)
        docs = self.client.get("/documents", headers=self.headers[0]).json()
        failed = next(d for d in docs if d["filename"] == "scan.pdf")
        self.assertEqual(failed["status"], "error")
        self.assertIsNone(failed["size_bytes"])
        self.assertEqual(self.client.delete(f"/document-ids/{failed['document_id']}", headers=self.headers[0]).status_code, 200)

    def test_quiz_default_difficulty_scoring_and_cache_copy(self):
        self.upload("quiz.pdf")
        payload = {"items": [{"question": "What is converted?", "options": ["Light", "Stone", "Sand", "Metal"], "correct_index": 0, "explanation": "The document says light.", "source_markers": ["S1"]}]}
        with patch("src.learning.invoke_llm", return_value=json.dumps(payload)) as llm:
            first = self.client.post("/quiz", headers=self.headers[0], json={"document": "quiz.pdf", "difficulty": "hard"})
            self.assertEqual(first.status_code, 200, first.text)
            self.assertIn("hard", llm.call_args.args[0])
            second = self.client.post("/quiz", headers=self.headers[0], json={"document": "quiz.pdf", "difficulty": "hard"})
            self.assertEqual(second.status_code, 200, second.text)
            self.assertNotEqual(first.json()["id"], second.json()["id"])
            self.assertEqual(llm.call_count, 1)
        quiz_id = first.json()["id"]
        path = f"/quiz/{quiz_id}/score"
        self.assertEqual(self.client.post(path, headers=self.headers[0], json={"score": 999}).status_code, 422)
        self.assertEqual(self.client.post(path, headers=self.headers[0], json={"answers": [9]}).status_code, 422)
        self.assertEqual(self.client.post(path, headers=self.headers[1], json={"answers": [0]}).status_code, 404)
        response = self.client.post(path, headers=self.headers[0], json={"answers": [0]})
        self.assertEqual(response.json()["score"], 1)

    def test_summary_options_and_flashcard_completion(self):
        self.upload("learning.pdf")
        with patch("src.learning.invoke_llm", return_value='{"summary":"Light becomes energy.","key_points":["Light"]}') as llm:
            response = self.client.post("/summarize", headers=self.headers[0], json={"document": "learning.pdf", "length": "long", "focus": "Energy", "instructions": "Use simple words"})
            self.assertEqual(response.status_code, 200, response.text)
            prompt = llm.call_args.args[0]
            for phrase in ["600", "Energy", "Use simple words"]:
                self.assertIn(phrase, prompt)
        before = self.client.get("/stats", headers=self.headers[0]).json()["totalFlashcards"]
        with patch("src.learning.invoke_llm", return_value='{"cards":[{"front":"Light","back":"Energy","source_markers":["S1"]}]}'):
            response = self.client.post("/flashcards", headers=self.headers[0], json={"document": "learning.pdf"})
        self.assertEqual(response.status_code, 200, response.text)
        path = f"/flashcards/{response.json()['id']}/complete"
        self.assertEqual(self.client.get("/stats", headers=self.headers[0]).json()["totalFlashcards"], before)
        self.assertEqual(self.client.post(path, headers=self.headers[1]).status_code, 404)
        self.assertEqual(self.client.post(path, headers=self.headers[0]).status_code, 200)
        self.client.post(path, headers=self.headers[0])
        self.assertEqual(self.client.get("/stats", headers=self.headers[0]).json()["totalFlashcards"], before + 1)

    def test_cache_isolation_bounding_expiry_and_invalid_json(self):
        cache = ResultCache(maxsize=1)
        cache["first"] = {"id": 1}
        value = cache.get("first")
        value["id"] = 99
        self.assertEqual(cache.get("first")["id"], 1)
        cache["second"] = {}
        self.assertIsNone(cache.get("first"))
        expired = ResultCache(ttl=-1)
        expired["key"] = {}
        self.assertIsNone(expired.get("key"))
        for text in ["broken JSON", "[]"]:
            with self.assertRaises(RuntimeError):
                _parse_json(text)


if __name__ == "__main__":
    unittest.main()
