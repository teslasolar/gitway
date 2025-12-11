# PowerShell script to test GitWay views and capture screenshots

Write-Host "Testing GitWay Views with Screenshots" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Create screenshots directory
$screenshotDir = "screenshots"
if (!(Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir
    Write-Host "Created screenshots directory" -ForegroundColor Green
}

# Function to capture screenshot
function Capture-Screenshot {
    param($name)

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    $filename = "$screenshotDir\$name-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
    $bitmap.Save($filename)
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Host "  Screenshot saved: $filename" -ForegroundColor Gray
    return $filename
}

# Base URL
$baseUrl = "https://teslasolar.github.io/gitway"

# List of views to test
$views = @(
    @{Name="Dashboard"; Url="$baseUrl/?view=Dashboard"; Wait=3},
    @{Name="Gateway"; Url="$baseUrl/?view=Gateway"; Wait=3},
    @{Name="Integration"; Url="$baseUrl/?view=Integration"; Wait=3},
    @{Name="Tags"; Url="$baseUrl/?view=Tags"; Wait=3},
    @{Name="GitDB"; Url="$baseUrl/?view=GitDB"; Wait=3},
    @{Name="API-Status"; Url="$baseUrl/?api=status"; Wait=2},
    @{Name="API-Config"; Url="$baseUrl/?api=config"; Wait=2},
    @{Name="API-Views"; Url="$baseUrl/?api=views"; Wait=2}
)

Write-Host "`nTesting Views:" -ForegroundColor Yellow
Write-Host "-------------" -ForegroundColor Yellow

foreach ($view in $views) {
    Write-Host "`nTesting: $($view.Name)" -ForegroundColor Green
    Write-Host "  URL: $($view.Url)" -ForegroundColor Gray

    # Open in default browser
    Start-Process $view.Url

    # Wait for page to load
    Write-Host "  Waiting $($view.Wait) seconds for page to load..." -ForegroundColor Gray
    Start-Sleep -Seconds $view.Wait

    # Capture screenshot
    $screenshot = Capture-Screenshot -name $view.Name

    # Small delay between views
    Start-Sleep -Seconds 1
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Green
Write-Host "Screenshots saved in: $screenshotDir" -ForegroundColor Yellow

# Open screenshots folder
Start-Process explorer.exe $screenshotDir