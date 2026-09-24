"""``vectorization.py`` 的单测。

embed_pdf 的端到端要跑真的 sentence-transformers + chromadb，那个属于 integration
test 范畴；这里只测纯函数和模拟后的 Chroma 交互。
"""
from __future__ import annotations

import pytest

from boss_zhipin import vectorization
from boss_zhipin.models.resume_profile import (
    EducationItem,
    ProjectExperience,
    ResumeProfile,
    WorkExperience,
)
from boss_zhipin.vectorization import (
    ResumeChunk,
    VectorStore,
    chunks_from_resume_profile,
    resume_vectorstore_dir,
    split_resume_structured,
    split_text,
    text_hash,
)


# ---------- split_text ----------

class TestSplitText:
    def test_short_text_single_chunk(self):
        chunks = split_text("短文本", chunk_size=1000, chunk_overlap=200)
        assert chunks == ["短文本"]

    def test_long_text_chunked_with_overlap(self):
        text = "ABCDEFGHIJ" * 100  # 1000 字符
        chunks = split_text(text, chunk_size=300, chunk_overlap=50)
        # 至少切成多块
        assert len(chunks) > 1
        # 每块不超过 chunk_size
        for c in chunks:
            assert len(c) <= 300
        # 相邻块之间有 overlap（不严格断在边界）
        # 验证：把所有 chunk concat 起来去重后包含原始 text
        assert text in "".join(chunks) or len("".join(chunks)) >= len(text)

    def test_empty_text_returns_empty(self):
        assert split_text("", chunk_size=1000, chunk_overlap=200) == []

    def test_chunk_size_must_exceed_overlap(self):
        with pytest.raises(ValueError):
            split_text("anything", chunk_size=100, chunk_overlap=100)
        with pytest.raises(ValueError):
            split_text("anything", chunk_size=50, chunk_overlap=100)

    def test_whitespace_only_chunks_dropped(self):
        # chunk 全是空白时会被 .strip() 掉
        text = "   AAA   "
        chunks = split_text(text, chunk_size=3, chunk_overlap=1)
        # 没有任何 chunk 是纯空白
        assert all(c.strip() for c in chunks)

    def test_chinese_text_chunked_correctly(self):
        # 中文（多字节）也按字符数切，不该按字节
        text = "求职者简历内容" * 100
        chunks = split_text(text, chunk_size=50, chunk_overlap=10)
        assert len(chunks) > 1
        for c in chunks:
            assert len(c) <= 50
            assert "求职者" in c or "简历" in c or "内容" in c


# ---------- text_hash ----------

class TestTextHash:
    def test_same_content_same_hash(self):
        assert text_hash("hello world") == text_hash("hello world")

    def test_different_content_different_hash(self):
        assert text_hash("hello world") != text_hash("hello world!")

    def test_hash_is_md5_hex(self):
        h = text_hash("x")
        assert len(h) == 32
        assert all(c in "0123456789abcdef" for c in h)


# ---------- structured resume chunks ----------

class TestSplitResumeStructured:
    def test_structured_resume_sections_are_detected(self):
        text = """
个人概况
五年客户成功经验，擅长续费管理与跨部门协作。
技能
客户沟通、续费谈判、数据分析、项目推进
项目经验
重点客户续费提升项目
介绍：围绕高风险客户建立分层跟进机制。
职责：负责客户访谈、问题归因和续费方案制定。
工作经验
某某科技有限公司 (2021.03 ~ 2025.02) 客户成功经理
负责重点客户运营和续费目标。
教育经历
浙江大学 市场营销
"""
        chunks = split_resume_structured(text)
        sections = {chunk.section for chunk in chunks}

        assert {
            "summary",
            "skills",
            "project_experience",
            "work_experience",
            "education",
        } <= sections
        assert any(chunk.section == "project_experience" for chunk in chunks)

    def test_long_project_is_split_by_lines_not_hard_coded_title_hints(self):
        text = "\n".join(
            [
                "项目经验",
                "重点客户续费提升专项",
                *[f"职责：第{i}段，负责客户访谈、风险识别、方案推进和结果复盘。" for i in range(30)],
            ]
        )

        chunks = split_resume_structured(text)
        project_chunks = [c for c in chunks if c.section == "project_experience"]

        assert len(project_chunks) > 1
        assert all(c.title.startswith("项目经验") for c in project_chunks)
        assert all(len(c.text) <= 700 for c in project_chunks)

    def test_unheaded_resume_falls_back_to_legacy_chunks(self):
        text = "没有明显标题的普通简历文本" * 200
        chunks = split_resume_structured(text)

        assert chunks
        assert {chunk.section for chunk in chunks} == {"fallback"}
        assert chunks[0].title == "片段 1"

    def test_resume_chunk_document_and_metadata(self):
        chunk = ResumeChunk(
            section="project_experience",
            title="DeepDoyo",
            text="负责 AI 小程序流式输出。",
            keywords=["AI", "UniApp"],
            weight=1.3,
            index=2,
        )

        assert chunk.to_document().startswith("【项目经验｜DeepDoyo】")
        assert chunk.to_metadata() == {
            "section": "project_experience",
            "title": "DeepDoyo",
            "index": 2,
            "weight": 1.3,
            "chunk_version": "structured",
            "keywords": "AI,UniApp",
        }

    def test_vectorstore_path_uses_resume_hash_without_chunk_version_suffix(self, tmp_path):
        path = resume_vectorstore_dir("hello", str(tmp_path))

        assert path.name == text_hash("hello")

    def test_chunks_from_resume_profile_generates_all_sections(self):
        profile = ResumeProfile(
            summary="五年客户成功经验，擅长续费管理。",
            skills=["客户沟通", "续费管理"],
            work_experience=[
                WorkExperience(
                    company="某某科技",
                    role="客户成功经理",
                    period="2021.03 ~ 2025.02",
                    description="负责重点客户续费。",
                )
            ],
            project_experience=[
                ProjectExperience(
                    name="续费提升专项",
                    description="识别高风险客户。",
                    responsibilities="负责客户访谈和方案推进。",
                    results="续费率提升。",
                    tools=["Excel", "CRM"],
                )
            ],
            education=[
                EducationItem(
                    school="浙江大学",
                    major="市场营销",
                    degree="本科",
                    period="2017 ~ 2021",
                )
            ],
            achievements=["续费率提升 20%"],
            keywords=["客户成功", "续费管理"],
        )

        chunks = chunks_from_resume_profile(profile)
        sections = {chunk.section for chunk in chunks}

        assert {
            "summary",
            "skills",
            "work_experience",
            "project_experience",
            "education",
            "achievements",
        } <= sections
        assert any(chunk.title == "续费提升专项" for chunk in chunks)


# ---------- VectorStore 封装 ----------

class FakeEmbedder:
    def encode(self, docs):
        return [[float(i), float(i) + 0.5] for i, _ in enumerate(docs)]


def test_search_returns_plain_documents_and_metadata(monkeypatch):
    monkeypatch.setattr(vectorization, "_get_embedder", lambda: FakeEmbedder())

    class FakeCollection:
        def query(self, **kwargs):
            return {
                "documents": [["技能 chunk", "项目 chunk"]],
                "metadatas": [[{"section": "skills"}, {"section": "project_experience"}]],
                "distances": [[0.2, 0.4]],
            }

    store = VectorStore(FakeCollection())

    assert store.search("Vue3", k=2) == ["技能 chunk", "项目 chunk"]
    assert store.search_with_metadata("Vue3", k=2) == [
        {"document": "技能 chunk", "metadata": {"section": "skills"}, "distance": 0.2},
        {
            "document": "项目 chunk",
            "metadata": {"section": "project_experience"},
            "distance": 0.4,
        },
    ]


def test_check_relevance_uses_min_distance(monkeypatch):
    monkeypatch.setattr(vectorization, "_get_embedder", lambda: FakeEmbedder())

    class FakeCollection:
        def query(self, **kwargs):
            assert kwargs["n_results"] == 3
            return {"distances": [[1.6, 0.7, 1.2]]}

    assert VectorStore(FakeCollection()).check_relevance("JD", 1.3) == (True, 0.7)


def test_embed_resume_adds_structured_documents_and_metadata(monkeypatch, tmp_path):
    monkeypatch.setattr(vectorization, "_get_embedder", lambda: FakeEmbedder())
    created = {}

    class FakeCollection:
        name = "resume"

        def add(self, **kwargs):
            created.update(kwargs)

    class FakeClient:
        def __init__(self, path):
            self.path = path

        def list_collections(self):
            return []

        def create_collection(self, name):
            assert name == "resume"
            return FakeCollection()

    monkeypatch.setattr(
        vectorization.chromadb,
        "PersistentClient",
        lambda path: FakeClient(path),
    )

    profile = ResumeProfile(
        skills=["客户沟通", "续费管理"],
        project_experience=[
            ProjectExperience(name="重点客户续费提升专项", responsibilities="负责客户访谈。")
        ],
        keywords=["客户成功"],
    )
    vectorization.embed_resume("简历正文", str(tmp_path), resume_profile=profile)

    assert created["documents"][0].startswith("【技能｜技能】")
    assert any(doc.startswith("【项目经验｜重点客户续费提升专项") for doc in created["documents"])
    assert len(created["documents"]) == len(created["metadatas"]) == len(created["ids"])
    assert created["metadatas"][0]["chunk_version"] == "structured"
