import os
import shutil
import subprocess
import sys
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent.parent
    user_home = Path(os.environ.get("USERPROFILE", "C:/Users/shishir"))
    build_workspace = user_home / "tark_wasm_workspace"
    out_dir = root / "frontend" / "src" / "wasm"
    cargo_bin = user_home / ".cargo" / "bin"

    out_dir.mkdir(parents=True, exist_ok=True)
    build_workspace.mkdir(parents=True, exist_ok=True)

    # Copy tark_core and tark_wasm outside OneDrive to avoid ProjFS locks
    src_crates = root / "crates"
    for crate in ["tark_core", "tark_wasm"]:
        target_crate = build_workspace / crate
        source_crate = src_crates / crate
        if target_crate.exists():
            shutil.rmtree(target_crate)
        shutil.copytree(source_crate, target_crate)

    env = os.environ.copy()
    env["PATH"] = f"{cargo_bin};{env.get('PATH', '')}"

    print(f"[*] Building Tark WebAssembly in clean directory: {build_workspace / 'tark_wasm'}")
    cmd = [
        "npx.cmd",
        "-y",
        "wasm-pack",
        "build",
        "--target",
        "web",
        "--out-dir",
        str(out_dir),
    ]
    print(f"[*] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(build_workspace / "tark_wasm"), env=env)
    if result.returncode != 0:
        print(f"[!] wasm-pack build failed with code {result.returncode}")
        sys.exit(result.returncode)

    print("[+] Tark WebAssembly module built successfully into frontend/src/wasm!")

if __name__ == "__main__":
    main()
