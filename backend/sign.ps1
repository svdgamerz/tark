$c = (Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert)[0]
if ($c) {
    Set-AuthenticodeSignature -FilePath "C:\Users\shishir\tark_core_build\target\release\tark_core.dll" -Certificate $c
    Set-AuthenticodeSignature -FilePath "C:\Users\shishir\OneDrive\Documents\tark\backend\.venv\Lib\site-packages\tark_core.pyd" -Certificate $c
    Write-Host "Signed successfully with cert:" $c.Thumbprint
} else {
    Write-Host "No code signing cert found"
}
