"""结构化简历数据模型。

这里只放纯数据结构，不 import LLM 或向量化模块，避免业务模块之间形成循环依赖。
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WorkExperience(BaseModel):
    model_config = ConfigDict(extra="ignore")

    company: str = ""
    role: str = ""
    period: str = ""
    description: str = ""


class ProjectExperience(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    description: str = ""
    responsibilities: str = ""
    results: str = ""
    tools: list[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    school: str = ""
    major: str = ""
    degree: str = ""
    period: str = ""


class ResumeProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    work_experience: list[WorkExperience] = Field(default_factory=list)
    project_experience: list[ProjectExperience] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
