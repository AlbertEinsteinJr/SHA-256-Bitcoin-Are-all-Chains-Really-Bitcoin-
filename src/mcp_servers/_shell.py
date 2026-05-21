"""Shell, filesystem, and process tools.

Cross-platform stdlib-only. All paths are passed through verbatim — the
caller is responsible for not pointing them at sensitive data. Per the
FAILSAFE-only permission model, we don't gate writes or kills.
"""

from __future__ import annotations

import os
import shlex
import signal
import subprocess
from pathlib import Path
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def run_command(
        command: Annotated[str, Field(description="Shell command line (POSIX shell semantics).")],
        cwd: Annotated[str, Field(description="Working directory (absolute path).")] = "",
        timeout: Annotated[float, Field(description="Seconds before kill.", gt=0)] = 60.0,
        shell: Annotated[bool, Field(description="Run via /bin/sh -c.")] = True,
    ) -> dict[str, Any]:
        """Run a shell command and return stdout / stderr / returncode."""
        try:
            args: list[str] | str = command if shell else shlex.split(command)
            result = subprocess.run(
                args,
                shell=shell,
                cwd=cwd or None,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            return {
                "ok": False,
                "error": f"timed out after {timeout}s",
                "stdout": (e.stdout or b"").decode("utf-8", "replace") if e.stdout else "",
                "stderr": (e.stderr or b"").decode("utf-8", "replace") if e.stderr else "",
            }
        except FileNotFoundError as e:
            return {"ok": False, "error": str(e)}
        return {
            "ok": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    @mcp.tool()
    def read_file(
        path: str,
        max_bytes: Annotated[int, Field(description="Cap on bytes returned.", ge=1)] = 1_000_000,
    ) -> dict[str, Any]:
        """Read a file as UTF-8 text (errors replaced)."""
        try:
            data = Path(path).read_bytes()[:max_bytes]
        except OSError as e:
            return {"ok": False, "error": str(e)}
        return {
            "ok": True,
            "content": data.decode("utf-8", "replace"),
            "bytes_read": len(data),
            "truncated": len(data) == max_bytes,
        }

    @mcp.tool()
    def write_file(
        path: str,
        content: str,
        append: Annotated[bool, Field(description="Append instead of overwrite.")] = False,
        make_parents: Annotated[bool, Field(description="mkdir -p the parent directory.")] = False,
    ) -> dict[str, Any]:
        """Write text to a file."""
        try:
            p = Path(path)
            if make_parents:
                p.parent.mkdir(parents=True, exist_ok=True)
            mode = "a" if append else "w"
            with p.open(mode, encoding="utf-8") as fh:
                fh.write(content)
        except OSError as e:
            return {"ok": False, "error": str(e)}
        return {"ok": True, "bytes_written": len(content), "path": str(p.resolve())}

    @mcp.tool()
    def list_directory(
        path: str = ".",
        include_hidden: Annotated[bool, Field(description="Include dotfiles.")] = False,
    ) -> dict[str, Any]:
        """List entries in a directory with file sizes and types."""
        try:
            entries = []
            for entry in sorted(Path(path).iterdir()):
                if not include_hidden and entry.name.startswith("."):
                    continue
                stat = entry.stat()
                entries.append(
                    {
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                    }
                )
        except OSError as e:
            return {"ok": False, "error": str(e)}
        return {"ok": True, "entries": entries}

    @mcp.tool()
    def list_processes(
        filter_name: Annotated[str, Field(description="Substring filter on process name.")] = "",
        limit: Annotated[int, Field(description="Max rows.", ge=1, le=1000)] = 100,
    ) -> dict[str, Any]:
        """List running processes via `ps`."""
        try:
            result = subprocess.run(
                ["ps", "-Ao", "pid,ppid,user,%cpu,%mem,comm"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            return {"ok": False, "error": str(e)}
        lines = result.stdout.strip().splitlines()
        if len(lines) < 2:
            return {"ok": True, "processes": []}
        processes = []
        for line in lines[1:]:
            parts = line.split(None, 5)
            if len(parts) < 6:
                continue
            pid, ppid, user, cpu, mem, comm = parts
            if filter_name and filter_name not in comm:
                continue
            try:
                processes.append(
                    {
                        "pid": int(pid),
                        "ppid": int(ppid),
                        "user": user,
                        "cpu": float(cpu),
                        "mem": float(mem),
                        "comm": comm,
                    }
                )
            except ValueError:
                continue
            if len(processes) >= limit:
                break
        return {"ok": True, "processes": processes}

    @mcp.tool()
    def kill_process(
        pid: Annotated[int, Field(description="Process ID.", ge=1)],
        signal_name: Annotated[
            str, Field(description="POSIX signal name, e.g. 'TERM', 'KILL', 'INT'.")
        ] = "TERM",
    ) -> dict[str, Any]:
        """Send a signal to a process."""
        try:
            sig = getattr(signal, f"SIG{signal_name.upper()}")
        except AttributeError:
            return {"ok": False, "error": f"unknown signal: {signal_name}"}
        try:
            os.kill(pid, sig)
        except OSError as e:
            return {"ok": False, "error": str(e)}
        return {"ok": True, "pid": pid, "signal": signal_name}

    @mcp.tool()
    def env() -> dict[str, str]:
        """Return the server process's environment variables."""
        return dict(os.environ)
