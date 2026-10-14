Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\shishir\OneDrive\Documents\tark"
WshShell.Run """C:\Users\shishir\AppData\Local\Programs\Python\Python312\pythonw.exe"" tark_background.py", 0, False
