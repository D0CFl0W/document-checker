import shutil
import uuid
from pathlib import Path
from services.parser import res

def extract_to_isolated_dir(archive_path: str, target_base_dir: str) -> Path:
    """
    Распаковывает архив в новую уникальную директорию,
    которая создается внутри указанной базовой директории.

    :param archive_path: Путь к исходному архиву (например, .zip или .tar.gz)
    :param target_base_dir: Путь к директории, куда будет сохранена новая папка с файлами
    :return: Path объект, указывающий на новосозданную директорию с файлами
    """
    archive_file = Path(archive_path)
    base_dir = Path(target_base_dir)

    # 1. Проверяем, существует ли архив
    if not archive_file.exists() or not archive_file.is_file():
        raise FileNotFoundError(f"Архив не найден по пути: {archive_file}")

    # 2. Создаем базовую директорию, если её еще нет
    base_dir.mkdir(parents=True, exist_ok=True)

    # 3. Генерируем имя для новой папки (Имя архива + уникальный UUID для защиты от перезаписи)
    # Например: documents_bundle_a1b2c3d4
    unique_folder_name = f"{archive_file.stem}"
    new_extraction_dir = base_dir / unique_folder_name

    # 4. Создаем эту новую директорию
    new_extraction_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 5. Распаковываем архив в созданную директорию
        shutil.unpack_archive(str(archive_file), str(new_extraction_dir))
        return new_extraction_dir

    except Exception as e:
        # Если при распаковке произошла ошибка, удаляем созданную папку, чтобы не оставлять мусор
        shutil.rmtree(new_extraction_dir, ignore_errors=True)
        raise RuntimeError(f"Ошибка при распаковке архива: {str(e)}")

def outputing_file(archive_path: str, target_base_dir: str):
    try:
        dir = extract_to_isolated_dir(archive_path, target_base_dir)
        print(dir)
        zxc = res(f"{dir}")
        print(123)
        return zxc
    except Exception:
        raiseRuntimeError(f"Undef errror")
