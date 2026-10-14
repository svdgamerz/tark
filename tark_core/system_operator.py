"""Desktop System Operator Engine (TARK / Mark-XL Core).

Capabilities:
1. Multi-Workspace Antigravity IDE Auto-Submit & Permission Dialog Approver
2. Windows Native OCR (winsdk OCR engine) for UI button localization
3. Ocular Vision (Screen capture + LLaMA 3.2 Vision on NVIDIA NIM)
4. Win32 Direct PostMessage background clicks & key simulation (zero cursor jitter)
5. Physical Hardware & Window Management (Volume, Brightness, Windows key shortcuts)
"""
from __future__ import annotations

import asyncio
import base64
import ctypes
from datetime import datetime
import io
import json
import os
from pathlib import Path
import struct
import sys
import threading
import time
import urllib.request
from typing import Any

import cv2
from PIL import Image, ImageGrab
import pyautogui

from tark_core.config import NVIDIA_NIM_API_KEY, SCRATCH_DIR, VISION_MODEL
from tark_core.sound_fx import play_chime_done


class SystemOperator:
    """Controls physical desktop, windows, ocular sight, and Antigravity workspaces."""

    def __init__(self):
        self.user32 = ctypes.windll.user32
        self.gdi32 = ctypes.windll.gdi32
        self.kernel32 = ctypes.windll.kernel32
        self.auto_submit_active = False
        self.auto_submit_thread: threading.Thread | None = None

    # =========================================================================
    # 1. Multi-Workspace Antigravity Automation
    # =========================================================================
    def get_antigravity_workspaces(self) -> list[dict[str, Any]]:
        """Discovers all open Antigravity IDE workspace windows."""
        hdesk = self.user32.OpenDesktopW("default", 0, False, 0x0100 | 0x0001)
        if hdesk:
            self.user32.SetThreadDesktop(hdesk)

        workspaces = []
        def _enum(hwnd, extra):
            if self.user32.IsWindowVisible(hwnd):
                buff = ctypes.create_unicode_buffer(512)
                self.user32.GetWindowTextW(hwnd, buff, 512)
                t = buff.value
                if "antigravity" in t.lower():
                    r = (ctypes.c_long * 4)()
                    self.user32.GetWindowRect(hwnd, r)
                    w = r[2] - r[0]
                    h = r[3] - r[1]
                    if w > 300 and h > 200:
                        ws_name = t.split(" - Antigravity IDE")[0].strip() if " - Antigravity IDE" in t else t
                        workspaces.append({
                            "hwnd": hwnd,
                            "name": ws_name,
                            "title": t,
                            "rect": (r[0], r[1], w, h),
                        })
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
        self.user32.EnumDesktopWindows(hdesk, WNDENUMPROC(_enum), 0)
        return workspaces

    def find_render_child(self, parent_hwnd: int) -> int:
        render_box = [None]
        def _enum_child(chwnd, extra):
            cbuff = ctypes.create_unicode_buffer(256)
            self.user32.GetClassNameW(chwnd, cbuff, 256)
            if cbuff.value == "Chrome_RenderWidgetHostHWND":
                render_box[0] = chwnd
                return False
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
        self.user32.EnumChildWindows(parent_hwnd, WNDENUMPROC(_enum_child), 0)
        return render_box[0] if render_box[0] else parent_hwnd

    def pulse_submit_all_workspaces(self) -> str:
        """Pushes submit & approves dialogs across ALL open Antigravity workspaces."""
        workspaces = self.get_antigravity_workspaces()
        if not workspaces:
            return "No Antigravity IDE workspaces detected."

        fg_current = self.user32.GetForegroundWindow()
        results = []
        temp_scan = str(SCRATCH_DIR / "tark_ag_scan_internal.png")

        for ws in workspaces:
            hwnd = ws["hwnd"]
            ws_name = ws["name"]
            rx, ry, w, h = ws["rect"]
            target_render = self.find_render_child(hwnd)

            # Detect modal dialogs ("allow this time", "always allow", "proceed")
            detected_modal = None
            try:
                hdc_win = self.user32.GetWindowDC(hwnd)
                hdc_mem = self.gdi32.CreateCompatibleDC(hdc_win)
                hbm = self.gdi32.CreateCompatibleBitmap(hdc_win, w, h)
                self.gdi32.SelectObject(hdc_mem, hbm)

                PW_RENDERFULLCONTENT = 2
                self.user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)

                bih = struct.pack("iiiHHiiiiii", 40, w, -h, 1, 32, 0, w * h * 4, 0, 0, 0, 0)
                buf = ctypes.create_string_buffer(w * h * 4)
                self.gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, bih, 0)
                img = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1)
                img.save(temp_scan)

                self.gdi32.DeleteObject(hbm)
                self.gdi32.DeleteDC(hdc_mem)
                self.user32.ReleaseDC(hwnd, hdc_win)

                async def _scan():
                    import winsdk.windows.graphics.imaging as imaging
                    import winsdk.windows.media.ocr as ocr
                    import winsdk.windows.storage as storage

                    f = await storage.StorageFile.get_file_from_path_async(temp_scan)
                    stream = await f.open_async(storage.FileAccessMode.READ)
                    decoder = await imaging.BitmapDecoder.create_async(stream)
                    bitmap = await decoder.get_software_bitmap_async(
                        imaging.BitmapPixelFormat.BGRA8,
                        imaging.BitmapAlphaMode.PREMULTIPLIED
                    )
                    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
                    if not engine:
                        return None
                    res = await engine.recognize_async(bitmap)

                    for line in res.lines:
                        txt = line.text.lower().strip()
                        min_x = min(wd.bounding_rect.x for wd in line.words)
                        max_x = max(wd.bounding_rect.x + wd.bounding_rect.width for wd in line.words)
                        min_y = min(wd.bounding_rect.y for wd in line.words)
                        max_y = max(wd.bounding_rect.y + wd.bounding_rect.height for wd in line.words)
                        center_x = int((min_x + max_x) / 2)
                        center_y = int((min_y + max_y) / 2)

                        if center_x < 1100 or center_y >= 840 or center_y < 250:
                            continue
                        if any(bad in txt for bad in [
                            "pulse", "submit:", "foreground", "background", "clicked", "pulsed",
                            "sent", "enter", "tark", "active", "focused", "review", "files with changes"
                        ]):
                            continue
                        if len(txt) > 25:
                            continue

                        clean_btn = txt.rstrip(".").rstrip(":").strip()
                        if (
                            clean_btn in ["allow this time", "always allow", "yes, allow", "yes, allow this time", "proceed", "allow"] or
                            clean_btn.startswith("yes, allow") or
                            clean_btn.startswith("allow this time") or
                            clean_btn.startswith("always allow")
                        ):
                            return (center_x, center_y, line.text)
                    return None

                res = asyncio.run(_scan())
                if res:
                    detected_modal = res
            except Exception:
                pass
            finally:
                if os.path.exists(temp_scan):
                    try:
                        os.remove(temp_scan)
                    except Exception:
                        pass

            if detected_modal:
                client_x, client_y, label = detected_modal
                is_modal = True
            else:
                client_x, client_y = 1715, 865
                label = "Chat Send"
                is_modal = False

            screen_x = rx + client_x
            screen_y = ry + client_y
            is_active_window = (fg_current == hwnd)

            if is_modal:
                # Guaranteed micro-pulse for dialog
                try:
                    curr_x, curr_y = pyautogui.position()
                    self.user32.keybd_event(0x12, 0, 0, 0)
                    self.user32.keybd_event(0x12, 0, 2, 0)
                    self.user32.SetForegroundWindow(hwnd)
                    time.sleep(0.015)
                    pyautogui.click(screen_x, screen_y)
                    pyautogui.press("enter")
                    time.sleep(0.01)
                    if fg_current and fg_current != hwnd:
                        self.user32.keybd_event(0x12, 0, 0, 0)
                        self.user32.keybd_event(0x12, 0, 2, 0)
                        self.user32.SetForegroundWindow(fg_current)
                    if curr_x > 0 and curr_y > 0:
                        pyautogui.moveTo(curr_x, curr_y)
                except Exception:
                    pass
                results.append(f"[{ws_name}] Approved '{label}'")
            else:
                if is_active_window:
                    try:
                        curr_x, curr_y = pyautogui.position()
                        pyautogui.click(screen_x, screen_y)
                        pyautogui.press("enter")
                        if curr_x > 0 and curr_y > 0:
                            pyautogui.moveTo(curr_x, curr_y)
                    except Exception:
                        pass
                    results.append(f"[{ws_name}] Clicked (Foreground)")
                else:
                    # Silent Win32 direct post
                    lparam = ((client_y & 0xFFFF) << 16) | (client_x & 0xFFFF)
                    self.user32.PostMessageW(target_render, 0x0201, 1, lparam)
                    time.sleep(0.01)
                    self.user32.PostMessageW(target_render, 0x0202, 0, lparam)
                    self.user32.PostMessageW(target_render, 0x0100, 0x0D, 0x001C0001)
                    self.user32.PostMessageW(target_render, 0x0101, 0x0D, 0xC01C0001)
                    results.append(f"[{ws_name}] Clicked (Background)")

        return " | ".join(results)

    def start_auto_submit_loop(self) -> str:
        if self.auto_submit_active:
            return "Auto-submit loop already running."
        self.auto_submit_active = True

        def _worker():
            pulse_count = 0
            while self.auto_submit_active:
                action_desc = self.pulse_submit_all_workspaces()
                pulse_count += 1
                sys.stdout.write(f"\r  ⚡ [AUTO-SUBMIT ACTIVE #{pulse_count}]: {action_desc[:72]}   ")
                sys.stdout.flush()
                time.sleep(1.5)

        self.auto_submit_thread = threading.Thread(target=_worker, daemon=True)
        self.auto_submit_thread.start()
        play_chime_done()
        return "Auto-submit loop activated across all Antigravity workspaces (approving dialogs & submitting prompts)."

    def stop_auto_submit_loop(self) -> str:
        if not self.auto_submit_active:
            return "Auto-submit not currently active."
        self.auto_submit_active = False
        play_chime_done()
        return "Auto-submit deactivated."

    # =========================================================================
    # 2. Ocular Computer Vision (Screen & Camera)
    # =========================================================================
    def analyze_screen(self, query: str = "Analyze this screen and describe actionable details.") -> str:
        """Captures full screen and inspects it via LLaMA 3.2 Vision."""
        try:
            screenshot = ImageGrab.grab()
            buf = io.BytesIO()
            screenshot.save(buf, format="JPEG", quality=80)
            b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

            url = "https://integrate.api.nvidia.com/v1/chat/completions"
            payload = {
                "model": VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Instruction: {query}\nBe precise, helpful, and concise."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}},
                        ],
                    }
                ],
                "max_tokens": 512,
                "temperature": 0.2,
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {NVIDIA_NIM_API_KEY}",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            return f"Ocular Vision inspection failed: {e}"

    def capture_camera_feed(self) -> str:
        """Captures webcam frame and analyzes it."""
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                return "Error: Camera device not accessible."
            time.sleep(0.3)
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return "Error: Failed to capture frame from webcam."

            _, enc = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            b64_img = base64.b64encode(enc.tobytes()).decode("utf-8")

            url = "https://integrate.api.nvidia.com/v1/chat/completions"
            payload = {
                "model": VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe the person, room, and objects in front of the camera."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}},
                        ],
                    }
                ],
                "max_tokens": 300,
                "temperature": 0.2,
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {NVIDIA_NIM_API_KEY}",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            return f"Camera inspection error: {e}"

    # =========================================================================
    # 3. Hardware & Desktop Controls
    # =========================================================================
    def control_volume(self, action: str) -> str:
        act = action.lower()
        if "up" in act or "raise" in act or "increase" in act:
            for _ in range(5):
                pyautogui.press("volumeup")
            return "Master volume increased."
        elif "down" in act or "lower" in act or "decrease" in act:
            for _ in range(5):
                pyautogui.press("volumedown")
            return "Master volume decreased."
        elif "mute" in act or "unmute" in act:
            pyautogui.press("volumemute")
            return "Toggled master volume mute."
        elif "max" in act or "100" in act:
            for _ in range(30):
                pyautogui.press("volumeup")
            return "Master volume set to maximum."
        return "Unknown volume command."

    def take_screenshot(self) -> str:
        desktop = Path.home() / "Desktop"
        filename = desktop / f"Screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        img = ImageGrab.grab()
        img.save(str(filename))
        play_chime_done()
        return f"Screenshot saved to Desktop: {filename.name}"
