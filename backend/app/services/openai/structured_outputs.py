import json
from typing import TypeVar

from pydantic import BaseModel, ValidationError

SchemaModel = TypeVar("SchemaModel", bound=BaseModel)


def strict_json_schema(model: type[BaseModel], *, name: str) -> dict:
    schema = model.model_json_schema()
    _strictify_object_schemas(schema)
    return {
        "type": "json_schema",
        "name": name,
        "strict": True,
        "schema": schema,
    }


def _strictify_object_schemas(schema: dict) -> None:
    if schema.get("type") == "object":
        properties = schema.get("properties") or {}
        schema["required"] = list(properties.keys())
        schema["additionalProperties"] = False
        for value in properties.values():
            if isinstance(value, dict):
                _strictify_object_schemas(value)

    for key in ("$defs", "definitions"):
        for value in (schema.get(key) or {}).values():
            if isinstance(value, dict):
                _strictify_object_schemas(value)

    items = schema.get("items")
    if isinstance(items, dict):
        _strictify_object_schemas(items)

    for option in schema.get("anyOf") or []:
        if isinstance(option, dict):
            _strictify_object_schemas(option)


def parse_json_output(raw_text: str, model: type[SchemaModel]) -> SchemaModel:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("OpenAI response was not valid JSON") from exc

    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("OpenAI response failed Pydantic validation") from exc
