$cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*TarkLocalDev*" } | Select-Object -First 1
if (-not $cert) {
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=TarkLocalDev" -CertStoreLocation "Cert:\CurrentUser\My"
}
Export-Certificate -Cert $cert -FilePath "C:\Users\shishir\tark_dev.cer" -Force
Import-Certificate -FilePath "C:\Users\shishir\tark_dev.cer" -CertStoreLocation "Cert:\CurrentUser\Root"
Import-Certificate -FilePath "C:\Users\shishir\tark_dev.cer" -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher"

$target = "C:\Users\shishir\OneDrive\Documents\tark\backend\.venv\Lib\site-packages\tark_core.pyd"
if (Test-Path $target) {
    Set-AuthenticodeSignature -FilePath $target -Certificate $cert
    Write-Host "Signed $target successfully"
}
