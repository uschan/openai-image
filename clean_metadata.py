#!/usr/bin/env python3
"""
图片元数据清理工具 v1.2
- 批量清理当前文件夹中所有图片的元数据（EXIF、XMP、IPTC、AI生成水印等）
- 持久化清理记录，重启后跳过已清理图片，只处理新增/未处理文件
- 监听文件夹，新图片加入时自动清理
依赖安装：pip install Pillow watchdog
"""

import hashlib
import io
import json
import logging
import shutil
import struct
import sys
import time
import argparse
from pathlib import Path

# ── ANSI 颜色 ────────────────────────────────────────────────────────────────
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    CYAN    = "\033[36m"
    LCYAN   = "\033[96m"
    WHITE   = "\033[97m"
    GRAY    = "\033[90m"
    YELLOW  = "\033[93m"
    GREEN   = "\033[92m"

    @staticmethod
    def supported() -> bool:
        return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    return f"{code}{text}{C.RESET}" if C.supported() else text


def _typewrite(text: str, delay: float = 0.018) -> None:
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\n")
    sys.stdout.flush()


def _scan_line(width: int = 62, char: str = "─", delay: float = 0.008) -> None:
    bar = ""
    for _ in range(width):
        bar += char
        sys.stdout.write(f"\r  {_c(C.CYAN, bar)}")
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\n")
    sys.stdout.flush()


def show_banner() -> None:
    LOGO_LINES = [
        r"  __      __.__.__       .___  _________      .__   __   ",
        r" /  \    /  \__|  |    __| _/ /   _____/____  |  |_/  |_ ",
        r" \   \/\/   /  |  |   / __ |  \_____  \\__  \ |  |\   __\ ",
        r"  \        /|  |  |__/ /_/ |  /        \/ __ \|  |_|  |  ",
        r"   \__/\  / |__|____/\____ | /_______  (____  /____/__|  ",
        r"        \/                \/         \/     \/           ",
    ]
    TAGLINE = " >>> IMAGE SENTINEL | Powered by WildSalt | v1.2 <<<"
    use_color = C.supported()
    print()
    colors = [C.CYAN, C.LCYAN, C.CYAN, C.LCYAN, C.CYAN, C.LCYAN]
    for i, line in enumerate(LOGO_LINES):
        sys.stdout.write((f"{C.BOLD}{colors[i]}{line}{C.RESET}\n") if use_color else (line + "\n"))
        sys.stdout.flush()
        time.sleep(0.055)
    print()
    if use_color:
        parts = TAGLINE.split("|")
        colored = (
            _c(C.YELLOW + C.BOLD, parts[0].rstrip())
            + " " + _c(C.GRAY, "|") + " "
            + _c(C.WHITE + C.BOLD, parts[1].strip())
            + " " + _c(C.GRAY, "|") + " "
            + _c(C.YELLOW + C.BOLD, parts[2].lstrip())
        )
        _typewrite(colored, delay=0.022)
    else:
        _typewrite(TAGLINE, delay=0.022)
    print()
    _scan_line()
    status_lines = [
        ("  ◈ EXIF / XMP / IPTC 元数据清除",       C.GREEN),
        ("  ◈ AI 生成水印 & C2PA 标记剥离",         C.GREEN),
        ("  ◈ JPEG / PNG 低级字节段重建",           C.GREEN),
        ("  ◈ 持久化记录，重启自动跳过已清理图片",   C.CYAN),
        ("  ◈ 实时文件夹监听守护",                   C.CYAN),
    ]
    for text, color in status_lines:
        sys.stdout.write((f"{color}{text}{C.RESET}\n") if use_color else (text + "\n"))
        sys.stdout.flush()
        time.sleep(0.07)
    print()
    _scan_line()
    print()


# ── 日志配置 ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("clean_meta")

# ── 常量 ─────────────────────────────────────────────────────────────────────
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".bmp", ".gif"}
REGISTRY_NAME = ".sentinel_cleaned.json"   # 隐藏文件，存放在目标文件夹内


# ────────────────────────────────────────────────────────────────────────────
# 持久化清理注册表
# ────────────────────────────────────────────────────────────────────────────

class CleanRegistry:
    """
    用文件内容的 SHA-1 哈希来标识「已清理」状态。

    核心逻辑：
      1. 清理前：计算文件当前 SHA-1
           - 若哈希已在表中 → 该文件内容已是清理后状态，跳过
           - 若哈希不在表中 → 文件未被处理（或内容有变），执行清理
      2. 清理后：计算清理后内容的 SHA-1，写入注册表持久化

    存储格式（JSON）：
    {
      "<sha1_of_clean_content>": {
        "path": "relative/path/img.jpg",    // 仅供人类阅读
        "cleaned_at": "2025-05-01T12:34:56"
      }
    }
    """

    def __init__(self, folder: Path) -> None:
        self._folder = folder
        self._path   = folder / REGISTRY_NAME
        self._data: dict = {}
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text(encoding="utf-8"))
                log.info(
                    f"📋 已加载清理记录：{len(self._data)} 条  "
                    f"({self._path.name})"
                )
            except Exception as e:
                log.warning(f"清理记录损坏，重新建立: {e}")
                self._data = {}

    def _save(self) -> None:
        try:
            self._path.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            log.warning(f"无法写入清理记录: {e}")

    # ── 公开接口 ──────────────────────────────────────────────────────────────

    @staticmethod
    def _sha1(data: bytes) -> str:
        return hashlib.sha1(data, usedforsecurity=False).hexdigest()

    @staticmethod
    def hash_file(path: Path) -> str | None:
        """读取文件内容并返回 SHA-1；失败返回 None。"""
        try:
            return CleanRegistry._sha1(path.read_bytes())
        except Exception:
            return None

    def is_cleaned(self, path: Path) -> bool:
        """文件当前内容的哈希已在注册表中 → 视为已清理，无需重复处理。"""
        h = self.hash_file(path)
        return h is not None and h in self._data

    def mark_cleaned(self, path: Path, clean_data: bytes) -> None:
        """将清理后内容的哈希写入注册表并持久化。"""
        from datetime import datetime
        h = self._sha1(clean_data)
        try:
            rel = str(path.relative_to(self._folder))
        except ValueError:
            rel = path.name
        self._data[h] = {
            "path":       rel,
            "cleaned_at": datetime.now().isoformat(timespec="seconds"),
        }
        self._save()

    def count(self) -> int:
        return len(self._data)


# ────────────────────────────────────────────────────────────────────────────
# 低级字节清理（Pillow 的二次保险）
# ────────────────────────────────────────────────────────────────────────────

def _strip_png_chunks(data: bytes) -> bytes:
    """重建 PNG，只保留图像渲染必要块，丢弃所有元数据块。"""
    PNG_SIG = b"\x89PNG\r\n\x1a\n"
    KEEP = {b"IHDR", b"IDAT", b"IEND", b"PLTE", b"tRNS", b"acTL", b"fcTL", b"fdAT"}
    if not data.startswith(PNG_SIG):
        return data
    out = bytearray(PNG_SIG)
    pos = 8
    while pos + 12 <= len(data):
        length     = struct.unpack(">I", data[pos:pos+4])[0]
        chunk_type = data[pos+4:pos+8]
        end        = pos + 12 + length
        if chunk_type in KEEP:
            out += data[pos:end]
        pos = end
    return bytes(out)


def _strip_jpeg_segments(data: bytes) -> bytes:
    """重建 JPEG，丢弃所有 APP / COM 元数据段。"""
    KEEP_MARKERS = set(range(0xC0, 0xE0)) | {0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF}
    out = bytearray()
    i   = 0
    while i < len(data):
        if data[i] != 0xFF:
            out.append(data[i]); i += 1; continue
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]; i += 1
        if marker == 0x00:
            out += b"\xFF\x00"; continue
        if marker in (0xD8, 0xD9) or (0xD0 <= marker <= 0xD7):
            out += bytes([0xFF, marker])
            if marker == 0xD9: break
            continue
        if i + 2 > len(data): break
        seg_len  = struct.unpack(">H", data[i:i+2])[0]
        seg_data = data[i:i+seg_len]; i += seg_len
        if marker == 0xDA:
            out += bytes([0xFF, marker]) + seg_data + data[i:]; break
        if marker in KEEP_MARKERS:
            out += bytes([0xFF, marker]) + seg_data
    return bytes(out)


# ────────────────────────────────────────────────────────────────────────────
# 单文件清理
# ────────────────────────────────────────────────────────────────────────────

def clean_image(
    src: Path,
    registry: CleanRegistry,
    backup: bool = False,
    force: bool = False,
) -> str:
    """
    清理单张图片元数据。
    返回值：'skipped' | 'cleaned' | 'failed'
    """
    # ── 跳过检查 ─────────────────────────────────────────────────────────────
    if not force and registry.is_cleaned(src):
        log.debug(f"  ↷ 跳过（已清理）: {src.name}")
        return "skipped"

    try:
        data = src.read_bytes()
    except Exception as e:
        log.warning(f"读取失败 {src.name}: {e}")
        return "failed"

    ext = src.suffix.lower()

    # ── Pillow 主清理 ─────────────────────────────────────────────────────────
    try:
        from PIL import Image
        with Image.open(io.BytesIO(data)) as img:
            mode = img.mode
            if mode in ("P", "PA"):
                img = img.convert("RGBA" if "A" in mode else "RGB")
            fmt = img.format or ext.lstrip(".").upper()
            if fmt == "JPG":
                fmt = "JPEG"
            buf = io.BytesIO()
            kw  = {}
            if fmt == "JPEG":   kw = {"quality": 95, "subsampling": 0}
            elif fmt == "PNG":  kw = {"compress_level": 6}
            elif fmt == "WEBP": kw = {"quality": 95, "method": 6}
            img.save(buf, format=fmt, **kw)
        clean_data = buf.getvalue()
    except ImportError:
        log.error("Pillow 未安装，请运行: pip install Pillow")
        return "failed"
    except Exception as e:
        log.warning(f"Pillow 处理失败 {src.name}: {e}，回退到低级清理…")
        clean_data = data

    # ── 低级段二次清理 ────────────────────────────────────────────────────────
    if ext in (".jpg", ".jpeg"):
        clean_data = _strip_jpeg_segments(clean_data)
    elif ext == ".png":
        clean_data = _strip_png_chunks(clean_data)

    # ── 备份 ─────────────────────────────────────────────────────────────────
    if backup:
        try:
            shutil.copy2(src, src.with_suffix(src.suffix + ".bak"))
        except Exception as e:
            log.warning(f"备份失败 {src.name}: {e}")

    # ── 写回 ─────────────────────────────────────────────────────────────────
    try:
        src.write_bytes(clean_data)
        saved = len(data) - len(clean_data)
        log.info(f"✓ 已清理  {src.name}  (节省 {saved:+,} bytes)")
    except Exception as e:
        log.error(f"写入失败 {src.name}: {e}")
        return "failed"

    # ── 登记到注册表 ──────────────────────────────────────────────────────────
    registry.mark_cleaned(src, clean_data)
    return "cleaned"


# ────────────────────────────────────────────────────────────────────────────
# 批量处理
# ────────────────────────────────────────────────────────────────────────────

def batch_clean(
    folder: Path,
    registry: CleanRegistry,
    backup: bool = False,
    recursive: bool = False,
    force: bool = False,
) -> None:
    """扫描文件夹，跳过已清理文件，只处理未清理/新增图片。"""
    pattern = "**/*" if recursive else "*"
    images  = [
        p for p in folder.glob(pattern)
        if p.is_file()
        and p.suffix.lower() in SUPPORTED_EXT
        and not p.name.endswith(".bak")
        and p.name != REGISTRY_NAME
    ]

    if not images:
        log.info("当前文件夹中未找到支持的图片文件。")
        return

    # 预分类（快速，不读文件内容）
    need   = [p for p in images if force or not registry.is_cleaned(p)]
    skip_n = len(images) - len(need)

    if skip_n:
        log.info(f"↷  跳过已清理: {skip_n} 张")
    if not need:
        log.info("✅ 所有图片均已清理，无需重复处理。")
        return

    log.info(f"🔍 待清理: {len(need)} 张，开始处理…")
    ok = fail = 0
    for img in need:
        r = clean_image(img, registry, backup=backup, force=force)
        if r == "cleaned":
            ok += 1
        elif r == "failed":
            fail += 1

    log.info(f"完成：本次清理 {ok} 张，失败 {fail} 张。"
             f"  (注册表累计 {registry.count()} 条)")


# ────────────────────────────────────────────────────────────────────────────
# 文件夹监听
# ────────────────────────────────────────────────────────────────────────────

def watch_folder(
    folder: Path,
    registry: CleanRegistry,
    backup: bool = False,
    recursive: bool = False,
) -> None:
    """持续监听文件夹，新图片出现时自动清理（已清理过的跳过）。"""
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        log.error("watchdog 未安装，请运行: pip install watchdog")
        sys.exit(1)

    def _wait_stable(path: Path) -> bool:
        """等待文件写入完成（大小稳定）。"""
        time.sleep(0.5)
        for _ in range(10):
            try:
                s = path.stat().st_size
                time.sleep(0.3)
                if path.stat().st_size == s:
                    return True
            except FileNotFoundError:
                return False
        return True

    def _handle(path: Path, label: str) -> None:
        if path.suffix.lower() not in SUPPORTED_EXT:
            return
        if path.name in (REGISTRY_NAME,) or path.name.endswith(".bak"):
            return
        if not _wait_stable(path):
            return
        if registry.is_cleaned(path):
            log.debug(f"  ↷ 跳过（已清理）: {path.name}")
            return
        log.info(f"→ 检测到{label}: {path.name}")
        clean_image(path, registry, backup=backup)

    class ImageHandler(FileSystemEventHandler):
        def on_created(self, event):
            if not event.is_directory:
                _handle(Path(event.src_path), "新图片")

        def on_moved(self, event):
            if not event.is_directory:
                _handle(Path(event.dest_path), "移入图片")

    observer = Observer()
    observer.schedule(ImageHandler(), str(folder), recursive=recursive)
    observer.start()
    log.info(f"👁  正在监听: {folder}  (已记录 {registry.count()} 张清理过的图片)")
    log.info("按 Ctrl+C 停止监听。")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("停止监听。")
    finally:
        observer.stop()
        observer.join()


# ────────────────────────────────────────────────────────────────────────────
# 入口
# ────────────────────────────────────────────────────────────────────────────

def main() -> None:
    show_banner()

    parser = argparse.ArgumentParser(description="图片元数据清理工具（含 AI 水印，持久化去重）")
    parser.add_argument("dir", nargs="?", default="downloads/image", help="目标文件夹（默认 downloads/image）")
    parser.add_argument("--no-watch", action="store_true", help="仅批量清理，不启动监听")
    parser.add_argument("--force", action="store_true", help="忽略已清理记录，强制重新处理所有图片")
    parser.add_argument("--backup", action="store_true", help="清理前保存 .bak 备份")
    args = parser.parse_args()

    folder = Path(args.dir).resolve()
    if not folder.is_dir():
        log.error(f"目录不存在: {folder}")
        sys.exit(1)

    try:
        import PIL
    except ImportError:
        log.error("缺少依赖 Pillow，请运行: pip install Pillow watchdog")
        sys.exit(1)

    registry = CleanRegistry(folder)

    if not args.no_watch:
        batch_clean(folder, registry, backup=args.backup, recursive=True, force=args.force)

    if not args.no_watch:
        watch_folder(folder, registry, backup=args.backup, recursive=True)


if __name__ == "__main__":
    main()