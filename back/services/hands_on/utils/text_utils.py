"""
テキスト処理ユーティリティ
"""

from typing import List


def chunk_text(text: str, chunk_size: int = 5) -> List[str]:
    """
    テキストをチャンクに分割（ストリーミング用）

    Args:
        text: 分割対象のテキスト
        chunk_size: 1チャンクあたりの文字数

    Returns:
        チャンクのリスト
    """
    words = list(text)
    return [
        "".join(words[i:i + chunk_size])
        for i in range(0, len(words), chunk_size)
    ]
