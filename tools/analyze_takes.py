#!/opt/homebrew/bin/python3.9
"""Conta takes fixos (master/reframe) de um episódio.
Uso: python3.9 tools/analyze_takes.py <video> [--fps 2]
Método: fronteiras de plano por histograma+dhash (limiares altos para
ignorar flashes/shake); agrupamento de setups por fundo (hist grosseiro)
+ hash. Mesmo setup + ângulo diferente = reframe.
"""

import sys

import cv2
import numpy as np

CUT_HIST = 0.55
CUT_HASH = 32
MERGE_UNDER = 1.0
GROUP_HIST = 0.30
GROUP_HASH = 24


def dhash(gray):
    small = cv2.resize(gray, (17, 16), interpolation=cv2.INTER_AREA)
    diff = small[:, 1:] > small[:, :-1]
    return int.from_bytes(np.packbits(diff.flatten()).tobytes(), "big")


def hamming(a, b):
    return bin(a ^ b).count("1")


def avg_hist(hists):
    m = np.mean(np.stack(hists), axis=0)
    cv2.normalize(m, m)
    return m


def main():
    path = sys.argv[1]
    fps = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(src_fps / fps)))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    dur = total / src_fps if src_fps else 0
    print(f"video: {dur:.1f}s, amostra 1 frame em {step} ({fps}/s)")

    prev_hist, prev_hash, cur, shots = None, None, None, []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            t = idx / src_fps
            small = cv2.resize(frame, (64, 64))
            hist = cv2.calcHist([small], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)
            cv2.normalize(hist, hist)
            h = dhash(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
            cut = False
            if prev_hist is not None:
                dh = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
                cut = dh > CUT_HIST or hamming(prev_hash, h) > CUT_HASH
            if cut or cur is None:
                if cur is not None:
                    shots.append(cur)
                cur = {"start": t, "hashes": [h], "hists": [hist], "n": 1}
            else:
                cur["hashes"].append(h)
                cur["hists"].append(hist)
                cur["n"] += 1
            prev_hist, prev_hash = hist, h
        idx += 1
    if cur is not None:
        shots.append(cur)
    cap.release()

    merged = []
    for s in shots:
        s["end"] = s["start"] + s["n"] / fps
        s["ahist"] = avg_hist(s["hists"])
        if merged and (s["end"] - s["start"]) < MERGE_UNDER:
            m0 = merged[-1]
            m0["end"] = s["end"]
            m0["hashes"] += s["hashes"]
            m0["ahist"] = avg_hist(m0["hists"] + s["hists"])
            m0["hists"] += s["hists"]
        else:
            merged.append(s)

    groups = []
    for s in merged:
        med = sorted(s["hashes"])[len(s["hashes"]) // 2]
        placed = False
        for g in groups:
            dh = cv2.compareHist(s["ahist"], g["ahist"], cv2.HISTCMP_BHATTACHARYYA)
            if dh < GROUP_HIST and hamming(med, g["rep"]) <= GROUP_HASH:
                g["takes"].append(s)
                placed = True
                break
        if not placed:
            groups.append({"rep": med, "ahist": s["ahist"], "takes": [s]})

    print(f"\nTAKES: {len(merged)} | SETUPS distintos: {len(groups)}")
    for i, s in enumerate(merged, 1):
        print(f"  take {i:3d}: {s['start']:6.1f}s - {s['end']:6.1f}s  ({s['end']-s['start']:4.1f}s)")
    print("\nSETUPS com reframes (mesmo espaço, outro ângulo):")
    multi = [g for g in groups if len(g["takes"]) > 1]
    for g in sorted(multi, key=lambda g: min(s["start"] for s in g["takes"])):
        ids = sorted([merged.index(s) + 1 for s in g["takes"]])
        print(f"  takes {ids} -> MASTER+{len(ids)-1} reframe(s)")
    if not multi:
        print("  (nenhum — cada take num setup único)")
    durs = sorted([s["end"] - s["start"] for s in merged])
    mid = durs[len(durs) // 2] if durs else 0
    print(f"\nresumo: {len(merged)} takes em {dur:.0f}s, {len(groups)} setups, "
          f"{len(merged)-len(groups)} reframes, mediana {mid:.1f}s/take")


if __name__ == "__main__":
    main()
