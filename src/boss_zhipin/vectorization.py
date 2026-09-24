"""简历向量化。"""

from dataclasses import dataclass, field
import hashlib
from pathlib import Path
import re

import chromadb
from sentence_transformers import SentenceTransformer

from boss_zhipin.models.resume_profile import ResumeProfile

EMBED_MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"
COLLECTION_NAME = "resume"
CHUNK_SCHEMA_VERSION = "structured"
MAX_STRUCTURED_CHUNK_CHARS = 700

_embedder: SentenceTransformer | None = None

SECTION_LABELS = {
    "summary": "个人概况",
    "skills": "技能",
    "work_experience": "工作经历",
    "project_experience": "项目经验",
    "education": "教育经历",
    "achievements": "成果",
    "fallback": "简历片段",
}

SECTION_WEIGHTS = {
    "summary": 1.0,
    "skills": 1.25,
    "work_experience": 1.15,
    "project_experience": 1.3,
    "education": 0.8,
    "achievements": 1.2,
    "fallback": 1.0,
}

HEADING_ALIASES = {
    "summary": {
        "个人概况",
        "个人简介",
        "个人优势",
        "个人总结",
        "自我评价",
        "求职意向",
        "概要",
    },
    "skills": {
        "技能",
        "技能栈",
        "技术栈",
        "专业技能",
        "核心技能",
        "技术能力",
        "个人技能",
    },
    "work_experience": {
        "工作经验",
        "工作经历",
        "实习经历",
        "任职经历",
        "职业经历",
    },
    "project_experience": {
        "项目经验",
        "项目经历",
        "项目实践",
        "项目",
    },
    "education": {
        "教育经历",
        "教育背景",
        "学历",
        "教育",
    },
    "achievements": {
        "成就",
        "成果",
        "荣誉",
        "奖项",
        "证书",
        "个人成就",
        "项目成果",
    },
}

WORK_DATE_RE = re.compile(
    r"(?:19|20)\d{2}[./-]\d{1,2}\s*(?:~|-|至|—)\s*(?:(?:19|20)\d{2}[./-]\d{1,2}|至今|现在)"
)


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL_NAME)
    return _embedder


def _encode_texts(texts: list[str]) -> list:
    embeddings = _get_embedder().encode(texts)
    return embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings


def text_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


@dataclass
class ResumeChunk:
    """准备写入向量库的一段结构化简历内容。"""

    section: str
    title: str
    text: str
    keywords: list[str] = field(default_factory=list)
    weight: float = 1.0
    index: int = 0
    chunk_version: str = CHUNK_SCHEMA_VERSION

    def to_document(self) -> str:
        label = SECTION_LABELS.get(self.section, SECTION_LABELS["fallback"])
        title = self.title.strip()
        heading = f"{label}｜{title}" if title else label
        return f"【{heading}】\n{self.text.strip()}"

    def to_metadata(self) -> dict[str, str | int | float]:
        return {
            "section": self.section,
            "title": self.title,
            "index": self.index,
            "weight": self.weight,
            "chunk_version": self.chunk_version,
            "keywords": ",".join(self.keywords),
        }


def split_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    if chunk_size <= chunk_overlap:
        raise ValueError("chunk_size must exceed chunk_overlap")
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == n:
            break
        start = end - chunk_overlap
    return chunks


def _clean_heading(line: str) -> str:
    return re.sub(r"[\s:：/｜|·\-—_]+", "", line.strip())


def _heading_section(line: str) -> str | None:
    """识别跨职业通用的一级简历标题。

    这里只判断“个人概况/技能/项目经验/教育经历”这类结构标题，不使用
    技术栈、行业词或具体岗位词，避免对其他职业简历产生偏置。
    """
    cleaned = _clean_heading(line)
    if not cleaned or len(cleaned) > 16:
        return None
    for section, aliases in HEADING_ALIASES.items():
        if cleaned in aliases:
            return section
    return None


def _normal_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _split_sections(lines: list[str]) -> tuple[list[tuple[str, list[str]]], bool]:
    """按一级标题拆出简历区域；没发现标题时由调用方走兜底切分。"""
    sections: list[tuple[str, list[str]]] = []
    current_section = "summary"
    current_lines: list[str] = []
    found_heading = False

    for line in lines:
        section = _heading_section(line)
        if section is not None:
            if current_lines:
                sections.append((current_section, current_lines))
            current_section = section
            current_lines = []
            found_heading = True
            continue
        current_lines.append(line)

    if current_lines:
        sections.append((current_section, current_lines))
    return sections, found_heading


def _looks_like_work_start(line: str) -> bool:
    """识别工作经历条目的开头。

    时间范围和公司名是相对通用的简历结构信号；这里不识别岗位/行业词。
    """
    return bool(WORK_DATE_RE.search(line)) or (
        any(token in line for token in ("有限公司", "集团", "公司"))
        and any(ch.isdigit() for ch in line)
    )


def _split_item_blocks(section: str, lines: list[str]) -> list[tuple[str, list[str]]]:
    """拆分 section 内部条目。

    方案 A：只在工作经历中使用时间/公司这类通用结构信号拆条目；
    项目经验不再按技术词、平台词或行业词猜项目标题，而是交给后续段落窗口切分。
    """
    if section != "work_experience":
        return [("", lines)]

    blocks: list[tuple[str, list[str]]] = []
    title = ""
    body: list[str] = []

    for line in lines:
        is_start = _looks_like_work_start(line)
        if is_start and body:
            blocks.append((title, body))
            title = line
            body = [line]
            continue
        if is_start and not body:
            title = line
        body.append(line)

    if body:
        blocks.append((title, body))
    return blocks


def _split_long_block(lines: list[str], max_chars: int = MAX_STRUCTURED_CHUNK_CHARS) -> list[str]:
    """按段落窗口切长块，尽量不从一行中间切断语义。"""
    parts: list[str] = []
    current: list[str] = []
    current_len = 0

    for line in lines:
        projected = current_len + len(line) + (1 if current else 0)
        if current and projected > max_chars:
            parts.append("\n".join(current).strip())
            current = []
            current_len = 0
        if len(line) > max_chars:
            if current:
                parts.append("\n".join(current).strip())
                current = []
                current_len = 0
            parts.extend(split_text(line, chunk_size=max_chars, chunk_overlap=80))
            continue
        current.append(line)
        current_len += len(line) + (1 if current_len else 0)

    if current:
        parts.append("\n".join(current).strip())
    return [part for part in parts if part]


def _chunk_title(section: str, explicit_title: str, lines: list[str]) -> str:
    if explicit_title:
        return explicit_title.strip()
    if section in {
        "summary",
        "skills",
        "project_experience",
        "education",
        "achievements",
    }:
        return SECTION_LABELS[section]
    if lines:
        return lines[0][:60]
    return ""


def _join_labeled_fields(fields: list[tuple[str, str]]) -> str:
    """把结构化字段拼成适合入库和喂给 LLM 的文本。"""
    lines = [f"{label}：{value.strip()}" for label, value in fields if value.strip()]
    return "\n".join(lines).strip()


def _add_profile_chunk(
    chunks: list[ResumeChunk],
    *,
    section: str,
    title: str,
    text: str,
    keywords: list[str] | None = None,
) -> None:
    """把 profile 里的一个语义块追加为一个或多个 ResumeChunk。"""
    if not text.strip():
        return
    parts = _split_long_block(_normal_lines(text))
    for part_index, part in enumerate(parts, start=1):
        part_title = title
        if len(parts) > 1:
            part_title = f"{title} part-{part_index}"
        chunks.append(
            ResumeChunk(
                section=section,
                title=part_title,
                text=part,
                keywords=keywords or [],
                weight=SECTION_WEIGHTS.get(section, 1.0),
            )
        )


def chunks_from_resume_profile(profile: ResumeProfile) -> list[ResumeChunk]:
    """从 LLM 结构化简历 profile 生成向量化 chunks。"""
    chunks: list[ResumeChunk] = []

    _add_profile_chunk(
        chunks,
        section="summary",
        title="个人概况",
        text=profile.summary,
        keywords=profile.keywords,
    )
    _add_profile_chunk(
        chunks,
        section="skills",
        title="技能",
        text="、".join(profile.skills),
        keywords=profile.skills,
    )

    for item in profile.work_experience:
        title = " ".join(part for part in (item.company, item.role, item.period) if part)
        text = _join_labeled_fields(
            [
                ("公司", item.company),
                ("职位", item.role),
                ("时间", item.period),
                ("职责与成果", item.description),
            ]
        )
        _add_profile_chunk(
            chunks,
            section="work_experience",
            title=title or "工作经历",
            text=text,
            keywords=profile.keywords,
        )

    for item in profile.project_experience:
        text = _join_labeled_fields(
            [
                ("项目", item.name),
                ("背景", item.description),
                ("职责", item.responsibilities),
                ("成果", item.results),
                ("工具", "、".join(item.tools)),
            ]
        )
        _add_profile_chunk(
            chunks,
            section="project_experience",
            title=item.name or "项目经验",
            text=text,
            keywords=item.tools,
        )

    for item in profile.education:
        title = " ".join(part for part in (item.school, item.major, item.degree) if part)
        text = _join_labeled_fields(
            [
                ("学校", item.school),
                ("专业", item.major),
                ("学历", item.degree),
                ("时间", item.period),
            ]
        )
        _add_profile_chunk(
            chunks,
            section="education",
            title=title or "教育经历",
            text=text,
        )

    _add_profile_chunk(
        chunks,
        section="achievements",
        title="成果",
        text="\n".join(profile.achievements),
        keywords=profile.keywords,
    )

    for index, chunk in enumerate(chunks):
        chunk.index = index
    return chunks


def split_resume_structured(resume_text: str) -> list[ResumeChunk]:
    """把简历拆成结构化 chunk 后再向量化。

    有通用标题的简历会按 section 切分；没有明显标题的简历继续走旧的固定长度
    兜底切分，保证各种 PDF 提取结果都能入库。
    """
    lines = _normal_lines(resume_text)
    if not lines:
        return []

    sections, found_heading = _split_sections(lines)
    if not found_heading:
        return [
            ResumeChunk(
                section="fallback",
                title=f"片段 {i + 1}",
                text=chunk,
                weight=SECTION_WEIGHTS["fallback"],
                index=i,
            )
            for i, chunk in enumerate(split_text(resume_text))
        ]

    chunks: list[ResumeChunk] = []
    for section, section_lines in sections:
        if not section_lines:
            continue
        for block_title, block_lines in _split_item_blocks(section, section_lines):
            title = _chunk_title(section, block_title, block_lines)
            parts = _split_long_block(block_lines)
            for part_index, part in enumerate(parts, start=1):
                part_title = title
                if len(parts) > 1:
                    part_title = f"{title} part-{part_index}"
                chunks.append(
                    ResumeChunk(
                        section=section,
                        title=part_title,
                        text=part,
                        weight=SECTION_WEIGHTS.get(section, 1.0),
                    )
                )

    for index, chunk in enumerate(chunks):
        chunk.index = index
    return chunks


def resume_vectorstore_dir(
    resume_text: str,
    base_dir: str = "./vectorstores",
) -> Path:
    """返回简历对应的向量库目录。

    路径只由简历全文 hash 决定，不再按 chunk 方案增加版本后缀。
    """
    return Path(base_dir) / text_hash(resume_text)


class VectorStore:
    """Chroma collection 的轻量封装。"""

    def __init__(self, collection: chromadb.Collection):
        self._collection = collection

    def search(self, query: str, k: int = 4) -> list[str]:
        return [item["document"] for item in self.search_with_metadata(query, k=k)]

    def search_with_metadata(self, query: str, k: int = 4) -> list[dict]:
        query_embedding = _encode_texts([query])
        results = self._collection.query(
            query_embeddings=query_embedding,
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )
        documents = results.get("documents") or []
        metadatas = results.get("metadatas") or []
        distances = results.get("distances") or []
        docs = documents[0] if documents else []
        metas = metadatas[0] if metadatas else [{} for _ in docs]
        dists = distances[0] if distances else [None for _ in docs]
        return [
            {"document": doc, "metadata": meta or {}, "distance": dist}
            for doc, meta, dist in zip(docs, metas, dists)
        ]

    def check_relevance(self, query: str, distance_threshold: float = 1.3) -> tuple[bool, float]:
        """检查查询（如JD）与集合的最短距离。
        distance_threshold 默认1.3（经验值，基于 L2 距离，越小越相似）。
        如果所有 chunk 的距离都大于阈值，说明完全不相关，返回 False。
        """
        query_embedding = _encode_texts([query])
        results = self._collection.query(
            query_embeddings=query_embedding,
            n_results=3,
            include=["distances"],
        )
        distances = results.get("distances")
        if not distances or not distances[0]:
            return True, 0.0  # 没提取到 distance 就放行
        
        min_distance = min(distances[0])
        return min_distance <= distance_threshold, min_distance


def embed_resume(
    resume_text: str,
    base_dir: str = "./vectorstores",
    resume_profile: ResumeProfile | None = None,
) -> VectorStore:
    persist_dir = resume_vectorstore_dir(resume_text, base_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(persist_dir))
    existing = {c.name for c in client.list_collections()}

    if COLLECTION_NAME in existing:
        print("✅ 加载已存在向量库")
        collection = client.get_collection(COLLECTION_NAME)
    else:
        print("❌ 不存在向量库，重新向量化")
        chunks = (
            chunks_from_resume_profile(resume_profile)
            if resume_profile is not None
            else split_resume_structured(resume_text)
        )
        if not chunks:
            raise ValueError("No text extracted from resume")

        documents = [chunk.to_document() for chunk in chunks]
        embeddings = _encode_texts(documents)
        collection = client.create_collection(COLLECTION_NAME)
        collection.add(
            documents=documents,
            embeddings=embeddings,
            ids=[f"{chunk.section}-{chunk.index}" for chunk in chunks],
            metadatas=[chunk.to_metadata() for chunk in chunks],
        )
        print(f"✅ 已保存向量库到：{persist_dir}")

    return VectorStore(collection)
