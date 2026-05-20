import base64
import mimetypes

from app.core.config import Settings
from app.schemas.openai import VisionExtraction
from app.services.openai.client import create_openai_client
from app.services.openai.structured_outputs import parse_json_output, strict_json_schema


VISION_EXTRACTION_PROMPTS = {
    "ja": """あなたはSnapBrainの画像記憶整理エンジンです。
必ず指定されたJSON schemaに一致するJSONだけを返してください。

出力方針:
- visible_text: 画像内に実際に見える文字をできるだけ忠実に転記する。UI文、コード、エラー文は翻訳せず原文を残す。
- visual_summary: 画像の内容、UI、画面状態、文脈を自然な日本語で説明する。
- likely_context: このスクショ/画像が保存された理由を日本語で短く推定する。
- entities: 人名、サービス名、プロダクト名、エラー名、日付、識別子などを抽出する。
- tags: 日本語中心の短いタグにする。ただし固有名詞は原文を維持する。
- time_hints/action_items: 日本語で書く。
- confidence: 見えている情報に基づく信頼度。

見えていない事実は作らないでください。""",
    "en": """You are SnapBrain's image memory organization engine.
Return only JSON that matches the provided schema.

Output rules:
- visible_text: transcribe text that is actually visible in the image as faithfully as possible. Do not translate UI text, code, or error messages.
- visual_summary: describe the image, UI, screen state, and context in natural English.
- likely_context: briefly explain in English why this screenshot/image may have been saved.
- entities: extract people, services, product names, error names, dates, and identifiers.
- tags: short English tags. Keep proper nouns as written.
- time_hints/action_items: write in English.
- confidence: confidence based only on visible evidence.

Do not invent facts that are not visible or strongly implied.""",
}


class OpenAIVisionService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = create_openai_client(settings)

    def extract_image_memory(
        self,
        *,
        image_bytes: bytes,
        filename: str | None,
        mime_type: str | None,
        locale: str = "ja",
    ) -> VisionExtraction:
        content_type = mime_type or mimetypes.guess_type(filename or "")[0] or "image/png"
        image_base64 = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{content_type};base64,{image_base64}"
        prompt = VISION_EXTRACTION_PROMPTS["ja" if locale == "ja" else "en"]

        response = self.client.responses.create(
            model=self.settings.openai_vision_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": data_url},
                    ],
                }
            ],
            text={"format": strict_json_schema(VisionExtraction, name="vision_extraction")},
        )
        return parse_json_output(response.output_text, VisionExtraction)
