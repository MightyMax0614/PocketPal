#!/usr/bin/env python3
"""Adapt a PocketPal character job v2 folder to the img2threejs bridge.

The current img2threejs deterministic scripts accept one primary reference image.
This adapter uses the required front view as that primary reference and records
optional side/back views for the later agent-vision review pass. It does not
claim that the deterministic stage alone has fused all views into a full mesh.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from img2threejs_bridge import process_job


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"파일을 찾을 수 없습니다: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON 형식이 올바르지 않습니다: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise RuntimeError("job JSON 최상위 값은 객체여야 합니다.")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_optional_view(job_dir: Path, value: Any) -> Path | None:
    if not value:
        return None
    path = (job_dir / str(value)).resolve()
    return path if path.is_file() else None


def prepare_v2_job(job_dir: Path) -> dict[str, Any]:
    job_path = job_dir / "job.json"
    job = read_json(job_path)

    if str(job.get("schema_version")) != "2.0":
        raise RuntimeError("character_job_v2_adapter.py는 schema_version 2.0 작업만 처리합니다.")

    inputs = job.get("inputs")
    if not isinstance(inputs, dict):
        raise RuntimeError("inputs 객체가 없습니다.")

    front_name = str(inputs.get("front_image") or "").strip()
    if not front_name:
        raise RuntimeError("inputs.front_image가 없습니다.")

    front_path = (job_dir / front_name).resolve()
    if not front_path.is_file():
        raise RuntimeError(f"정면 이미지를 찾을 수 없습니다: {front_path}")

    side_path = resolve_optional_view(job_dir, inputs.get("side_image"))
    back_path = resolve_optional_view(job_dir, inputs.get("back_image"))

    # The existing bridge expects source_image at the job root. Keep all V2
    # fields and add this compatibility field rather than downgrading the job.
    job["source_image"] = front_name
    job["status"] = "queued" if job.get("status") in {None, "queued", "failed"} else job["status"]
    job["adapter"] = {
        "name": "character_job_v2_adapter",
        "prepared_at": utc_now(),
        "primary_reference": front_name,
        "side_reference": side_path.name if side_path else None,
        "back_reference": back_path.name if back_path else None,
        "multiview_mode": "agent_review_inputs",
        "note": (
            "현재 deterministic img2threejs 단계는 정면을 기본 참조로 사용합니다. "
            "측면과 뒷면은 생성 후 에이전트 시각 검토 및 보정에 사용해야 합니다."
        ),
    }
    write_json(job_path, job)

    review_lines = [
        "# PocketPal multi-view review inputs",
        "",
        f"- Front (primary): `{front_name}`",
        f"- Side: `{side_path.name}`" if side_path else "- Side: not provided; estimation required",
        f"- Back: `{back_path.name}`" if back_path else "- Back: not provided; estimation required",
        "",
        "The deterministic factory is generated from the front reference. During",
        "the img2threejs agent review, compare the model against every provided",
        "view and correct head depth, body volume, limbs, ears, tail, markings,",
        "and unseen surfaces before exporting the final GLB.",
        "",
    ]
    (job_dir / "MULTIVIEW_REVIEW.md").write_text("\n".join(review_lines), encoding="utf-8")
    return job


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PocketPal 캐릭터 job v2를 img2threejs 브리지로 전달합니다.")
    parser.add_argument("job_dir", type=Path, help="job.json과 front.png 등이 들어 있는 폴더")
    parser.add_argument("--skill-root", type=Path, required=True, help="clone한 img2threejs 저장소 또는 skill 루트")
    parser.add_argument("--python", default=sys.executable, help="img2threejs 실행 Python")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    job_dir = args.job_dir.resolve()
    try:
        prepare_v2_job(job_dir)
        process_job(job_dir, args.skill_root, args.python)
        print("V2 작업 준비 및 deterministic factory 생성 단계가 완료되었습니다.")
        print("MULTIVIEW_REVIEW.md와 result/NEXT_STEP.md에 따라 시각 검토를 계속하세요.")
        return 0
    except Exception as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
