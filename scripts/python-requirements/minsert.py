"""Dynamic content insertion in markdown files."""

import logging
import os
import re
from typing import Dict, Union


class MinsertConfig:
    """Configure tokens for minsert."""

    # pylint: disable=too-few-public-methods
    START = "start"
    END = "end"
    SEP = ":"
    COMMENT_START = "<!--"
    COMMENT_END = "-->"


MARKER_PATTERN = re.compile(
    r"^<!--\s*(start|end)\s+([A-Za-z0-9_.-]+)\s*-->$"
)


def is_comment(line: str) -> bool:
    """Check if a line is a valid markdown comment."""
    line = line.strip()
    if line.startswith(MinsertConfig.COMMENT_START) and line.endswith(
        MinsertConfig.COMMENT_END
    ):
        return True
    return False


def is_starter(line: str) -> Union[str, None]:
    """Return the name of the block if the line is a starter, else None."""
    match = MARKER_PATTERN.fullmatch(line.strip())
    if match and match.group(1) == MinsertConfig.START:
        return match.group(2)
    return None


def is_ender(line: str) -> bool:
    """Check if the line is a block ender."""
    match = MARKER_PATTERN.fullmatch(line.strip())
    return bool(match and match.group(1) == MinsertConfig.END)


def get_ender_name(line: str) -> Union[str, None]:
    """Return the name of the block if the line is an ender, else None."""
    match = MARKER_PATTERN.fullmatch(line.strip())
    if match and match.group(1) == MinsertConfig.END:
        return match.group(2)
    return None


class MarkdownFile:
    """Wrapper for markdown file."""

    # pylint: disable=too-few-public-methods
    def __init__(self, file_path: str) -> None:
        """Initialize Markdownfile object.

        Args:
            file_path (str): path of markdown file.
        """
        if os.path.isfile(file_path) and file_path.endswith(".md"):
            self.file_path = file_path
        else:
            raise FileNotFoundError("the path you gave is invalid")

    def insert(self, things: Dict[str, str]):
        """Dynamically insert content in markdown file."""
        new_lines = []
        with open(self.file_path) as file:
            lines = file.readlines()

        inside_a_block = None
        count = 0

        for line in lines:
            if not inside_a_block:
                new_lines.append(line)
                count += 1
                start_of = is_starter(line)
                if not start_of:
                    continue
                if start_of not in things:
                    logging.warning(
                        "\t '%s' in line %i of %s not found.",
                        start_of,
                        count,
                        self.file_path,
                    )
                    continue
                content_lines = things[start_of].split("\n")
                count += len(content_lines)
                content = [ln + "\n" for ln in content_lines]
                new_lines += content
                inside_a_block = start_of
            elif get_ender_name(line) == inside_a_block:
                new_lines.append(line)
                count += 1
                inside_a_block = None
            elif is_ender(line):
                raise ValueError(
                    f"block '{inside_a_block}' closed by mismatched marker: "
                    f"{line.strip()}"
                )
            else:
                continue

        if inside_a_block:
            raise ValueError(f"block '{inside_a_block}' not closed")

        with open(self.file_path, "w") as file:
            file.writelines(new_lines)
