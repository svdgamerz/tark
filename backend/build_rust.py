import os
import shutil
import subprocess
import sys
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parent.parent
    src_crate = root_dir / "crates" / "tark_core"
    build_dir = Path(os.environ.get("USERPROFILE", "C:/Users/shishir")) / "tark_core_build"
    cargo_bin = Path(os.environ.get("USERPROFILE", "C:/Users/shishir")) / ".cargo" / "bin"
    venv_python = root_dir / "backend" / ".venv" / "Scripts" / "python.exe"

    print(f"[*] Tark Rust Acceleration Builder")
    print(f"    Source: {src_crate}")
    print(f"    Build Dir: {build_dir}")
    print(f"    Cargo bin: {cargo_bin}")

    # Ensure build dir exists and copy clean source
    if build_dir.exists():
        # Keep Cargo.lock if present to avoid re-fetching index
        for item in ["src", "Cargo.toml"]:
            target = build_dir / item
            source = src_crate / item
            if source.is_dir():
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(source, target)
            elif source.is_file():
                shutil.copy2(source, target)
    else:
        shutil.copytree(src_crate, build_dir)

    # Set up environment with cargo and pyo3 flags
    env = os.environ.copy()
    env["PATH"] = f"{cargo_bin};{env.get('PATH', '')}"
    env["VIRTUAL_ENV"] = str(root_dir / "backend" / ".venv")
    env["PYO3_PYTHON"] = str(venv_python)
    env["PYO3_USE_ABI3_FORWARD_COMPATIBILITY"] = "1"

    # Run maturin develop
    maturin_exe = root_dir / "backend" / ".venv" / "Scripts" / "maturin.exe"
    cmd = [
        str(maturin_exe),
        "develop",
        "--manifest-path",
        str(build_dir / "Cargo.toml"),
        "--release",
    ]
    print(f"[*] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=env)
    if result.returncode != 0:
        print(f"[!] Build failed with code {result.returncode}")
        sys.exit(result.returncode)

    print("[+] Tark Core Rust extension successfully compiled and installed into venv!")

if __name__ == "__main__":
    main()
