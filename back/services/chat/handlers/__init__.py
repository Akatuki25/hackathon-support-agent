"""
ページ固有のチャットハンドラ

各ハンドラは BaseChatHandler を継承し、ChatRouter に登録される。
"""

from .qa_advice_handler import QAAdviceHandler
from .function_handler import FunctionHandler
from .function_summary_handler import FunctionSummaryHandler
from .spec_review_handler import SpecReviewHandler
from .framework_handler import FrameworkHandler
from .kanban_handler import KanbanHandler
from .task_detail_handler import TaskDetailHandler

__all__ = [
    "QAAdviceHandler",
    "FunctionHandler",
    "FunctionSummaryHandler",
    "SpecReviewHandler",
    "FrameworkHandler",
    "KanbanHandler",
    "TaskDetailHandler",
]
