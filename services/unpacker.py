from __future__ import annotations

import shutil
from pathlib import Path

from services.parser import generate_pdf_report, parse_directory


def extract_to_isolated_dir(
    archive_path: str | Path,
    target_base_dir: str | Path,
) -> Path:
    archive_file = Path(archive_path)
    base_dir = Path(target_base_dir)

    if not archive_file.is_file():
        raise FileNotFoundError(f"Архив не найден по пути: {archive_file}")

    base_dir.mkdir(parents=True, exist_ok=True)
    extraction_dir = base_dir / archive_file.stem
    extraction_dir.mkdir(parents=True, exist_ok=True)

    try:
        shutil.unpack_archive(str(archive_file), str(extraction_dir))
        return extraction_dir
    except Exception as exc:
        shutil.rmtree(extraction_dir, ignore_errors=True)
        raise RuntimeError(f"Ошибка при распаковке архива: {exc}") from exc


def build_packaged_report(
    archive_path: str | Path,
    unpack_base_dir: str | Path,
    report_basename: str,
) -> Path:
    try:
        extracted_dir = extract_to_isolated_dir(archive_path, unpack_base_dir)
        parse_results = parse_directory(extracted_dir)

        report_dir = Path("reports")
        report_dir.mkdir(parents=True, exist_ok=True)
        output_file_path = report_dir / f"{report_basename}.pdf"
        generate_pdf_report(parse_results, str(output_file_path))
        return output_file_path
    except Exception as exc:
        raise RuntimeError(f"Ошибка при создании отчета: {exc}") from exc
