"""Record the fly-in curses TUI, frame by frame, for the web replay.

Runs the project's own TerminalUI.draw() on a fake screen, so the web
shows exactly what the terminal shows. Run from the fly-in root:

    uv run python <this file> <out.js>
"""
import curses
import json
import sys
from pathlib import Path

sys.path.insert(0, ".")
from src.__main__ import FlyInApplication  # noqa: E402
from src.tui import CURSES_COLOR, HEADER_ROWS, FOOTER_ROWS, TerminalUI  # noqa: E402

MIN_COLS, MIN_ROWS, STEPS = 160, 30, 16  # STEPS samples per turn
PAIRS = list(CURSES_COLOR)  # pair index - 1 -> color name


class Screen:
    """The curses calls TerminalUI.draw() makes, on a char grid."""

    def __init__(self, rows, cols):
        self.rows, self.cols = rows, cols
        self.erase()

    def getmaxyx(self):
        return self.rows, self.cols

    def erase(self):
        self.ch = [[" "] * self.cols for _ in range(self.rows)]
        self.at = [[0] * self.cols for _ in range(self.rows)]

    def addnstr(self, row, col, text, n, attr=0):
        for i, c in enumerate(text[:n]):
            if col + i < self.cols:
                self.ch[row][col + i], self.at[row][col + i] = c, attr

    def refresh(self):
        pass


def code(attr):
    """curses attr -> compact int: pair | bold<<4 | dim<<5 | reverse<<6."""
    return (((attr & curses.A_COLOR) >> 8)
            | bool(attr & curses.A_BOLD) << 4
            | bool(attr & curses.A_DIM) << 5
            | bool(attr & curses.A_REVERSE) << 6)


def record(path, rows_table, index):
    map_data, _, log = FlyInApplication.load(path)
    ui = TerminalUI(map_data, log, path=path)
    ui._pairs = {n: i << 8 for i, n in enumerate(PAIRS, start=1)}
    rows = max(MIN_ROWS, ui._layout.min_height + HEADER_ROWS + FOOTER_ROWS)
    cols = max(MIN_COLS, ui._layout.min_width + 2)  # the TUI's own minimum
    scr = Screen(rows, cols)
    frames, prev = [], None
    times = [0.0] + [n - 1 + k / STEPS
                     for n in range(1, ui._last + 1)
                     for k in range(1, STEPS + 1)]
    for t in times:
        ui._t = t
        ui.draw(scr)
        ids = []
        for r in range(rows):
            text = "".join(scr.ch[r])
            runs, start = [], 0
            for c in range(1, cols + 1):
                if c == cols or code(scr.at[r][c]) != code(scr.at[r][start]):
                    if code(scr.at[r][start]):
                        runs.append([start, c - start, code(scr.at[r][start])])
                    start = c
            key = json.dumps([text.rstrip(), runs], ensure_ascii=False)
            if key not in index:
                index[key] = len(rows_table)
                rows_table.append([text.rstrip(), runs])
            ids.append(index[key])
        if ids != prev:
            frames.append([round(t, 4), ids])
            prev = ids
    return {"rows": rows, "cols": cols, "last": ui._last, "frames": frames}


def main(out):
    root = Path("data/maps")
    rows_table, index, maps = [], {}, []
    for p in sorted(root.rglob("*.txt")):
        rel = p.relative_to(root)
        m = record(p, rows_table, index)
        m.update(id=str(rel.with_suffix("")), level=rel.parts[0],
                 name=rel.stem.split("_", 1)[1].replace("_", " "))
        maps.append(m)
        print(m["id"], m["last"], "turns", len(m["frames"]), "frames")
    data = {"pairs": PAIRS, "lines": rows_table, "maps": maps}
    Path(out).write_text(
        "// recorded from src/tui.py of fly-in by tools/flyin_tui_export.py\n"
        "window.FLYIN_TUI = " + json.dumps(data, ensure_ascii=False,
                                          separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main(sys.argv[1])
