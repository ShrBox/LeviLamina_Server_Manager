Add-Type -AssemblyName System.Drawing

function Create-RoundedRectanglePath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [Math]::Max(1.0, $r * 2)
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

$outDir = "$PWD\build\windows\installer"
$W = 480
$H = 340

# Load sprout and app icon
$sprout = [System.Drawing.Bitmap]::FromFile("$PWD\test_sprout.png")
$appIcon = [System.Drawing.Bitmap]::FromFile("$PWD\build\appicon.png")

# Palette
$colBg = [System.Drawing.Color]::FromArgb(10, 14, 26)          # #0A0E1A
$colTitle = [System.Drawing.Color]::FromArgb(13, 20, 36)       # #0D1424
$colSep = [System.Drawing.Color]::FromArgb(30, 41, 59)         # #1E293B
$colFooter = [System.Drawing.Color]::FromArgb(8, 12, 22)       # #080C16
$colCardBg = [System.Drawing.Color]::FromArgb(15, 23, 42)      # #0F172A
$colEmerald = [System.Drawing.Color]::FromArgb(16, 185, 129)   # #10B981
$colEmeraldLt = [System.Drawing.Color]::FromArgb(52, 211, 153) # #34D399
$colEmeraldDk = [System.Drawing.Color]::FromArgb(5, 150, 105)  # #059669
$colWhite = [System.Drawing.Color]::FromArgb(241, 245, 249)     # #F1F5F9
$colGray = [System.Drawing.Color]::FromArgb(148, 163, 184)      # #94A3B8

# Fonts
$fontTitleBar = New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)
$fontBadge = New-Object System.Drawing.Font "Segoe UI", 7, ([System.Drawing.FontStyle]::Bold)
$fontHeroTitle = New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)
$fontHeroSub = New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Regular)
$fontPageTitle = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)
$fontPageSub = New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)
$fontBtnLg = New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)
$fontBtnMd = New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)
$fontBtnSm = New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)

function Draw-TitleBar($g, $titleText) {
    $b = New-Object System.Drawing.SolidBrush $colTitle
    $g.FillRectangle($b, 0, 0, $W, 32)
    $b.Dispose()

    $p = New-Object System.Drawing.Pen $colSep, 1
    $g.DrawLine($p, 0, 32, $W, 32)
    $p.Dispose()

    # Small app icon in title bar
    $g.DrawImage($appIcon, 10, 7, 18, 18)

    # Title text
    $wBrush = New-Object System.Drawing.SolidBrush $colWhite
    $g.DrawString($titleText, $fontTitleBar, $wBrush, 34, 7)
    $wBrush.Dispose()

    # Version pill badge "v2.0"
    $badgeX = 216
    $badgeY = 8
    $badgePath = Create-RoundedRectanglePath $badgeX $badgeY 32 16 4
    $badgeBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 16, 185, 129))
    $badgeBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 16, 185, 129)), 1
    $badgeText = New-Object System.Drawing.SolidBrush $colEmeraldLt
    $g.FillPath($badgeBg, $badgePath)
    $g.DrawPath($badgeBorder, $badgePath)
    $g.DrawString("v2.0", $fontBadge, $badgeText, ($badgeX + 4), ($badgeY + 1))
    $badgeBg.Dispose()
    $badgeBorder.Dispose()
    $badgeText.Dispose()
    $badgePath.Dispose()
}

function Draw-Footer($g) {
    $fBrush = New-Object System.Drawing.SolidBrush $colFooter
    $g.FillRectangle($fBrush, 0, ($H - 42), $W, 42)
    $fBrush.Dispose()

    $p = New-Object System.Drawing.Pen $colSep, 1
    $g.DrawLine($p, 0, ($H - 42), $W, ($H - 42))
    $p.Dispose()
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. Main Welcome Background (ui_bg.bmp) 480x340
# ─────────────────────────────────────────────────────────────────────────────
$bmp1 = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g1 = [System.Drawing.Graphics]::FromImage($bmp1)
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g1.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgBrush = New-Object System.Drawing.SolidBrush $colBg
$g1.FillRectangle($bgBrush, 0, 0, $W, $H)
$bgBrush.Dispose()

# Radial Emerald Aura behind hero logo
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(($W/2 - 110), 34, 220, 160)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(55, 16, 185, 129)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 14, 26))
$g1.FillPath($pgb, $glowPath)
$pgb.Dispose()
$glowPath.Dispose()

# Subtle dot grid
$dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 255, 255, 255))
for ($x = 20; $x -lt $W - 10; $x += 20) {
    for ($y = 44; $y -lt $H - 50; $y += 20) {
        $g1.FillRectangle($dotBrush, $x, $y, 1.2, 1.2)
    }
}
$dotBrush.Dispose()

Draw-TitleBar $g1 "LeviLamina Server Manager"

# Hero Card / Logo Container (56x56)
$cardW = 56
$cardH = 56
$cardX = ($W - $cardW) / 2
$cardY = 46

# Outer subtle glowing halo
$outerCardPath = Create-RoundedRectanglePath ($cardX - 4) ($cardY - 4) ($cardW + 8) ($cardH + 8) 16
$glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 16, 185, 129)), 1.5
$g1.DrawPath($glowPen, $outerCardPath)
$glowPen.Dispose()
$outerCardPath.Dispose()

# Sleek dark-glass rounded badge
$cardPath = Create-RoundedRectanglePath $cardX $cardY $cardW $cardH 13
$cardBg = New-Object System.Drawing.SolidBrush $colCardBg
$cardBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 16, 185, 129)), 1.0
$g1.FillPath($cardBg, $cardPath)
$g1.DrawPath($cardBorder, $cardPath)
$cardBg.Dispose()
$cardBorder.Dispose()
$cardPath.Dispose()

# Draw Sprout in center of card (crisp 40x44)
$g1.DrawImage($sprout, ($cardX + 8), ($cardY + 6), 40, 44)

# Hero Title: LEVI LAMINA
$wBrush = New-Object System.Drawing.SolidBrush $colWhite
$emBrush = New-Object System.Drawing.SolidBrush $colEmerald
$grBrush = New-Object System.Drawing.SolidBrush $colGray

$t1 = "LEVI"
$t2 = "LAMINA"
$s1 = $g1.MeasureString($t1, $fontHeroTitle)
$s2 = $g1.MeasureString($t2, $fontHeroTitle)
$totW = $s1.Width + $s2.Width - 6
$startX = ($W - $totW) / 2

$g1.DrawString($t1, $fontHeroTitle, $wBrush, $startX, 110)
$g1.DrawString($t2, $fontHeroTitle, $emBrush, ($startX + $s1.Width - 6), 110)

# Subtitle
$tagline = "Next-Generation Minecraft Bedrock Server Management"
$st = $g1.MeasureString($tagline, $fontHeroSub)
$g1.DrawString($tagline, $fontHeroSub, $grBrush, (($W - $st.Width) / 2), 134)

Draw-Footer $g1

$bmp1.Save("$outDir\ui_bg.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$g1.Dispose()
$bmp1.Dispose()
Write-Host "Created ui_bg.bmp (480x340)"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Directory Selection Background (ui_bg_dir.bmp) 480x340
# ─────────────────────────────────────────────────────────────────────────────
$bmp2 = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgBrush = New-Object System.Drawing.SolidBrush $colBg
$g2.FillRectangle($bgBrush, 0, 0, $W, $H)
$bgBrush.Dispose()

Draw-TitleBar $g2 "LeviLamina Server Manager"

# Page Heading
$heading = "Choose Installation Location"
$g2.DrawString($heading, $fontPageTitle, $wBrush, 24, 46)

$subhead = "Setup will install LeviLamina into this folder:"
$g2.DrawString($subhead, $fontPageSub, $grBrush, 24, 70)

# Decorative card behind input field
$boxPath = Create-RoundedRectanglePath 22 96 436 62 6
$boxBrush = New-Object System.Drawing.SolidBrush $colCardBg
$boxPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 58, 85)), 1
$g2.FillPath($boxBrush, $boxPath)
$g2.DrawPath($boxPen, $boxPath)
$boxBrush.Dispose()
$boxPen.Dispose()
$boxPath.Dispose()

$labelPath = "Destination Folder"
$fontSmall = New-Object System.Drawing.Font "Segoe UI", 7.5, ([System.Drawing.FontStyle]::Bold)
$g2.DrawString($labelPath, $fontSmall, $emBrush, 32, 104)
$fontSmall.Dispose()

Draw-Footer $g2

$bmp2.Save("$outDir\ui_bg_dir.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$g2.Dispose()
$bmp2.Dispose()
Write-Host "Created ui_bg_dir.bmp (480x340)"

# ─────────────────────────────────────────────────────────────────────────────
# 2b. Uninstaller Options Background (ui_bg_uninst.bmp) 480x340
# ─────────────────────────────────────────────────────────────────────────────
$bmpU = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gU = [System.Drawing.Graphics]::FromImage($bmpU)
$gU.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gU.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$gU.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgBrush = New-Object System.Drawing.SolidBrush $colBg
$gU.FillRectangle($bgBrush, 0, 0, $W, $H)
$bgBrush.Dispose()

Draw-TitleBar $gU "LeviLamina Server Manager Uninstaller"

$headingU = "Uninstall LeviLamina Server Manager"
$gU.DrawString($headingU, $fontPageTitle, $wBrush, 24, 46)

$subheadU = "Select additional data to permanently remove:"
$gU.DrawString($subheadU, $fontPageSub, $grBrush, 24, 70)

# Decorative card behind checkboxes
$boxPathU = Create-RoundedRectanglePath 22 96 436 68 6
$boxBrushU = New-Object System.Drawing.SolidBrush $colCardBg
$boxPenU = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 58, 85)), 1
$gU.FillPath($boxBrushU, $boxPathU)
$gU.DrawPath($boxPenU, $boxPathU)
$boxBrushU.Dispose()
$boxPenU.Dispose()
$boxPathU.Dispose()

Draw-Footer $gU

$bmpU.Save("$outDir\ui_bg_uninst.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gU.Dispose()
$bmpU.Dispose()
Write-Host "Created ui_bg_uninst.bmp (480x340)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Finish Background (ui_bg_finish.bmp) 480x340
# ─────────────────────────────────────────────────────────────────────────────
$bmp3 = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g3 = [System.Drawing.Graphics]::FromImage($bmp3)
$g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g3.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgBrush = New-Object System.Drawing.SolidBrush $colBg
$g3.FillRectangle($bgBrush, 0, 0, $W, $H)
$bgBrush.Dispose()

# Radial glow in center
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(($W/2 - 100), 38, 200, 150)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(55, 16, 185, 129)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 14, 26))
$g3.FillPath($pgb, $glowPath)
$pgb.Dispose()
$glowPath.Dispose()

Draw-TitleBar $g3 "LeviLamina Server Manager"

# Success Checkmark Badge (54x54)
$badgeSize = 54
$badgeCX = $W / 2
$badgeCY = 76

$rPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 16, 185, 129)), 1.5
$g3.DrawEllipse($rPen, ($badgeCX - $badgeSize/2 - 4), ($badgeCY - $badgeSize/2 - 4), ($badgeSize + 8), ($badgeSize + 8))
$rPen.Dispose()

$bRect = New-Object System.Drawing.RectangleF ($badgeCX - $badgeSize/2), ($badgeCY - $badgeSize/2), $badgeSize, $badgeSize
$lgb = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bRect, ([System.Drawing.Color]::FromArgb(20, 50, 40)), ([System.Drawing.Color]::FromArgb(12, 28, 22)), 45.0
$g3.FillEllipse($lgb, $bRect)
$lgb.Dispose()

$bBorder = New-Object System.Drawing.Pen $colEmerald, 1.5
$g3.DrawEllipse($bBorder, $bRect)
$bBorder.Dispose()

# Smooth Checkmark
$chkPen = New-Object System.Drawing.Pen $colEmeraldLt, 3.2
$chkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$chkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g3.DrawLine($chkPen, ($badgeCX - 11), ($badgeCY + 1), ($badgeCX - 3), ($badgeCY + 10))
$g3.DrawLine($chkPen, ($badgeCX - 3), ($badgeCY + 10), ($badgeCX + 13), ($badgeCY - 9))
$chkPen.Dispose()

# Titles
$fFinTitle = New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)
$finTitle = "Installation Complete!"
$sFin = $g3.MeasureString($finTitle, $fFinTitle)
$g3.DrawString($finTitle, $fFinTitle, $wBrush, (($W - $sFin.Width) / 2), 116)
$fFinTitle.Dispose()

$finSub = "LeviLamina Server Manager is ready to launch."
$sSub = $g3.MeasureString($finSub, $fontHeroSub)
$g3.DrawString($finSub, $fontHeroSub, $grBrush, (($W - $sSub.Width) / 2), 140)

Draw-Footer $g3

$bmp3.Save("$outDir\ui_bg_finish.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$g3.Dispose()
$bmp3.Dispose()
Write-Host "Created ui_bg_finish.bmp (480x340)"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Quick Install CTA Button (ui_btn_install.bmp) 190x38
# ─────────────────────────────────────────────────────────────────────────────
$btnW = 190
$btnH = 38
$bmpBtn = New-Object System.Drawing.Bitmap $btnW, $btnH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gb = [System.Drawing.Graphics]::FromImage($bmpBtn)
$gb.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gb.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$gb.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgFill = New-Object System.Drawing.SolidBrush $colBg
$gb.FillRectangle($bgFill, 0, 0, $btnW, $btnH)
$bgFill.Dispose()

$pillPath = Create-RoundedRectanglePath 1 1 ($btnW - 2) ($btnH - 2) 11

$btnGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $btnW, $btnH), $colEmeraldLt, $colEmeraldDk, 90.0
$gb.FillPath($btnGrad, $pillPath)
$btnGrad.Dispose()

# Top glass shine
$hiPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 255, 255, 255)), 1
$gb.DrawLine($hiPen, 14, 2, ($btnW - 14), 2)
$hiPen.Dispose()

$btnBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 16, 185, 129)), 1
$gb.DrawPath($btnBorder, $pillPath)
$btnBorder.Dispose()
$pillPath.Dispose()

$btnText = "Quick Install"
$sBtn = $gb.MeasureString($btnText, $fontBtnLg)
$btnTextX = ($btnW - $sBtn.Width) / 2
$btnTextY = ($btnH - $sBtn.Height) / 2

$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 0, 45, 20))
$gb.DrawString($btnText, $fontBtnLg, $shadowBrush, ($btnTextX + 1), ($btnTextY + 1))
$shadowBrush.Dispose()

$pureWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$gb.DrawString($btnText, $fontBtnLg, $pureWhite, $btnTextX, $btnTextY)
$pureWhite.Dispose()

$bmpBtn.Save("$outDir\ui_btn_install.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gb.Dispose()
$bmpBtn.Dispose()
Write-Host "Created ui_btn_install.bmp (190x38)"

# ─────────────────────────────────────────────────────────────────────────────
# 4b. Uninstall Button (ui_btn_uninstall.bmp) 190x38
# ─────────────────────────────────────────────────────────────────────────────
$bmpUnBtn = New-Object System.Drawing.Bitmap $btnW, $btnH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gbU = [System.Drawing.Graphics]::FromImage($bmpUnBtn)
$gbU.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gbU.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$gbU.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgFillU = New-Object System.Drawing.SolidBrush $colBg
$gbU.FillRectangle($bgFillU, 0, 0, $btnW, $btnH)
$bgFillU.Dispose()

$pillPathU = Create-RoundedRectanglePath 1 1 ($btnW - 2) ($btnH - 2) 11

$colRedLt = [System.Drawing.Color]::FromArgb(239, 68, 68)   # #EF4444
$colRedDk = [System.Drawing.Color]::FromArgb(185, 28, 28)   # #B91C1C
$btnUnGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $btnW, $btnH), $colRedLt, $colRedDk, 90.0
$gbU.FillPath($btnUnGrad, $pillPathU)
$btnUnGrad.Dispose()

$hiPenU = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 255, 255, 255)), 1
$gbU.DrawLine($hiPenU, 14, 2, ($btnW - 14), 2)
$hiPenU.Dispose()

$btnUnBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 239, 68, 68)), 1
$gbU.DrawPath($btnUnBorder, $pillPathU)
$btnUnBorder.Dispose()
$pillPathU.Dispose()

$unBtnText = "Uninstall"
$sUnBtn = $gbU.MeasureString($unBtnText, $fontBtnLg)
$unBtnTextX = ($btnW - $sUnBtn.Width) / 2
$unBtnTextY = ($btnH - $sUnBtn.Height) / 2

$pureWhiteU = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$gbU.DrawString($unBtnText, $fontBtnLg, $pureWhiteU, $unBtnTextX, $unBtnTextY)
$pureWhiteU.Dispose()

$bmpUnBtn.Save("$outDir\ui_btn_uninstall.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gbU.Dispose()
$bmpUnBtn.Dispose()
Write-Host "Created ui_btn_uninstall.bmp (190x38)"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Browse Button (ui_btn_browse.bmp) 84x24
# ─────────────────────────────────────────────────────────────────────────────
$brW = 84
$brH = 24
$bmpBr = New-Object System.Drawing.Bitmap $brW, $brH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gBr = [System.Drawing.Graphics]::FromImage($bmpBr)
$gBr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gBr.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgFill = New-Object System.Drawing.SolidBrush $colCardBg
$gBr.FillRectangle($bgFill, 0, 0, $brW, $brH)
$bgFill.Dispose()

$brPath = Create-RoundedRectanglePath 1 1 ($brW - 2) ($brH - 2) 4
$brBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 41, 59))
$brPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 90, 125)), 1
$gBr.FillPath($brBrush, $brPath)
$gBr.DrawPath($brPen, $brPath)
$brBrush.Dispose()
$brPen.Dispose()
$brPath.Dispose()

$brText = "Browse..."
$sBr = $gBr.MeasureString($brText, $fontBtnSm)
$gBr.DrawString($brText, $fontBtnSm, $wBrush, (($brW - $sBr.Width)/2), (($brH - $sBr.Height)/2))

$bmpBr.Save("$outDir\ui_btn_browse.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gBr.Dispose()
$bmpBr.Dispose()
Write-Host "Created ui_btn_browse.bmp (84x24)"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Launch Button (ui_btn_launch.bmp) 190x38
# ─────────────────────────────────────────────────────────────────────────────
$bmpLn = New-Object System.Drawing.Bitmap $btnW, $btnH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gLn = [System.Drawing.Graphics]::FromImage($bmpLn)
$gLn.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gLn.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$gLn.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgFill = New-Object System.Drawing.SolidBrush $colBg
$gLn.FillRectangle($bgFill, 0, 0, $btnW, $btnH)
$bgFill.Dispose()

$lnPath = Create-RoundedRectanglePath 1 1 ($btnW - 2) ($btnH - 2) 11
$lnGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $btnW, $btnH), $colEmeraldLt, $colEmeraldDk, 90.0
$gLn.FillPath($lnGrad, $lnPath)
$lnGrad.Dispose()

$lnBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 16, 185, 129)), 1
$gLn.DrawPath($lnBorder, $lnPath)
$lnBorder.Dispose()
$lnPath.Dispose()

$lnText = "Launch Application"
$sLn = $gLn.MeasureString($lnText, $fontBtnMd)
$pureWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$gLn.DrawString($lnText, $fontBtnMd, $pureWhite, (($btnW - $sLn.Width)/2), (($btnH - $sLn.Height)/2))
$pureWhite.Dispose()

$bmpLn.Save("$outDir\ui_btn_launch.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gLn.Dispose()
$bmpLn.Dispose()
Write-Host "Created ui_btn_launch.bmp (190x38)"

# ─────────────────────────────────────────────────────────────────────────────
# 7. Close Button (ui_btn_close.bmp) 28x24
# ─────────────────────────────────────────────────────────────────────────────
$clW = 28
$clH = 24
$bmpCl = New-Object System.Drawing.Bitmap $clW, $clH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gCl = [System.Drawing.Graphics]::FromImage($bmpCl)
$gCl.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$clBg = New-Object System.Drawing.SolidBrush $colTitle
$gCl.FillRectangle($clBg, 0, 0, $clW, $clH)
$clBg.Dispose()

$xPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 215, 235)), 1.3
$gCl.DrawLine($xPen, 9, 7, 19, 17)
$gCl.DrawLine($xPen, 19, 7, 9, 17)
$xPen.Dispose()

$bmpCl.Save("$outDir\ui_btn_close.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gCl.Dispose()
$bmpCl.Dispose()
Write-Host "Created ui_btn_close.bmp (28x24)"

# ─────────────────────────────────────────────────────────────────────────────
# 8. Minimize Button (ui_btn_min.bmp) 28x24
# ─────────────────────────────────────────────────────────────────────────────
$bmpMin = New-Object System.Drawing.Bitmap $clW, $clH, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gMin = [System.Drawing.Graphics]::FromImage($bmpMin)
$gMin.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$minBg = New-Object System.Drawing.SolidBrush $colTitle
$gMin.FillRectangle($minBg, 0, 0, $clW, $clH)
$minBg.Dispose()

$mPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 215, 235)), 1.3
$gMin.DrawLine($mPen, 9, 13, 19, 13)
$mPen.Dispose()

$bmpMin.Save("$outDir\ui_btn_min.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gMin.Dispose()
$bmpMin.Dispose()
Write-Host "Created ui_btn_min.bmp (28x24)"

# Also save 80x80 logo separately
$logoImg = New-Object System.Drawing.Bitmap 80, 80, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$gLogo = [System.Drawing.Graphics]::FromImage($logoImg)
$gLogo.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bgL = New-Object System.Drawing.SolidBrush $colBg
$gLogo.FillRectangle($bgL, 0, 0, 80, 80)
$bgL.Dispose()
$gLogo.DrawImage($sprout, 10, 8, 60, 64)
$logoImg.Save("$outDir\ui_logo.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$gLogo.Dispose()
$logoImg.Dispose()
Write-Host "Created ui_logo.bmp"

# Cleanup
$sprout.Dispose()
$appIcon.Dispose()
$wBrush.Dispose()
$emBrush.Dispose()
$grBrush.Dispose()

Write-Host "All assets generated successfully for 480x340!"
