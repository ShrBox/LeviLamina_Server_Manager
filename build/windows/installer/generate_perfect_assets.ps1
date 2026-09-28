Add-Type -AssemblyName System.Drawing

$w = 540
$h = 380

# Load appicon.png and extract clean vibrant leaf dynamically
$appIconPath = "frontend\public\appicon.png"
if (-not (Test-Path $appIconPath)) {
    $appIconPath = "..\..\..\frontend\public\appicon.png"
}
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $appIconPath).Path)
$leafImg = New-Object System.Drawing.Bitmap 160, 160
$gCrop = [System.Drawing.Graphics]::FromImage($leafImg)
$gCrop.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect = New-Object System.Drawing.Rectangle 50, 20, 155, 175
$dstRect = New-Object System.Drawing.Rectangle 10, 5, 140, 150
$gCrop.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$gCrop.Dispose()
$src.Dispose()

for ($y = 0; $y -lt 160; $y++) {
    for ($x = 0; $x -lt 160; $x++) {
        $c = $leafImg.GetPixel($x, $y)
        if ($c.R -gt 225 -and $c.G -gt 225 -and $c.B -gt 205) {
            $leafImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($c.A -gt 20) {
            $r = [Math]::Min(255, [int]($c.R * 0.7 + 16))
            $gCol = [Math]::Min(255, [int]($c.G * 1.6 + 40))
            $b = [Math]::Min(255, [int]($c.B * 1.1 + 50))
            $leafImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, $r, $gCol, $b))
        }
    }
}

function CreateBaseGraphics($bmp) {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    return $g
}

function DrawWindowChrome($g, $title) {
    # Titlebar background (0, 0, 540, 42)
    $hdrRect = New-Object System.Drawing.Rectangle 0, 0, 540, 42
    $hdrBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 12, 17, 30))
    $g.FillRectangle($hdrBrush, $hdrRect)
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 255, 255, 255), 1)
    $g.DrawLine($linePen, 0, 42, 540, 42)

    # Mini leaf icon in titlebar
    $g.DrawImage($leafImg, 14, 11, 20, 20)

    # Title text
    $font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 241, 245, 249))
    $g.DrawString($title, $font, $brush, 40, 11)

    # Window controls: minimize (-) and close (X)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 148, 163, 184), 1.5)
    $g.DrawLine($pen, 468, 22, 480, 22)
    $g.DrawLine($pen, 506, 16, 516, 26)
    $g.DrawLine($pen, 516, 16, 506, 26)
}

function DrawBackgroundBase($g) {
    # Dark modern slate gradient
    $bgRect = New-Object System.Drawing.Rectangle 0, 0, 540, 380
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect,
        [System.Drawing.Color]::FromArgb(255, 11, 15, 26),
        [System.Drawing.Color]::FromArgb(255, 6, 8, 15),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($bgBrush, $bgRect)

    # Subtle decorative grid dots
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 255, 255, 255))
    for ($dx = 18; $dx -lt 540; $dx += 22) {
        for ($dy = 50; $dy -lt 330; $dy += 22) {
            $g.FillEllipse($dotBrush, $dx, $dy, 2, 2)
        }
    }
}

function DrawFooter($g) {
    # Footer background (0, 332, 540, 48)
    $ftrRect = New-Object System.Drawing.Rectangle 0, 332, 540, 48
    $ftrBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 7, 10, 18))
    $g.FillRectangle($ftrBrush, $ftrRect)
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 255, 255, 255), 1)
    $g.DrawLine($linePen, 0, 332, 540, 332)
}

function CreateRoundedPath($x, $y, $w, $h, $r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r*2, $r*2, 180, 90)
    $path.AddArc($x+$w-$r*2, $y, $r*2, $r*2, 270, 90)
    $path.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2, 0, 90)
    $path.AddArc($x, $y+$h-$r*2, $r*2, $r*2, 90, 90)
    $path.CloseFigure()
    return $path
}

# ==============================================================================
# 1. UI_BG.BMP (Welcome Screen Background)
# ==============================================================================
Write-Host "Generating ui_bg.bmp..."
$bg1 = New-Object System.Drawing.Bitmap 540, 380
$g1 = CreateBaseGraphics $bg1
DrawBackgroundBase $g1

# Ambient emerald glow behind badge
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(120, 25, 300, 250)
$pthGrBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$pthGrBrush.CenterColor = [System.Drawing.Color]::FromArgb(55, 16, 185, 129)
$pthGrBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 8, 15))
$g1.FillPath($pthGrBrush, $glowPath)

DrawWindowChrome $g1 "LeviLamina Server Manager"

# Glassmorphic Logo Card
$cardX, $cardY, $cardW, $cardH = 222, 62, 96, 96
$cardPath = CreateRoundedPath $cardX $cardY $cardW $cardH 22

# Badge glow shadows
$badgeGlow1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 16, 185, 129), 8)
$g1.DrawPath($badgeGlow1, $cardPath)
$badgeGlow2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 16, 185, 129), 16)
$g1.DrawPath($badgeGlow2, $cardPath)

# Badge fill: deep glossy dark slate
$cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle $cardX, $cardY, $cardW, $cardH),
    [System.Drawing.Color]::FromArgb(245, 22, 32, 54),
    [System.Drawing.Color]::FromArgb(250, 10, 14, 26),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g1.FillPath($cardBrush, $cardPath)
$cardBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 16, 185, 129), 1.5)
$g1.DrawPath($cardBorder, $cardPath)

# Draw vibrant leaf centered inside card
$g1.DrawImage($leafImg, $cardX + 13, $cardY + 12, 70, 72)

# Title & Subtitle
$titleFont = New-Object System.Drawing.Font("Segoe UI", 15.5, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$g1.DrawString("LeviLamina Server Manager", $titleFont, $titleBrush, 270, 174, $sf)

$subFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$g1.DrawString("High performance, modular Minecraft Bedrock server management", $subFont, $subBrush, 270, 206, $sf)

DrawFooter $g1
$g1.Dispose()

# ==============================================================================
# 2. UI_BTN_INSTALL.BMP (Quick Install Button)
# ==============================================================================
Write-Host "Generating ui_btn_install.bmp..."
$btnW, $btnH = 220, 48
$btnBmp = New-Object System.Drawing.Bitmap $btnW, $btnH
$btnG = CreateBaseGraphics $btnBmp

# Sample the background from ui_bg at (160, 248) so the corners blend with zero artifacts!
$btnG.DrawImage($bg1, (New-Object System.Drawing.Rectangle 0, 0, $btnW, $btnH), 160, 248, $btnW, $btnH, [System.Drawing.GraphicsUnit]::Pixel)

# Button rounded path inside the 220x48 box (with 2px margin for anti-aliasing)
$btnPath = CreateRoundedPath 2 2 ($btnW-4) ($btnH-4) 10

# Outer button glow
$btnGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 16, 185, 129), 6)
$btnG.DrawPath($btnGlow, $btnPath)

# Button fill gradient
$btnBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 2, 2, ($btnW-4), ($btnH-4)),
    [System.Drawing.Color]::FromArgb(255, 16, 185, 129), # #10B981
    [System.Drawing.Color]::FromArgb(255, 4, 120, 87),   # #047857
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$btnG.FillPath($btnBrush, $btnPath)

# Top highlight rim
$btnHlPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 255, 255, 255), 1)
$btnG.DrawLine($btnHlPen, 14, 3, $btnW-14, 3)

# Button text
$btnFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$btnSf = New-Object System.Drawing.StringFormat
$btnSf.Alignment = [System.Drawing.StringAlignment]::Center
$btnSf.LineAlignment = [System.Drawing.StringAlignment]::Center
$btnG.DrawString("Quick Install", $btnFont, $btnTextBrush, (New-Object System.Drawing.RectangleF 0, 0, $btnW, $btnH), $btnSf)
$btnG.Dispose()

# Also draw button onto bg1 so it looks stunning even before control loads!
$g1_2 = CreateBaseGraphics $bg1
$g1_2.DrawImage($btnBmp, 160, 248)
$g1_2.Dispose()

# Save ui_bg.bmp and ui_btn_install.bmp
$bg1.Save("build\windows\installer\ui_bg.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$btnBmp.Save("build\windows\installer\ui_btn_install.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 3. UI_BG_DIR.BMP (Custom Directory Screen Background)
# ==============================================================================
Write-Host "Generating ui_bg_dir.bmp..."
$bgDir = New-Object System.Drawing.Bitmap 540, 380
$gDir = CreateBaseGraphics $bgDir
DrawBackgroundBase $gDir
DrawWindowChrome $gDir "LeviLamina Server Manager"

# Title & subtitle
$dirTitleFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$dirTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gDir.DrawString("Choose Install Location", $dirTitleFont, $dirTitleBrush, 270, 68, $sf)

$dirSubFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$dirSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gDir.DrawString("Select the destination folder for LeviLamina Server Manager", $dirSubFont, $dirSubBrush, 270, 96, $sf)

# Directory input box card background (36, 134, 468, 42)
$inputCardPath = CreateRoundedPath 36 134 468 42 8
$inputCardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$gDir.FillPath($inputCardBrush, $inputCardPath)
$inputBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 148, 163, 184), 1)
$gDir.DrawPath($inputBorder, $inputCardPath)

# Space required note
$spaceFont = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
$spaceBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 100, 116, 139))
$gDir.DrawString("Space required: ~120 MB | Space available: Auto-verified", $spaceFont, $spaceBrush, 40, 184)

# Draw install button on directory page
$gDir.DrawImage($btnBmp, 160, 230)

DrawFooter $gDir
$gDir.Dispose()
$bgDir.Save("build\windows\installer\ui_bg_dir.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 4. UI_BTN_BROWSE.BMP (Browse Folder Button)
# ==============================================================================
Write-Host "Generating ui_btn_browse.bmp..."
$brW, $brH = 110, 32
$brBmp = New-Object System.Drawing.Bitmap $brW, $brH
$brG = CreateBaseGraphics $brBmp
# Fill with card background color #0F172A
$brG.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$brPath = CreateRoundedPath 1 1 ($brW-2) ($brH-2) 6
$brBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 1, 1, ($brW-2), ($brH-2)),
    [System.Drawing.Color]::FromArgb(255, 30, 41, 59),
    [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$brG.FillPath($brBrush, $brPath)
$brBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 148, 163, 184), 1)
$brG.DrawPath($brBorder, $brPath)

$brFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$brTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
$brSf = New-Object System.Drawing.StringFormat
$brSf.Alignment = [System.Drawing.StringAlignment]::Center
$brSf.LineAlignment = [System.Drawing.StringAlignment]::Center
$brG.DrawString("Browse...", $brFont, $brTextBrush, (New-Object System.Drawing.RectangleF 0, 0, $brW, $brH), $brSf)
$brG.Dispose()
$brBmp.Save("build\windows\installer\ui_btn_browse.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 4b. UI_BG_INSTALL.BMP (Installing Screen Background)
# ==============================================================================
Write-Host "Generating ui_bg_install.bmp..."
$bgInst = New-Object System.Drawing.Bitmap 540, 380
$gInst = CreateBaseGraphics $bgInst
DrawBackgroundBase $gInst

# Ambient emerald glow
$glowInstPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowInstPath.AddEllipse(120, 25, 300, 250)
$pthInstBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowInstPath)
$pthInstBrush.CenterColor = [System.Drawing.Color]::FromArgb(55, 16, 185, 129)
$pthInstBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 8, 15))
$gInst.FillPath($pthInstBrush, $glowInstPath)

DrawWindowChrome $gInst "LeviLamina Server Manager - Installing"

# Glassmorphic Logo Card
$cardX, $cardY, $cardW, $cardH = 222, 58, 96, 96
$cardPath = CreateRoundedPath $cardX $cardY $cardW $cardH 22

# Badge glow shadows
$badgeGlow1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 16, 185, 129), 8)
$gInst.DrawPath($badgeGlow1, $cardPath)

$cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle $cardX, $cardY, $cardW, $cardH),
    [System.Drawing.Color]::FromArgb(245, 22, 32, 54),
    [System.Drawing.Color]::FromArgb(250, 10, 14, 26),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$gInst.FillPath($cardBrush, $cardPath)
$cardBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 16, 185, 129), 1.5)
$gInst.DrawPath($cardBorder, $cardPath)

$gInst.DrawImage($leafImg, $cardX + 13, $cardY + 12, 70, 72)

# Title & Subtitle
$instTitleFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$instTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gInst.DrawString("Installing LeviLamina Server Manager...", $instTitleFont, $instTitleBrush, 270, 168, $sf)

$instSubFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$instSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gInst.DrawString("Please wait while server runtime and core files are configured", $instSubFont, $instSubBrush, 270, 198, $sf)

# Card container for progress bar
$progCardPath = CreateRoundedPath 40 234 460 60 10
$progCardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 14, 20, 36))
$gInst.FillPath($progCardBrush, $progCardPath)
$progCardBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 30, 41, 59), 1)
$gInst.DrawPath($progCardBorder, $progCardPath)

DrawFooter $gInst
$gInst.Dispose()
$bgInst.Save("build\windows\installer\ui_bg_install.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 5. UI_BG_FINISH.BMP (Finish Screen Background)
# ==============================================================================
Write-Host "Generating ui_bg_finish.bmp..."
$bgFin = New-Object System.Drawing.Bitmap 540, 380
$gFin = CreateBaseGraphics $bgFin
DrawBackgroundBase $gFin

# Ambient emerald glow behind checkmark
$glowFinPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowFinPath.AddEllipse(145, 45, 250, 250)
$pthFinBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowFinPath)
$pthFinBrush.CenterColor = [System.Drawing.Color]::FromArgb(65, 16, 185, 129)
$pthFinBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 8, 15))
$gFin.FillPath($pthFinBrush, $glowFinPath)

DrawWindowChrome $gFin "LeviLamina Server Manager"

# Huge glowing checkmark circle (center at x=270, y=120, radius=44)
$chkX, $chkY, $chkR = 270, 120, 44
$chkRect = New-Object System.Drawing.Rectangle ($chkX-$chkR), ($chkY-$chkR), ($chkR*2), ($chkR*2)

# Outer glow rings
$chkGlow1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 16, 185, 129), 8)
$gFin.DrawEllipse($chkGlow1, $chkRect)
$chkGlow2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 16, 185, 129), 16)
$gFin.DrawEllipse($chkGlow2, $chkRect)

# Circle fill
$chkBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $chkRect,
    [System.Drawing.Color]::FromArgb(255, 16, 185, 129),
    [System.Drawing.Color]::FromArgb(255, 4, 120, 87),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
)
$gFin.FillEllipse($chkBrush, $chkRect)

# Crisp white vector checkmark inside circle
$chkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 5)
$chkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$chkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$chkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$chkPoints = @(
    (New-Object System.Drawing.Point ($chkX - 18), ($chkY + 2)),
    (New-Object System.Drawing.Point ($chkX - 5),  ($chkY + 15)),
    (New-Object System.Drawing.Point ($chkX + 20), ($chkY - 14))
)
$gFin.DrawLines($chkPen, $chkPoints)

# Title & subtitle
$finTitleFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$finTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gFin.DrawString("Installation Complete!", $finTitleFont, $finTitleBrush, 270, 188, $sf)

$finSubFont = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Regular)
$finSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gFin.DrawString("LeviLamina Server Manager is ready to power your worlds", $finSubFont, $finSubBrush, 270, 220, $sf)

DrawFooter $gFin
$gFin.Dispose()
$bgFin.Save("build\windows\installer\ui_bg_finish.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 6. UI_BTN_LAUNCH.BMP (Launch App Button)
# ==============================================================================
Write-Host "Generating ui_btn_launch.bmp..."
$lnW, $lnH = 200, 44
$lnBmp = New-Object System.Drawing.Bitmap $lnW, $lnH
$lnG = CreateBaseGraphics $lnBmp

# Sample from bgFin at (170, 312)
$lnG.DrawImage($bgFin, (New-Object System.Drawing.Rectangle 0, 0, $lnW, $lnH), 170, 312, $lnW, $lnH, [System.Drawing.GraphicsUnit]::Pixel)

$lnPath = CreateRoundedPath 2 2 ($lnW-4) ($lnH-4) 10
$lnGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 16, 185, 129), 6)
$lnG.DrawPath($lnGlow, $lnPath)

$lnBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 2, 2, ($lnW-4), ($lnH-4)),
    [System.Drawing.Color]::FromArgb(255, 16, 185, 129),
    [System.Drawing.Color]::FromArgb(255, 4, 120, 87),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$lnG.FillPath($lnBrush, $lnPath)

$lnHl = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 255, 255, 255), 1)
$lnG.DrawLine($lnHl, 14, 3, $lnW-14, 3)

$lnFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$lnTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$lnSf = New-Object System.Drawing.StringFormat
$lnSf.Alignment = [System.Drawing.StringAlignment]::Center
$lnSf.LineAlignment = [System.Drawing.StringAlignment]::Center
$lnG.DrawString("Launch App", $lnFont, $lnTextBrush, (New-Object System.Drawing.RectangleF 0, 0, $lnW, $lnH), $lnSf)
$lnG.Dispose()
$lnBmp.Save("build\windows\installer\ui_btn_launch.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 7. UI_BG_UNINST.BMP & UI_BTN_UNINSTALL.BMP (Uninstaller Assets)
# ==============================================================================
Write-Host "Generating uninstaller assets..."
$bgUn = New-Object System.Drawing.Bitmap 540, 380
$gUn = CreateBaseGraphics $bgUn
DrawBackgroundBase $gUn
DrawWindowChrome $gUn "LeviLamina Server Manager - Uninstall"

$unTitleFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$unTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gUn.DrawString("Uninstall Server Manager", $unTitleFont, $unTitleBrush, 270, 68, $sf)

$unSubFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$unSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gUn.DrawString("Select which components and server data you want to remove", $unSubFont, $unSubBrush, 270, 96, $sf)

DrawFooter $gUn
$gUn.Dispose()
$bgUn.Save("build\windows\installer\ui_bg_uninst.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# Uninstall button (red/crimson danger theme: #EF4444 -> #B91C1C)
$unBtnW, $unBtnH = 220, 48
$unBtnBmp = New-Object System.Drawing.Bitmap $unBtnW, $unBtnH
$unBtnG = CreateBaseGraphics $unBtnBmp
$unBtnG.DrawImage($bgUn, (New-Object System.Drawing.Rectangle 0, 0, $unBtnW, $unBtnH), 160, 240, $unBtnW, $unBtnH, [System.Drawing.GraphicsUnit]::Pixel)

$unBtnPath = CreateRoundedPath 2 2 ($unBtnW-4) ($unBtnH-4) 10
$unGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 239, 68, 68), 6)
$unBtnG.DrawPath($unGlow, $unBtnPath)

$unBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 2, 2, ($unBtnW-4), ($unBtnH-4)),
    [System.Drawing.Color]::FromArgb(255, 239, 68, 68),
    [System.Drawing.Color]::FromArgb(255, 185, 28, 28),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$unBtnG.FillPath($unBrush, $unBtnPath)

$unHl = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, 255, 255, 255), 1)
$unBtnG.DrawLine($unHl, 14, 3, $unBtnW-14, 3)

$unFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$unTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$unSf = New-Object System.Drawing.StringFormat
$unSf.Alignment = [System.Drawing.StringAlignment]::Center
$unSf.LineAlignment = [System.Drawing.StringAlignment]::Center
$unBtnG.DrawString("Uninstall Now", $unFont, $unTextBrush, (New-Object System.Drawing.RectangleF 0, 0, $unBtnW, $unBtnH), $unSf)
$unBtnG.Dispose()
$unBtnBmp.Save("build\windows\installer\ui_btn_uninstall.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# ==============================================================================
# 8. UI_BTN_CLOSE.BMP & UI_BTN_MIN.BMP (Window Buttons)
# ==============================================================================
Write-Host "Generating ui_btn_close.bmp & ui_btn_min.bmp..."
$clsBmp = New-Object System.Drawing.Bitmap 32, 32
$clsG = CreateBaseGraphics $clsBmp
$clsG.Clear([System.Drawing.Color]::FromArgb(255, 13, 19, 32))
$clsPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 148, 163, 184), 1.5)
$clsG.DrawLine($clsPen, 10, 10, 22, 22)
$clsG.DrawLine($clsPen, 22, 10, 10, 22)
$clsG.Dispose()
$clsBmp.Save("build\windows\installer\ui_btn_close.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

$minBmp = New-Object System.Drawing.Bitmap 32, 32
$minG = CreateBaseGraphics $minBmp
$minG.Clear([System.Drawing.Color]::FromArgb(255, 13, 19, 32))
$minPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 148, 163, 184), 1.5)
$minG.DrawLine($minPen, 9, 16, 23, 16)
$minG.Dispose()
$minBmp.Save("build\windows\installer\ui_btn_min.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

# Clean up memory
$leafImg.Dispose()
$bg1.Dispose()
$btnBmp.Dispose()
$bgDir.Dispose()
$brBmp.Dispose()
$bgFin.Dispose()
$lnBmp.Dispose()
$bgUn.Dispose()
$unBtnBmp.Dispose()
$clsBmp.Dispose()
$minBmp.Dispose()

Write-Host "All installer assets generated successfully with ultra-high quality TrueType fonts and antialiasing!"
