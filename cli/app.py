"""Interactive CLI with curses-based selection and Rich formatting."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from cli.status import get_all_status
from cli import actions


console = Console()


def flush_stdin() -> None:
    """Flush stdin buffer after curses mode."""
    try:
        if not sys.stdin.isatty():
            return
        import termios
        termios.tcflush(sys.stdin, termios.TCIFLUSH)
    except Exception:
        pass


def curses_single_select(
    title: str,
    items: List[str],
    default_index: int = 0,
    *,
    cancel_label: str = "Exit",
) -> int | None:
    """Curses single-select menu with arrow key navigation.

    Returns selected index or None on cancel.
    """
    if not sys.stdin.isatty():
        return _numbered_fallback(title, items, cancel_label)

    try:
        import curses
        result_holder: list = [None]

        all_items = list(items) + [cancel_label]
        cancel_idx = len(items)

        def _draw(stdscr):
            curses.curs_set(0)
            if curses.has_colors():
                curses.start_color()
                curses.use_default_colors()
                curses.init_pair(1, curses.COLOR_GREEN, -1)
                curses.init_pair(2, curses.COLOR_CYAN, -1)
            cursor = min(default_index, len(all_items) - 1)
            scroll_offset = 0

            while True:
                stdscr.clear()
                max_y, max_x = stdscr.getmaxyx()

                # Title
                try:
                    hattr = curses.A_BOLD
                    if curses.has_colors():
                        hattr |= curses.color_pair(2)
                    stdscr.addnstr(0, 0, title, max_x - 1, hattr)
                    stdscr.addnstr(
                        1, 0,
                        "  ↑↓ navigate  ENTER confirm  q cancel",
                        max_x - 1, curses.A_DIM,
                    )
                except curses.error:
                    pass

                visible_rows = max_y - 3
                if cursor < scroll_offset:
                    scroll_offset = cursor
                elif cursor >= scroll_offset + visible_rows:
                    scroll_offset = cursor - visible_rows + 1

                for draw_i, i in enumerate(
                    range(scroll_offset, min(len(all_items), scroll_offset + visible_rows))
                ):
                    y = draw_i + 3
                    if y >= max_y - 1:
                        break
                    arrow = "→" if i == cursor else " "
                    line = f" {arrow} {all_items[i]}"
                    attr = curses.A_NORMAL
                    if i == cursor:
                        attr = curses.A_BOLD
                        if curses.has_colors():
                            attr |= curses.color_pair(1)
                    try:
                        stdscr.addnstr(y, 0, line, max_x - 1, attr)
                    except curses.error:
                        pass

                stdscr.refresh()
                key = stdscr.getch()

                if key in (curses.KEY_UP, ord("k")):
                    cursor = (cursor - 1) % len(all_items)
                elif key in (curses.KEY_DOWN, ord("j")):
                    cursor = (cursor + 1) % len(all_items)
                elif key in (curses.KEY_ENTER, 10, 13):
                    result_holder[0] = cursor
                    return
                elif key in (27, ord("q")):
                    result_holder[0] = None
                    return

        curses.wrapper(_draw)
        flush_stdin()
        if result_holder[0] is not None and result_holder[0] >= cancel_idx:
            return None
        return result_holder[0]

    except Exception:
        return _numbered_fallback(title, items, cancel_label)


def _numbered_fallback(title: str, items: List[str], cancel_label: str) -> int | None:
    """Text-based numbered fallback for selection."""
    all_items = list(items) + [cancel_label]
    print(f"\n  {title}\n")
    for i, label in enumerate(all_items, 1):
        print(f"  {i}. {label}")
    print()
    try:
        val = input(f"  Choice [1-{len(all_items)}]: ").strip()
        if not val:
            return None
        idx = int(val) - 1
        if 0 <= idx < len(items):
            return idx
    except (ValueError, KeyboardInterrupt, EOFError):
        pass
    return None


def print_status_summary(target_dir: Path | None = None) -> None:
    """Print a status summary table."""
    statuses = get_all_status(target_dir)

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("status", width=1)
    table.add_column("name", width=15)
    table.add_column("message")

    for key in ["claude", "feishu", "github", "ecc"]:
        status = statuses[key]
        icon = "✓" if status.is_configured else "✗"
        style = "green" if status.is_configured else "red"
        table.add_row(
            f"[{style}]{icon}[/{style}]",
            status.name,
            status.message or ("Configured" if status.is_configured else "Not configured"),
        )

    console.print(Panel(table, title="Feishu Agent Setup", border_style="blue"))


def configure_claude() -> None:
    """Configure Claude Code API key."""
    status = get_all_status()["claude"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = curses_single_select("Claude Code Actions", [
            "Re-configure API key",
            "Reset (remove API key)",
        ], default_index=0, cancel_label="Cancel")

        if choice == 0:
            try:
                api_key = input("Enter new ANTHROPIC_API_KEY: ").strip()
                if api_key:
                    actions.configure_claude_api_key(api_key)
                    console.print("[green]✓ API key updated[/green]")
            except (KeyboardInterrupt, EOFError):
                console.print("\n[yellow]Cancelled[/yellow]")
        elif choice == 1:
            confirm = input("Reset API key? (y/N): ").strip().lower()
            if confirm == "y":
                actions.reset_claude_api_key()
                console.print("[green]✓ API key removed[/green]")
        return

    try:
        api_key = input("Enter your ANTHROPIC_API_KEY: ").strip()
        if api_key:
            actions.configure_claude_api_key(api_key)
            console.print("[green]✓ API key saved to ~/.claude/settings.json[/green]")
    except (KeyboardInterrupt, EOFError):
        console.print("\n[yellow]Cancelled[/yellow]")


def configure_feishu(target_dir: Path) -> None:
    """Configure Feishu credentials."""
    status = get_all_status(target_dir)["feishu"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = curses_single_select("Feishu Actions", [
            "Re-configure credentials",
            "Reset (remove credentials)",
        ], default_index=0, cancel_label="Cancel")

        if choice == 0:
            _input_feishu_credentials(target_dir)
        elif choice == 1:
            confirm = input("Reset Feishu credentials? (y/N): ").strip().lower()
            if confirm == "y":
                actions.reset_feishu_credentials(target_dir)
                console.print("[green]✓ Feishu credentials removed[/green]")
        return

    console.print("\n[yellow]Tip: Scan QR with 'feishu-agent setup' to auto-create a bot[/yellow]")
    _input_feishu_credentials(target_dir)


def _input_feishu_credentials(target_dir: Path) -> None:
    """Prompt for Feishu credentials."""
    try:
        app_id = input("FEISHU_APP_ID: ").strip()
        if not app_id:
            return
        import getpass
        app_secret = getpass.getpass("FEISHU_APP_SECRET: ").strip()
        if app_secret:
            actions.configure_feishu_credentials(target_dir, app_id, app_secret)
            console.print("[green]✓ Feishu credentials saved to .env[/green]")
    except (KeyboardInterrupt, EOFError):
        console.print("\n[yellow]Cancelled[/yellow]")


def configure_github() -> None:
    """Configure GitHub authentication."""
    status = get_all_status()["github"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = curses_single_select("GitHub Actions", [
            "Logout",
        ], default_index=0, cancel_label="Cancel")

        if choice == 0:
            confirm = input("Logout from GitHub? (y/N): ").strip().lower()
            if confirm == "y":
                actions.run_github_auth_logout()
                console.print("[green]✓ Logged out from GitHub[/green]")
        return

    console.print("\n[cyan]This will open a browser for GitHub OAuth login...[/cyan]")
    confirm = input("Continue? (Y/n): ").strip().lower()
    if confirm in ("", "y", "yes"):
        actions.run_github_auth_login()


def configure_ecc() -> None:
    """Configure ECC plugin."""
    status = get_all_status()["ecc"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = curses_single_select("ECC Actions", [
            "Check for updates",
        ], default_index=0, cancel_label="Cancel")

        if choice == 0:
            console.print("\n[cyan]Updating ECC plugin...[/cyan]")
            if actions.update_ecc_plugin():
                console.print("[green]✓ ECC plugin updated[/green]")
            else:
                console.print("[red]✗ Failed to update ECC plugin[/red]")
        return

    console.print("\n[cyan]ECC (Everything Claude Code) provides enhanced skills and agents.[/cyan]")
    confirm = input("Install ECC plugin? (Y/n): ").strip().lower()
    if confirm in ("", "y", "yes"):
        console.print("\n[cyan]Installing ECC plugin...[/cyan]")
        if actions.install_ecc_plugin():
            console.print("[green]✓ ECC plugin installed[/green]")
        else:
            console.print("[red]✗ Failed to install ECC plugin[/red]")


def run_cli(target_dir: Path | None = None) -> None:
    """Run the interactive CLI main loop."""
    target_dir = target_dir or Path.cwd()

    console.print("\n[bold cyan]Feishu Agent Setup[/bold cyan]")

    while True:
        print_status_summary(target_dir)
        console.print()

        items = [
            "Claude Code",
            "Feishu",
            "GitHub",
            "ECC",
        ]

        choice = curses_single_select(
            "Select component to configure:",
            items,
            default_index=1 if not get_all_status(target_dir)["feishu"].is_configured else 0,
            cancel_label="Exit"
        )

        if choice is None:
            console.print("\n[cyan]Goodbye![/cyan]\n")
            break
        elif choice == 0:
            configure_claude()
        elif choice == 1:
            configure_feishu(target_dir)
        elif choice == 2:
            configure_github()
        elif choice == 3:
            configure_ecc()

        console.print()


if __name__ == "__main__":
    run_cli()
