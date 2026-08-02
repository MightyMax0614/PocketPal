#!/usr/bin/env python3
"""PocketPal job.json -> img2threejs deterministic pipeline bridge.

This bridge runs the documented img2threejs Python stages that prepare an
assessment, sculpt spec, strict-quality validation, and a TypeScript Three.js
factory. It does not replace the agent-vision review loop; the output remains
`processing` until a reviewed browser module or GLB/GLTF result is produced.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ALLOWED_INPUT_STATUSES = {"queued", "failed"}


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
        raise RuntimeError(f"JSON 최상위 값은 객체여야 합니다: {path}")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_job(job_path: Path, job: dict[str, Any], **changes: Any) -> None:
    job.update(changes)
    job["updated_at"] = utc_now()
    write_json(job_path, job)


def run_command(command: list[str], *, cwd: Path, log_file: Path) -> None:
    printable = " ".join(str(part) for part in command)
    with log_file.open("a", encoding="utf-8") as log:
        log.write(f"\n$ {printable}\n")
        process = subprocess.run(
            command,
            cwd=str(cwd),
            text=True,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
        log.write(f"[exit={process.returncode}]\n")

    if process.returncode != 0:
        raise RuntimeError(f"명령 실행 실패(exit={process.returncode}): {printable}")


def required_script(skill_root: Path, relative_path: str) -> Path:
    script = skill_root / relative_path
    if not script.is_file():
        raise RuntimeError(f"img2threejs 스크립트를 찾을 수 없습니다: {script}")
    return script


def validate_job(job: dict[str, Any], job_dir: Path) -> tuple[str, Path]:
    job_id = str(job.get("job_id") or "").strip()
    if not job_id:
        raise RuntimeError("job_id가 없습니다.")

    status = str(job.get("status") or "queued")
    if status not in ALLOWED_INPUT_STATUSES:
        raise RuntimeError(
            f"현재 상태({status})에서는 시작할 수 없습니다. 허용 상태: {sorted(ALLOWED_INPUT_STATUSES)}"
        )

    source_name = str(job.get("source_image") or "source.png")
    source_path = (job_dir / source_name).resolve()
    if not source_path.is_file():
        raise RuntimeError(f"원본 이미지를 찾을 수 없습니다: {source_path}")

    return job_id, source_path


def write_next_step(result_dir: Path, factory_path: Path) -> None:
    text = f"""# Next step: agent visual review

The deterministic img2threejs stages produced:

- `{factory_path.name}`
- `assessment.json`
- `spec.json`

This is not yet a finished PocketPal character. Run the img2threejs skill with
the original reference image and review the generated model side by side.
Request a browser-ready ES module exporting one of these factory names:

- `createPocketPalModel`
- `createModel`
- default export

The factory must return a `THREE.Object3D`. Then place the compiled module in a
web-accessible results folder and open:

```text
viewer-3d.html?module=/results/<job_id>/createModel.js
```

A GLB result can instead be opened with:

```text
viewer-3d.html?model=/results/<job_id>/model.glb
```
"""
    (result_dir / "NEXT_STEP.md").write_text(text, encoding="utf-8")


def process_job(job_dir: Path, skill_root: Path, python_executable: str) -> None:
    job_dir = job_dir.resolve()
    skill_root = skill_root.resolve()
    job_path = job_dir / "job.json"
    job = read_json(job_path)
    job_id, source_path = validate_job(job, job_dir)

    result_dir = job_dir / "result"
    result_dir.mkdir(parents=True, exist_ok=True)
    log_file = result_dir / "bridge.log"
    log_file.write_text(
        f"PocketPal img2threejs bridge\njob_id={job_id}\nstarted_at={utc_now()}\n",
        encoding="utf-8",
    )

    assessment_path = result_dir / "assessment.json"
    spec_path = result_dir / "spec.json"
    factory_path = result_dir / "createModel.ts"
    subject_name = str(job.get("character_name") or job_id)

    probe_script = required_script(skill_root, "forge/stage1_intake/probe_image.py")
    assessment_script = required_script(skill_root, "forge/stage2_spec/new_pre_spec_assessment.py")
    spec_script = required_script(skill_root, "forge/stage2_spec/new_sculpt_spec.py")
    validate_script = required_script(skill_root, "forge/stage2_spec/validate_sculpt_spec.py")
    factory_script = required_script(skill_root, "forge/stage3_build/generate_threejs_factory.py")

    update_job(
        job_path,
        job,
        status="processing",
        stage="intake",
        started_at=utc_now(),
        processor="img2threejs_bridge",
    )

    try:
        run_command([python_executable, str(probe_script), str(source_path)], cwd=skill_root, log_file=log_file)

        update_job(job_path, job, status="processing", stage="assessment")
        run_command(
            [
                python_executable,
                str(assessment_script),
                subject_name,
                "--image",
                str(source_path),
                "--out",
                str(assessment_path),
            ],
            cwd=skill_root,
            log_file=log_file,
        )

        update_job(job_path, job, status="processing", stage="spec")
        run_command(
            [
                python_executable,
                str(spec_script),
                subject_name,
                "--image",
                str(source_path),
                "--assessment",
                str(assessment_path),
                "--out",
                str(spec_path),
            ],
            cwd=skill_root,
            log_file=log_file,
        )

        update_job(job_path, job, status="processing", stage="strict_quality_validation")
        run_command(
            [python_executable, str(validate_script), str(spec_path), "--strict-quality"],
            cwd=skill_root,
            log_file=log_file,
        )

        update_job(job_path, job, status="processing", stage="factory_generation")
        run_command(
            [
                python_executable,
                str(factory_script),
                str(spec_path),
                "--out",
                str(factory_path),
            ],
            cwd=skill_root,
            log_file=log_file,
        )

        write_next_step(result_dir, factory_path)
        meta = {
            "job_id": job_id,
            "status": "processing",
            "stage": "factory_generated_agent_review_required",
            "result_type": "procedural_threejs_typescript",
            "assessment_file": "assessment.json",
            "spec_file": "spec.json",
            "model_file": "createModel.ts",
            "log_file": "bridge.log",
            "completed_deterministic_stages_at": utc_now(),
            "notes": "에이전트의 이미지 비교, 수정, 브라우저용 JS 빌드가 남아 있습니다.",
        }
        write_json(result_dir / "meta.json", meta)
        update_job(
            job_path,
            job,
            status="processing",
            stage="factory_generated_agent_review_required",
            result_dir="result",
        )
        print(f"준비 완료: {factory_path}")
        print("다음 단계: result/NEXT_STEP.md에 따라 에이전트 검토와 JS 빌드를 진행하세요.")

    except Exception as exc:
        with log_file.open("a", encoding="utf-8") as log:
            log.write("\n[bridge failure]\n")
            log.write(traceback.format_exc())
        update_job(
            job_path,
            job,
            status="failed",
            stage="bridge_failed",
            error=str(exc),
            failed_at=utc_now(),
        )
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PocketPal job을 img2threejs 파이프라인에 전달합니다.")
    parser.add_argument("job_dir", type=Path, help="job.json과 source.png가 들어 있는 폴더")
    parser.add_argument(
        "--skill-root",
        type=Path,
        required=True,
        help="clone한 img2threejs 저장소 또는 skill 루트",
    )
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="img2threejs 스크립트 실행에 사용할 Python (기본: 현재 Python)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        process_job(args.job_dir, args.skill_root, args.python)
        return 0
    except Exception as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
