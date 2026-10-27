# Render PDF pages to PNG using the native Windows.Data.Pdf API (no poppler needed).
# usage: render.ps1 -Pdf C:\x.pdf -Pages 1,2,120 -Out C:\outdir [-Width 1400]
param([string]$Pdf, [int[]]$Pages, [string]$Out, [int]$Width = 1400)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asTaskAct = $ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function Await($op, $type) { $t = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AwaitAction($act) { $asTaskAct.Invoke($null, @($act)).Wait(-1) | Out-Null }

[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]

New-Item -ItemType Directory -Force $Out | Out-Null
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Pdf)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync((Resolve-Path $Out).Path)) ([Windows.Storage.StorageFolder])
$base = [IO.Path]::GetFileNameWithoutExtension($Pdf)
"pages in doc: $($doc.PageCount)"

foreach ($p in $Pages) {
  if ($p -lt 1 -or $p -gt $doc.PageCount) { "skip $p (out of range)"; continue }
  $page = $doc.GetPage($p - 1)
  $name = "{0}-p{1:D3}.png" -f $base, $p
  $outFile = Await ($folder.CreateFileAsync($name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
  $stream = Await ($outFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = $Width
  AwaitAction ($page.RenderToStreamAsync($stream, $opts))
  $stream.Dispose(); $page.Dispose()
  $name
}
