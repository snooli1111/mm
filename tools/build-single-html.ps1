param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root "src"
$dist = Join-Path $root "dist"

$indexPath = Join-Path $src "index.html"
$cssPath = Join-Path $src "styles.css"
$jsPath = Join-Path $src "app.js"
$baseName = -join ([char[]](
  0xC0DD, 0xAE30, 0xBD80, 0x005F,
  0xB9C8, 0xC778, 0xB4DC, 0xB9F5, 0x005F,
  0xC571
))

if ($Version.Trim().Length -gt 0) {
  $safeVersion = $Version.Trim() -replace '[\\/:*?"<>|]', '_'
  $outName = "$baseName`_$safeVersion.html"
} else {
  $outName = "$baseName.html"
}

$outPath = Join-Path $dist $outName

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

$html = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding UTF8
$js = Get-Content -LiteralPath $jsPath -Raw -Encoding UTF8

$html = $html -replace '<link rel="stylesheet" href="styles\.css">', "<style>`n$css`n</style>"
$html = $html -replace '<script src="app\.js"></script>', "<script>`n$js`n</script>"

Set-Content -LiteralPath $outPath -Value $html -Encoding UTF8
Write-Host "Built $outPath"
