"""Append-only storage for VRChat hour readings."""

import csv
from pathlib import Path


FIELDNAMES = ("recorded_at", "main_hours", "afk_hours")


def append_history_row(filename, recorded_at, main_hours, afk_hours):
    """Append a reading when either account's hours changed."""
    path = Path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)

    latest = None
    if path.exists():
        with path.open(newline="") as history_file:
            reader = csv.DictReader(history_file)
            if tuple(reader.fieldnames or ()) != FIELDNAMES:
                raise ValueError(
                    f"{filename} must use the columns: {', '.join(FIELDNAMES)}"
                )
            for latest in reader:
                pass

    if latest and (
        float(latest["main_hours"]) == main_hours
        and float(latest["afk_hours"]) == afk_hours
    ):
        return False

    write_header = not path.exists()
    with path.open("a", newline="") as history_file:
        writer = csv.DictWriter(history_file, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()
        writer.writerow(
            {
                "recorded_at": recorded_at,
                "main_hours": f"{main_hours:.1f}",
                "afk_hours": f"{afk_hours:.1f}",
            }
        )
    return True
