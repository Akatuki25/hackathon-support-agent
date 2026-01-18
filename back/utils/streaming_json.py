"""
汎用ストリーミングJSON パーサ

LLMのストリーミング出力からJSONオブジェクトを順次抽出する。
NDJSON（1行=1オブジェクト）とJSON配列の両方に対応。

Usage:
    emitter = IncrementalJsonEmitter(mode="ndjson")
    for chunk in llm_stream:
        for obj in emitter.feed(chunk):
            # objは確定したJSONオブジェクト
            validated = MyPydanticModel.model_validate(obj)
            yield validated
"""

import json
from typing import Iterable, Literal, Generator

Mode = Literal["ndjson", "json_array"]


class IncrementalJsonEmitter:
    """
    feed(text) を呼ぶたびに、確定した JSON object を順次 yield する。

    Modes:
        - ndjson: 1行 = 1 JSON オブジェクト（推奨）
        - json_array: [obj1, obj2, ...] 形式の配列
    """

    def __init__(self, mode: Mode = "ndjson"):
        self.mode = mode
        self.buf = ""
        self.decoder = json.JSONDecoder()
        self.pos = 0
        self.started = False  # for json_array
        self._fence_stripped = False

    def _strip_code_fence_once(self) -> None:
        """モデルが ```json を混ぜる事故対策（プロトコルで禁止しても保険）"""
        if self._fence_stripped:
            return
        b = self.buf.lstrip()
        if b.startswith("```"):
            # 先頭フェンス除去
            self.buf = b.split("\n", 1)[1] if "\n" in b else ""
        self._fence_stripped = True

    def feed(self, text: str) -> Generator[dict, None, None]:
        """
        テキストチャンクを受け取り、確定したJSONオブジェクトをyieldする。

        Args:
            text: LLMから受け取ったテキストチャンク

        Yields:
            確定したJSONオブジェクト（dict）
        """
        if not text:
            return
        self.buf += text
        self._strip_code_fence_once()

        if self.mode == "ndjson":
            yield from self._feed_ndjson()
        else:
            yield from self._feed_json_array()

    def _feed_ndjson(self) -> Generator[dict, None, None]:
        """NDJSON モード: 改行単位で確定"""
        while True:
            nl = self.buf.find("\n")
            if nl == -1:
                break
            line = self.buf[:nl].strip()
            self.buf = self.buf[nl + 1:]
            if not line:
                continue
            try:
                obj = json.loads(line)
                yield obj
            except json.JSONDecodeError:
                # 不正な行はスキップ（ログに残すなら追加）
                continue

    def _feed_json_array(self) -> Generator[dict, None, None]:
        """JSON配列モード: 配列要素を順次抽出"""
        # 配列開始を待つ
        if not self.started:
            i = self.buf.find("[")
            if i == -1:
                return
            self.started = True
            self.pos = i + 1

        while True:
            # 空白・カンマを飛ばす
            while self.pos < len(self.buf) and self.buf[self.pos] in " \r\n\t,":
                self.pos += 1
            if self.pos >= len(self.buf):
                break
            if self.buf[self.pos] == "]":
                # 完了
                return

            try:
                obj, end = self.decoder.raw_decode(self.buf, self.pos)
            except json.JSONDecodeError:
                break  # 次チャンク待ち
            self.pos = end
            yield obj

            # バッファ肥大防止
            if self.pos > 4096:
                self.buf = self.buf[self.pos:]
                self.pos = 0

    def flush(self) -> Generator[dict, None, None]:
        """
        残りのバッファを処理して最後のオブジェクトを取得。
        ストリーム終了時に呼び出す。
        """
        if self.mode == "ndjson":
            # 最後の行（改行なし）を処理
            line = self.buf.strip()
            if line:
                try:
                    # 末尾のコードフェンスを除去
                    if line.endswith("```"):
                        line = line[:-3].strip()
                    obj = json.loads(line)
                    yield obj
                except json.JSONDecodeError:
                    pass
        self.buf = ""


def sse_event(event: str, data: dict) -> bytes:
    """
    Server-Sent Events 形式のイベントを生成する。

    Args:
        event: イベント名（例: "qa", "done", "error"）
        data: イベントデータ（dictはJSONに変換される）

    Returns:
        SSE形式のバイト列
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")
