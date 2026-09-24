"""
职位匹配模块：两层过滤
第一层：关键词匹配（粗筛）- 从简历自动提取关键词，与 JD 对比
第二层：LLM 评分（精筛）- 让 LLM 评估简历与 JD 的匹配度 0-100
"""
from __future__ import annotations

import functools
import hashlib
import json
import logging
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from pypdf import PdfReader

from boss_zhipin.audit.telemetry import record_llm_call
from boss_zhipin.models.llm import (
    _build_client,
    _call_chat_completion,
    _completion_content,
    current_provider_label,
)
from boss_zhipin.models.resume_profile import ResumeProfile

load_dotenv()
log = logging.getLogger(__name__)
PROFILE_MAX_TOKENS = 4096
_RESUME_PROFILE_NOT_PROVIDED = object()

# 预定义的职位类型关键词库，用于从简历中识别技能和方向已移除（完全使用动态提取）

@functools.lru_cache(maxsize=None)
def _keyword_pattern(keyword: str) -> re.Pattern[str]:
    """关键词 → 大小写不敏感的匹配 pattern。

    纯 ASCII 关键词（"Go" / "AI" / "API"...）加词边界约束，避免子串误报：
    "Go" 命中 "Google"、"AI" 命中 "Maintained"、"API" 命中 "Rapid"。
    首/尾是非字母数字的（".NET" / "C++"）只约束字母数字那一侧，
    保证 "ASP.NET"、"C++11" 仍能命中。含中文的关键词没有词边界概念，
    保留子串匹配。
    """
    escaped = re.escape(keyword)
    if keyword.isascii():
        if keyword[0].isalnum():
            escaped = r"(?<![A-Za-z0-9])" + escaped
        if keyword[-1].isalnum():
            escaped = escaped + r"(?![A-Za-z0-9])"
    return re.compile(escaped, re.IGNORECASE)


def _find_keywords(text: str, keywords: list[str]) -> list[str]:
    return [kw for kw in keywords if _keyword_pattern(kw).search(text)]


def extract_resume_text(pdf_path: str) -> str:
    """从 PDF 简历中提取全文文本。"""
    reader = PdfReader(pdf_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _text_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _profile_cache_file(resume_text: str) -> Path:
    return Path("vectorstores") / _text_hash(resume_text) / "resume_profile.json"


def _legacy_keywords_cache_file(resume_text: str) -> Path:
    return Path("vectorstores") / _text_hash(resume_text) / "keywords.json"


def _resume_profile_prompt(resume_text: str) -> str:
    """构造全量简历结构化解析 prompt。

    注意：这里故意不截断 resume_text。用户已经明确选择用完整简历交给 LLM 分析，
    让结构化 chunk 和关键词都来自同一次完整解析。
    """
    return f"""你是一位资深招聘顾问和简历分析专家。请完整阅读下面的简历全文，并把它整理成结构化 JSON。

必须遵守：
1. 只输出一个合法 JSON object，不要输出任何解释、前言、Markdown、```json 代码块或多余文字。
2. 必须使用下面固定字段名：summary、skills、work_experience、project_experience、education、achievements、keywords。
3. 只抽取简历中真实出现或能直接推断的信息，不要编造公司、项目、学历、成果、数字或工具。
4. 不确定的字段填空字符串或空数组。
5. 每段工作经历和项目经历都要尽量保留关键职责、成果、工具、业务方向和量化指标。
6. keywords 控制在 15-40 个，覆盖技能、工具、业务方向、岗位方向和重要成果，按重要性排序。
7. summary 控制在 80 个中文字以内。

输出 JSON 格式示例：
{{
  "summary": "候选人的简短职业概况，80字以内",
  "skills": ["技能或工具1", "技能或工具2"],
  "work_experience": [
    {{
      "company": "公司名称",
      "role": "职位名称",
      "period": "起止时间",
      "description": "主要职责和成果"
    }}
  ],
  "project_experience": [
    {{
      "name": "项目名称",
      "description": "项目背景和目标",
      "responsibilities": "候选人的职责",
      "results": "可量化成果或业务结果",
      "tools": ["工具或技术1", "工具或技术2"]
    }}
  ],
  "education": [
    {{
      "school": "学校",
      "major": "专业",
      "degree": "学历",
      "period": "时间"
    }}
  ],
  "achievements": ["成果1", "成果2"],
  "keywords": ["核心关键词1", "核心关键词2"]
}}

简历全文：
{resume_text}
"""


def _parse_resume_profile(content: str) -> ResumeProfile | None:
    """解析 LLM 返回的 ResumeProfile；不是纯 JSON 就判失败。"""
    try:
        data = json.loads(content.strip())
        return ResumeProfile.model_validate(data)
    except Exception as e:  # noqa: BLE001 - 解析失败统一走兜底
        log.warning("简历结构化 JSON 解析失败: %s", e)
        return None


def _load_cached_resume_profile(resume_text: str) -> ResumeProfile | None:
    cache_file = _profile_cache_file(resume_text)
    if not cache_file.exists():
        return None
    try:
        with cache_file.open("r", encoding="utf-8") as f:
            return ResumeProfile.model_validate(json.load(f))
    except Exception as e:  # noqa: BLE001 - 缓存坏了就重新解析
        log.warning("读取结构化简历缓存失败: %s", e)
        return None


def _save_resume_profile_cache(resume_text: str, profile: ResumeProfile) -> None:
    cache_file = _profile_cache_file(resume_text)
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with cache_file.open("w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, ensure_ascii=False, indent=2)
    except Exception as e:  # noqa: BLE001 - 缓存失败不影响主流程
        log.warning("保存结构化简历缓存失败: %s", e)


def _llm_extract_resume_profile(resume_text: str) -> ResumeProfile | None:
    """使用 LLM 对完整简历做结构化解析。"""
    try:
        client, llm_model = _build_client()
    except RuntimeError as e:
        # _build_client 对缺 key / 缺 model 都抛 RuntimeError——把真实 message
        # 透出来，别一律写成"LLM_API_KEY 未设置"误导用户去改错的变量。
        log.warning("LLM 未配置好，无法结构化解析简历：%s", e)
        return None

    try:
        response = _call_chat_completion(
            client,
            model=llm_model,
            messages=[{"role": "user", "content": _resume_profile_prompt(resume_text)}],
            temperature=0.1,
            max_tokens=PROFILE_MAX_TOKENS,
        )
        content = _completion_content(response)
        profile = _parse_resume_profile(content)
        if profile is not None:
            log.info("🎯 LLM 成功结构化解析简历，提取关键词 %d 个", len(profile.keywords))
            return profile
    except Exception as e:
        log.warning("LLM 结构化解析简历失败 (%s)，将走兜底方案", e)

    return None


def extract_resume_profile(resume_text: str) -> ResumeProfile | None:
    """读取或生成结构化简历 profile。"""
    cached = _load_cached_resume_profile(resume_text)
    if cached is not None:
        log.info("✅ 已从本地缓存读取结构化简历 profile")
        return cached

    profile = _llm_extract_resume_profile(resume_text)
    if profile is not None:
        _save_resume_profile_cache(resume_text, profile)
    return profile


def _load_legacy_keywords_cache(resume_text: str) -> list[str] | None:
    cache_file = _legacy_keywords_cache_file(resume_text)
    if not cache_file.exists():
        return None
    try:
        with cache_file.open("r", encoding="utf-8") as f:
            cached_keywords = json.load(f)
            if isinstance(cached_keywords, list) and all(
                isinstance(k, str) for k in cached_keywords
            ):
                log.info("✅ 已从本地缓存读取专属简历关键词（%d个）", len(cached_keywords))
                return cached_keywords
    except Exception as e:
        log.warning("读取缓存关键词失败: %s", e)
    return None


def _save_legacy_keywords_cache(resume_text: str, keywords: list[str]) -> None:
    cache_file = _legacy_keywords_cache_file(resume_text)
    try:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        with cache_file.open("w", encoding="utf-8") as f:
            json.dump(keywords, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning("保存缓存关键词失败: %s", e)


def keywords_from_resume_profile(profile: ResumeProfile | None) -> list[str]:
    if profile is None:
        return []
    return [keyword.strip() for keyword in profile.keywords if keyword.strip()]


def extract_keywords_from_text(
    resume_text: str,
    resume_profile: ResumeProfile | None | object = _RESUME_PROFILE_NOT_PROVIDED,
) -> list[str]:
    """从结构化简历 profile 中读取关键词，失败时回退旧关键词缓存。"""
    # 不传 resume_profile 时才主动解析；显式传入 None 表示上游已经尝试过且失败，
    # 这里直接走缓存兜底，避免一次运行里重复调用 LLM。
    profile = (
        extract_resume_profile(resume_text)
        if resume_profile is _RESUME_PROFILE_NOT_PROVIDED
        else resume_profile
    )
    keywords = keywords_from_resume_profile(
        profile if isinstance(profile, ResumeProfile) else None
    )
    if keywords:
        _save_legacy_keywords_cache(resume_text, keywords)
        return keywords

    cached_keywords = _load_legacy_keywords_cache(resume_text)
    return cached_keywords or []


def extract_keywords_from_resume(pdf_path: str) -> list[str]:
    """从简历 PDF 中自动提取关键词，大小写不敏感。"""
    return extract_keywords_from_text(extract_resume_text(pdf_path))


def keyword_match(
    job_description: str,
    resume_keywords: list[str],
    min_match: int = 2,
) -> tuple[bool, list[str]]:
    """第一层：关键词粗筛。JD 中至少命中 min_match 个简历关键词才通过。"""
    matched = _find_keywords(job_description, resume_keywords)
    return len(matched) >= min_match, matched


def llm_match_score(
    job_description: str,
    resume_text: str,
    matched_keywords: list[str],
) -> tuple[int, str, bool]:
    """第二层：LLM 精筛。评估简历与职位的匹配度。

    返回 ``(score, reason, degraded)``：

    - ``score`` 0-100；
    - ``reason`` 一句话说明；
    - ``degraded`` 是否走了 fail-open——评分链路任何一环不可用（缺配置 / 调用失败 /
      回复解析不出分数）都返回 ``(100, ..., True)`` 放行，宁可少过滤也不静默跳过。
      ``degraded=True`` 让上层能把"第二层过滤其实没在跑"显式告诉用户，而不是悄悄放行。
    """
    try:
        client, llm_model = _build_client()
    except RuntimeError as e:
        # 缺 key 或缺 model 都会到这——透出真实 message，别误导成只缺 key。
        log.warning("LLM 未配置好，跳过 LLM 评分：%s", e)
        return 100, "无法评分（LLM 未配置）", True
    prov = current_provider_label()

    prompt = f"""你是一位专业的招聘匹配分析师。请评估以下简历与职位描述的匹配程度。

## 职位描述
{job_description}

## 简历内容
{resume_text[:2000]}

## 已匹配的关键词
{', '.join(matched_keywords)}

## 要求
请严格按以下格式回复，不要包含任何其他内容：
分数: [0-100的整数]
理由: [一句话说明，不超过50字]

评分标准：
- 90-100: 技能和经验高度匹配，非常适合
- 70-89: 大部分技能匹配，值得投递
- 50-69: 部分匹配，可以尝试
- 0-49: 匹配度低，不建议投递"""

    # _call_chat_completion 自带指数退避重试；评分调用跟招呼语生成一样
    # 记 telemetry，不然每个职位多出来的这次调用成本不进 llm_calls.jsonl
    t0 = time.monotonic()
    try:
        response = _call_chat_completion(
            client,
            model=llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=200,
        )
    except Exception as e:
        record_llm_call(
            provider=prov, model=llm_model,
            input_tokens=0, output_tokens=0,
            latency_ms=int((time.monotonic() - t0) * 1000),
            ok=False, error=f"{type(e).__name__}: {e}",
        )
        log.warning("LLM 评分调用失败: %s", e)
        return 100, f"评分失败（{e}）", True

    content = _completion_content(response)
    usage = getattr(response, "usage", None)
    record_llm_call(
        provider=prov, model=llm_model,
        input_tokens=getattr(usage, "prompt_tokens", 0) if usage else 0,
        output_tokens=getattr(usage, "completion_tokens", 0) if usage else 0,
        latency_ms=int((time.monotonic() - t0) * 1000),
        ok=True,
    )

    # 冒号同时容忍 ASCII ":" 和全角 "："——中文 LLM（尤其 DeepSeek）即便 prompt
    # 给的是 ASCII 冒号，回复也常用全角。只认 ASCII 会让解析静默失败 → fail-open
    # 恒返 100 → 第二层 LLM 过滤被悄悄绕过。
    score_match = re.search(r"分数[:：]\s*(\d+)", content)
    if not score_match:
        # LLM 没按格式回复时同样 fail-open；fail-closed（按 0 分算）
        # 会把职位静默跳过，且日志里看不出原因
        log.warning("LLM 评分回复解析失败，按 100 放行。回复内容: %r", content[:200])
        return 100, "评分解析失败", True

    score = min(100, max(0, int(score_match.group(1))))
    reason_match = re.search(r"理由[:：]\s*(.+)", content)
    reason = reason_match.group(1).strip() if reason_match else ""
    return score, reason, False


def should_apply(
    job_description: str,
    resume_keywords: list[str],
    resume_text: str,
    min_keyword_match: int = 2,
    min_llm_score: int = 70,
    exclude_keywords: list[str] | None = None,
    vectorstore=None,
) -> tuple[bool, dict]:
    """多层过滤：黑名单 -> 关键词粗筛 -> 向量语义粗筛 -> LLM 精筛。"""
    
    if exclude_keywords:
        for ex_kw in exclude_keywords:
            if _keyword_pattern(ex_kw).search(job_description):
                return False, {
                    "stage": "blacklist",
                    "reason": f"命中黑名单关键词: {ex_kw}",
                }

    if resume_keywords:
        keyword_passed, matched_keywords = keyword_match(
            job_description, resume_keywords, min_keyword_match
        )

        if not keyword_passed:
            return False, {
                "stage": "keyword",
                "matched_keywords": matched_keywords,
                "reason": f"关键词匹配不足（命中 {len(matched_keywords)}/{min_keyword_match}）",
            }
    else:
        matched_keywords = []

    if vectorstore is not None:
        is_relevant, distance = vectorstore.check_relevance(job_description)
        if not is_relevant:
            return False, {
                "stage": "vector_search",
                "reason": f"语义匹配度过低 (距离 {distance:.2f} > 阈值)",
            }
        else:
            log.debug("语义距离验证通过 (距离: %.2f)", distance)

    score, reason, degraded = llm_match_score(job_description, resume_text, matched_keywords)

    return score >= min_llm_score, {
        "stage": "llm",
        "matched_keywords": matched_keywords,
        "score": score,
        "reason": reason,
        "threshold": min_llm_score,
        # True = 评分走了 fail-open（没真评成），上层据此提示"第二层过滤暂时没在跑"
        "scoring_degraded": degraded,
    }
