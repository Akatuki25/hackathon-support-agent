# mvp_judge_service.py
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate
from .base_service import BaseService

# mvp_judge_models.py
from typing import List
from pydantic import BaseModel, Field


class MVPJudge(BaseModel):
    mvp_feasible: bool                          # MVPを作れそうか
    score_0_100: int = Field(..., ge=0, le=100) # 総合点
    confidence: float = Field(..., ge=0.0, le=1.0)
    must_haves: List[str]                       # MVPで必須（抜けてたら指摘）
    blockers: List[str]                         # これが塞がると作れない（法務/PII/API未決等）
    missing_items: List[str]                    # 足りない情報
    followup_questions: List[str]               # 人に返すときの具体質問
    reasons: List[str]                          # 判定理由（短文）


PASS = 75      # 総合点の合格ライン
CONF_T = 0.70  # 信頼度の目安

class MVPJudgeService(BaseService):
    def __init__(self, db, default_model_provider: str = "google"):
        super().__init__(db=db, defult_model_provider=default_model_provider)
        # 例: judgeは軽量モデルでもOK（必要時だけ重めに昇格）
        self.judge_llm = self.llm_flash.with_structured_output(MVPJudge)

    def judge(self, requirements_text: str) -> MVPJudge:
        prompt = ChatPromptTemplate.from_template(
            self.get_prompt("mvp_service", "judge_mvp")  # TOMLにMVP_JUDGE_PROMPTを入れておく
        )
        chain = prompt | self.judge_llm
        return chain.invoke({"requirements_text": requirements_text})

    def route_next(self, j: MVPJudge) -> Dict[str, Any]:
        """LLM判定をもとに次アクションを返す"""
        if j.mvp_feasible and j.score_0_100 >= PASS and j.confidence >= CONF_T and not j.blockers:
            return {
                "action": "proceed",  # 次の工程へ（設計/実装スケルトン生成など）
                "judge": j.model_dump()
            }
        else:
            # 人へQAを返す（UIでそのまま質問表示）
            return {
                "action": "ask_user",
                "judge": j.model_dump(),
                "questions": j.followup_questions,
                "missing_items": j.missing_items,
                "blockers": j.blockers
            }

    # 1ターン分をまとめたヘルパ
    def judge_and_route(self, requirements_text: str) -> Dict[str, Any]:
        j: MVPJudge = self.judge(requirements_text)
        return self.route_next(j)
