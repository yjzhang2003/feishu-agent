"""Main CLI application using prompt_toolkit and Rich."""

from __future__ import annotations

from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt

from cli.status import get_all_status
from cli import actions


console = Console()


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
        choice = Prompt.ask(
            "Action",
            choices=["r", "x", "c"],
            default="c",
            show_choices=True,
            show_default=True,
        )
        if choice == "r":
            api_key = Prompt.ask("Enter new ANTHROPIC_API_KEY", password=True)
            if api_key:
                actions.configure_claude_api_key(api_key)
                console.print("[green]✓ API key updated[/green]")
        elif choice == "x":
            confirm = Prompt.ask("Reset API key? (y/N)", default="n")
            if confirm.lower() == "y":
                actions.reset_claude_api_key()
                console.print("[green]✓ API key removed[/green]")
        return

    api_key = Prompt.ask("Enter your ANTHROPIC_API_KEY", password=True)
    if api_key:
        actions.configure_claude_api_key(api_key)
        console.print("[green]✓ API key saved to ~/.claude/settings.json[/green]")


def configure_feishu(target_dir: Path) -> None:
    """Configure Feishu credentials."""
    status = get_all_status(target_dir)["feishu"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = Prompt.ask(
            "Action",
            choices=["r", "x", "c"],
            default="c",
            show_choices=True,
            show_default=True,
        )
        if choice == "r":
            _input_feishu_credentials(target_dir)
        elif choice == "x":
            confirm = Prompt.ask("Reset Feishu credentials? (y/N)", default="n")
            if confirm.lower() == "y":
                actions.reset_feishu_credentials(target_dir)
                console.print("[green]✓ Feishu credentials removed[/green]")
        return

    console.print("\n[yellow]Tip: Scan QR with 'feishu-agent setup' to auto-create a bot[/yellow]")
    _input_feishu_credentials(target_dir)


def _input_feishu_credentials(target_dir: Path) -> None:
    """Prompt for Feishu credentials."""
    app_id = Prompt.ask("FEISHU_APP_ID")
    if not app_id:
        return
    app_secret = Prompt.ask("FEISHU_APP_SECRET", password=True)
    if app_secret:
        actions.configure_feishu_credentials(target_dir, app_id, app_secret)
        console.print("[green]✓ Feishu credentials saved to .env[/green]")


def configure_github() -> None:
    """Configure GitHub authentication."""
    status = get_all_status()["github"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = Prompt.ask(
            "Action",
            choices=["x", "c"],
            default="c",
            show_choices=True,
            show_default=True,
        )
        if choice == "x":
            confirm = Prompt.ask("Logout from GitHub? (y/N)", default="n")
            if confirm.lower() == "y":
                actions.run_github_auth_logout()
                console.print("[green]✓ Logged out from GitHub[/green]")
        return

    console.print("\n[cyan]This will open a browser for GitHub OAuth login...[/cyan]")
    confirm = Prompt.ask("Continue? (Y/n)", default="y")
    if confirm.lower() == "y":
        actions.run_github_auth_login()


def configure_ecc() -> None:
    """Configure ECC plugin."""
    status = get_all_status()["ecc"]

    if status.is_configured:
        console.print(f"\n[cyan]Status:[/cyan] {status.message}")
        choice = Prompt.ask(
            "Action",
            choices=["u", "c"],
            default="c",
            show_choices=True,
            show_default=True,
        )
        if choice == "u":
            console.print("\n[cyan]Updating ECC plugin...[/cyan]")
            if actions.update_ecc_plugin():
                console.print("[green]✓ ECC plugin updated[/green]")
            else:
                console.print("[red]✗ Failed to update ECC plugin[/red]")
        return

    console.print("\n[cyan]ECC (Everything Claude Code) provides enhanced skills and agents.[/cyan]")
    confirm = Prompt.ask("Install ECC plugin? (Y/n)", default="y")
    if confirm.lower() == "y":
        console.print("\n[cyan]Installing ECC plugin...[/cyan]")
        if actions.install_ecc_plugin():
            console.print("[green]✓ ECC plugin installed[/green]")
        else:
            console.print("[red]✗ Failed to install ECC plugin[/red]")


def run_cli(target_dir: Path | None = None) -> None:
    """Run the interactive CLI main loop."""
    target_dir = target_dir or Path.cwd()

    console.print("\n[bold blue]Feishu Agent Setup[/bold blue]\n")
    console.print("Actions: \\[r]econfigure | \\[x]reset | \\[u]pdate | \\[c]ancel\n")

    while True:
        print_status_summary(target_dir)
        console.print()

        choice = Prompt.ask(
            "Select",
            choices=["1", "2", "3", "4", "q"],
            default="q" if get_all_status(target_dir)["feishu"].is_configured else "2",
        )

        if choice == "q":
            console.print("\n[cyan]Goodbye![/cyan]\n")
            break
        elif choice == "1":
            configure_claude()
        elif choice == "2":
            configure_feishu(target_dir)
        elif choice == "3":
            configure_github()
        elif choice == "4":
            configure_ecc()

        console.print()


if __name__ == "__main__":
    run_cli()
