# mvp_judge_service.py
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate
from ..core import BaseService

# mvp_judge_models.py
from typing import List
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from models.project_base import QA
import uuid


class QABase(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    # 必須
    question: str
    importance: int
    is_ai: bool
    project_id: Optional[str] = None  # UUID検証を削除してstr型に変更

    # 任意
    answer: Optional[str] = None
    source_doc_id: Optional[str] = None  # UUID検証を削除してstr型に変更
    follows_qa_id: Optional[str] = None  # UUID検証を削除してstr型に変更
    qa_id: Optional[str] = None  # UUID検証を削除してstr型に変更
    created_at: Optional[str] = None
    
class MVPJudge(BaseModel):
    mvp_feasible: bool                          # MVPを作れそうか
    score_0_100: int = Field(..., ge=0, le=100) # 総合点
    confidence: float = Field(..., ge=0.0, le=1.0) # 信頼度
    qa : List[QABase]  # 判定根拠のQ&Aリスト


PASS = 75      # 総合点の合格ライン
CONF_T = 0.70  # 信頼度の目安

class MVPJudgeService(BaseService):
    def __init__(self, db, default_model_provider: str = "google"):
        super().__init__(db=db, default_model_provider=default_model_provider)
        # 例: judgeは軽量モデルでもOK（必要時だけ重めに昇格）
        self.judge_llm = self.llm_flash.with_structured_output(MVPJudge)

    async def judge(self, requirements_text: str) -> MVPJudge:
        prompt = ChatPromptTemplate.from_template(
            self.get_prompt("mvp_service", "judge_mvp")  # TOMLにMVP_JUDGE_PROMPTを入れておく
        )
        chain = prompt | self.judge_llm
        return await chain.ainvoke({"requirements_text": requirements_text})
    
    
    def route_next(self, j: MVPJudge, project_id:str ) -> Dict[str, Any]:
        """
        返却フォーマットを統一:
        {
          "action": "proceed" | "ask_user",
          "judge": {...},  # MVPJudgeの中身
          "qa": [ { "question": str, "answer": Optional[str] }, ... ]  # 常に存在
        }
        """
        is_pass = (j.mvp_feasible and j.score_0_100 >= PASS)

        if is_pass and j.confidence >= CONF_T:
            action = True  # 次のステップへ進む
            return_qa = []
        else:
            action = False  # ユーザーに確認・修正を促す
            qa_list = [qa.model_dump() for qa in j.qa]

            return_qa = []
            # qaを
            for qa in qa_list:
                return_qa.append({
                    "question": qa.get("question"),
                    "answer": qa.get("answer") if qa.get("answer") not in ("", None) else None,
                    "importance": qa.get("importance"),
                    "is_ai": True if qa.get("answer") not in ("", None) else False,
                    "source_doc_id": None,
                    "project_id": project_id,
                    "follows_qa_id": None,
                    "qa_id": uuid.uuid4(),
                })
            # dbに保存する
            for qa in return_qa:
                # project_idをUUID型に変換
                if isinstance(qa["project_id"], str):
                    qa["project_id"] = uuid.UUID(qa["project_id"])
                self.db.add(QA(**qa))
            self.db.commit()


        score = j.score_0_100
        confidence = j.confidence

        return {
            "action": action,
            "judge": {
                "mvp_feasible": j.mvp_feasible,
                "score_0_100": score,
                "confidence": confidence,
            },
            "qa": return_qa
        }
    async def main(self, requirements_text: str, project_id: str) -> Dict[str, Any]:
        j = await self.judge(requirements_text=requirements_text)
        return self.route_next(j, project_id)

