# 🚀 How to Start Tark Servers

You need **two terminal windows** running at the same time: one for the **Backend** and one for the **Frontend**.

---

## ⚡ Option 1: 1-Click Startup (Easiest)

Simply double-click the file in the project folder:
```text
start_dev.bat
```
*(This automatically launches both servers in separate windows and opens the app).*

---

## 💻 Option 2: Copy-Paste Commands (PowerShell / Terminal)

### 🟢 Terminal 1: Backend Server

Open your **first terminal** in the `tark` folder and paste:

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

---

### 🔵 Terminal 2: Frontend Server

Open your **second terminal** in the `tark` folder and paste:

```powershell
cd frontend
npm.cmd run dev
```

---

## 🌐 Open Tark in Your Browser

Once both terminals are running, open:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🛑 How to Stop or Restart Servers

If a port is already in use or you want to stop the servers:
- Press `Ctrl + C` in each terminal window.
- Or run this command to force-close any stuck processes:

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```
