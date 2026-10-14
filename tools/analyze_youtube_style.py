#!/usr/bin/env python3
"""Analisa clips de referencia no YouTube e gera regras de estilo para o Nano Banana.

Fluxo: download (yt-dlp, primeiros N segundos) -> extracao de frames-chave
desduplicados (cv2) -> analise multimodal (Gemini) -> escreve/atualiza
``context/style/dynamic-rm-analysis.md``, que o backend anexa ao prompt
de geracao de imagem.

Uso:
    pip install -r tools/requirements-style.txt
    export GEMINI_API_KEY=...   # ou definir no ficheiro .env da raiz
    python3 tools/analyze_youtube_style.py
    python3 tools/analyze_youtube_style.py --video <url> --dry-run   # so frames, sem LLM
"""

from __future__ import annotations

import argparse
import base64
import datetime
import os
import shutil
import subprocess
import sys
import tempfile

# ---------------------------------------------------------------------------
# Passo A: Configuracao de alvos
# ---------------------------------------------------------------------------

TARGET_VIDEOS = [
    "https://www.youtube.com/watch?v=UTdfxFyOQTI",  # Rick and Morty S01E01 Clip
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # Placeholder para teste
]
CLIP_DURATION_SECONDS = 60  # Analisar apenas os primeiros 60s (poupar tokens/tempo)
FRAME_INTERVAL_MS = 500  # Capturar um frame a cada 0.5 segundos
OUTPUT_FILE = "context/style/dynamic-rm-analysis.md"
MODEL_FOR_ANALYSIS = "gemini-2.5-flash"  # Rapido e barato para analise massiva de frames

# Limites de seguranca (custo/tempo)
MAX_FRAMES_FOR_LLM = 16  # Max. de frames enviados ao Gemini por video
DEDUP_HAMMING_THRESHOLD = 6  # Distancia de hash abaixo da qual o frame e duplicado
FRAME_MAX_WIDTH = 768  # Reduzir frames antes de enviar (poupar tokens)
FRAME_JPEG_QUALITY = 80

ANALYSIS_PROMPT = """You are an animation art director. Analyze these frames from an animated TV show clip.
Extract precise, reusable IMAGE-GENERATION rules (not a plot summary) under exactly these sections:

1. DOMINANT VS SECONDARY PALETTE: list dominant hues with rough coverage (e.g. background 60%), secondary/accent hues, saturation level, background vs character temperature contrast.
2. OUTLINE WEIGHT AND VARIATION: contour thickness in px-equivalent at 1K, uniform vs tapered, outer vs inner line treatment, how outlines behave on faces vs props.
3. LIGHTING PATTERNS: flat shading vs gradients, cel-shadow steps (1 or 2), rim light presence/width, hard vs soft shadows, highlight shapes (round, streak, none).
4. FACIAL ANATOMY AND EXAGGERATION: eye/mouth construction, squash-and-stretch range, signature expressions (panic, deadpan, smug), teeth/wrinkle/sweat-drop conventions.
5. SCENE COMPOSITION: rule-of-thirds usage, false depth tricks (overlapping cels, blurred foreground, gradient skies), background detail density vs character focus, typical camera framings (WS/MS/CU).

Be concrete and quantitative. End with a 5-line CONDENSED PROMPT BLOCK: comma-separated style tokens ready to append to a text-to-image prompt, 16:9 TV cartoon, no real people."""


def repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_dotenv_shim(root: str) -> None:
    """Le .env da raiz sem dependencias externas (nao sobrescreve o ambiente)."""
    env_path = os.path.join(root, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=False, capture_output=True, text=True)


def download_clip(url: str, clip_seconds: int, workdir: str) -> str:
    """Descarrega os primeiros `clip_seconds` do video. Devolve o caminho do ficheiro."""
    section = f"*00:00-00:{clip_seconds:02d}"
    template = os.path.join(workdir, "%(id)s.%(ext)s")
    yt_dlp_bin = shutil.which("yt-dlp")
    if yt_dlp_bin:
        cmd = [
            yt_dlp_bin, "--no-playlist",
            "--download-sections", section, "--force-keyframes-at-cuts",
            "-f", "bv*[height<=720]+ba/b[height<=720]/b",
            "-o", template, url,
        ]
    else:
        # Fallback: modulo Python (mesma dependencia, sem binario no PATH)
        try:
            import yt_dlp  # noqa: F401
        except ImportError:
            sys.exit("ERRO: yt-dlp nao encontrado. Instala com: pip install -r tools/requirements-style.txt")
        cmd = [
            sys.executable, "-m", "yt_dlp", "--no-playlist",
            "--download-sections", section, "--force-keyframes-at-cuts",
            "-f", "bv*[height<=720]+ba/b[height<=720]/b",
            "-o", template, url,
        ]
    proc = run(cmd)
    if proc.returncode != 0:
        sys.exit(f"ERRO no download de {url}:\n{proc.stderr[-2000:]}")
    files = [os.path.join(workdir, f) for f in os.listdir(workdir)
             if os.path.isfile(os.path.join(workdir, f))]
    videos = [f for f in files if not f.endswith((".part", ".ytdl", ".json", ".jpg", ".png"))]
    if not videos:
        sys.exit(f"ERRO: nenhum ficheiro de video produzido para {url}.")
    return sorted(videos, key=os.path.getsize, reverse=True)[0]


def dhash(gray) -> int:
    """Hash percetivo 64-bit (diferencas horizontais numa miniatura 17x16)."""
    import cv2
    import numpy as np
    small = cv2.resize(gray, (17, 16), interpolation=cv2.INTER_AREA)
    diff = small[:, 1:] > small[:, :-1]
    return int(np.packbits(diff.flatten()).tobytes().hex(), 16)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def extract_keyframes(video_path: str, interval_ms: int, clip_seconds: int,
                      frames_dir: str) -> list[dict]:
    """Amostra frames por timestamp, remove duplicados via dHash, reduz e grava JPEG."""
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        sys.exit(f"ERRO: cv2 nao conseguiu abrir {video_path} (falta ffmpeg?).")
    os.makedirs(frames_dir, exist_ok=True)
    kept: list[dict] = []
    seen_hashes: list[int] = []
    t_ms = 0
    idx = 0
    while t_ms < clip_seconds * 1000:
        cap.set(cv2.CAP_PROP_POS_MSEC, t_ms)
        ok, frame = cap.read()
        if not ok or frame is None:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h = dhash(gray)
        if any(hamming(h, prev) <= DEDUP_HAMMING_THRESHOLD for prev in seen_hashes):
            t_ms += interval_ms
            continue
        seen_hashes.append(h)
        height, width = frame.shape[:2]
        if width > FRAME_MAX_WIDTH:
            scale = FRAME_MAX_WIDTH / width
            frame = cv2.resize(frame, (FRAME_MAX_WIDTH, int(height * scale)),
                               interpolation=cv2.INTER_AREA)
        out = os.path.join(frames_dir, f"frame_{idx:03d}_t{t_ms}ms.jpg")
        cv2.imwrite(out, frame, [cv2.IMWRITE_JPEG_QUALITY, FRAME_JPEG_QUALITY])
        kept.append({"path": out, "t_ms": t_ms})
        idx += 1
        t_ms += interval_ms
    cap.release()
    print(f"frames amostrados: {idx} unicos em {clip_seconds}s (intervalo {interval_ms}ms)", flush=True)
    return kept


def analyze_frames_with_gemini(frames: list[dict], model: str) -> str:
    """Envia frames ao Gemini e devolve a analise Markdown."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "replace_with_your_real_key_here":
        sys.exit("ERRO: GEMINI_API_KEY em falta. Define no ambiente ou no .env da raiz.")
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        sys.exit("ERRO: SDK google-genai em falta. Instala com: pip install -r tools/requirements-style.txt")
    client = genai.Client(api_key=api_key)
    selected = frames[:MAX_FRAMES_FOR_LLM]
    print(f"a enviar {len(selected)} frames para {model}...", flush=True)
    parts = []
    for fr in selected:
        with open(fr["path"], "rb") as f:
            data = f.read()
        parts.append(types.Part.from_bytes(data=data, mime_type="image/jpeg"))
    response = client.models.generate_content(
        model=model,
        contents=[ANALYSIS_PROMPT, *parts],
    )
    text = getattr(response, "text", "") or ""
    if not text.strip():
        sys.exit("ERRO: o modelo devolveu analise vazia.")
    return text.strip()


def write_output(output_path: str, analyses: list[dict], model: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Dynamic Style Analysis — Rick & Morty Reference",
        "",
        f"_Gerado por `tools/analyze_youtube_style.py` em {now} com `{model}`._",
        "_O backend anexa este ficheiro ao prompt do Nano Banana. Edicoes manuais sao",
        "preservadas ate a proxima execucao do script._",
        "",
    ]
    for a in analyses:
        lines += [f"## Fonte: {a['url']}", ""]
        lines += [f"- Frames unicos extraidos: {a['n_frames']}"]
        if a.get("note"):
            lines += [f"- Nota: {a['note']}"]
        lines += ["", a["body"], ""]
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")
    print(f"escrito: {output_path}", flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Analisa clips do YouTube para regras de estilo Nano Banana.")
    p.add_argument("--video", action="append", default=[], help="URL do YouTube (repetivel; substitui TARGET_VIDEOS).")
    p.add_argument("--clip-seconds", type=int, default=CLIP_DURATION_SECONDS)
    p.add_argument("--interval-ms", type=int, default=FRAME_INTERVAL_MS)
    p.add_argument("--output", default=OUTPUT_FILE, help="Caminho relativo a raiz do repo.")
    p.add_argument("--model", default=MODEL_FOR_ANALYSIS)
    p.add_argument("--dry-run", action="store_true", help="Extrai frames mas nao chama o Gemini.")
    p.add_argument("--keep-work", action="store_true", help="Nao apaga videos/frames temporarios.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    root = repo_root()
    load_dotenv_shim(root)
    urls = args.video or TARGET_VIDEOS
    output_path = args.output if os.path.isabs(args.output) else os.path.join(root, args.output)

    workdir = tempfile.mkdtemp(prefix="rm-style-")
    print(f"workdir: {workdir}", flush=True)
    analyses: list[dict] = []
    try:
        for url in urls:
            print(f"\n=== {url} ===", flush=True)
            video_path = download_clip(url, args.clip_seconds, workdir)
            frames_dir = os.path.join(workdir, "frames",
                                      base64.urlsafe_b64encode(url.encode()).decode()[:12])
            frames = extract_keyframes(video_path, args.interval_ms, args.clip_seconds, frames_dir)
            if not frames:
                print("AVISO: sem frames extraidos, a saltar.", flush=True)
                continue
            if args.dry_run:
                body = "_dry-run: frames extraidos, analise LLM omitida._"
                note = f"frames em {frames_dir}"
            else:
                body = analyze_frames_with_gemini(frames, args.model)
                note = None
            analyses.append({"url": url, "n_frames": len(frames), "body": body, "note": note})
    finally:
        if not args.keep_work and not args.dry_run:
            shutil.rmtree(workdir, ignore_errors=True)
        else:
            print(f"workdir preservado: {workdir}", flush=True)

    if not analyses:
        sys.exit("ERRO: nenhuma analise produzida.")
    write_output(output_path, analyses, args.model)


if __name__ == "__main__":
    main()
