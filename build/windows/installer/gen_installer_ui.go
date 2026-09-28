package main

import (
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/png"
	"io"
	"math"
	"os"
)

// ─── BMP 24-bit Writer ───────────────────────────────────────────────────────

func writeBMP24(w io.Writer, img image.Image) error {
	b := img.Bounds()
	width, height := b.Dx(), b.Dy()
	rowSize := (width*3 + 3) &^ 3
	fileSize := 14 + 40 + rowSize*height
	hdr := make([]byte, 14)
	hdr[0], hdr[1] = 'B', 'M'
	binary.LittleEndian.PutUint32(hdr[2:], uint32(fileSize))
	binary.LittleEndian.PutUint32(hdr[10:], 54)
	w.Write(hdr)
	dib := make([]byte, 40)
	binary.LittleEndian.PutUint32(dib[0:], 40)
	binary.LittleEndian.PutUint32(dib[4:], uint32(width))
	binary.LittleEndian.PutUint32(dib[8:], uint32(height))
	binary.LittleEndian.PutUint16(dib[12:], 1)
	binary.LittleEndian.PutUint16(dib[14:], 24)
	w.Write(dib)
	row := make([]byte, rowSize)
	for y := b.Max.Y - 1; y >= b.Min.Y; y-- {
		for i := range row {
			row[i] = 0
		}
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, bl, _ := img.At(x, y).RGBA()
			i := (x - b.Min.X) * 3
			row[i] = byte(bl >> 8)
			row[i+1] = byte(g >> 8)
			row[i+2] = byte(r >> 8)
		}
		w.Write(row)
	}
	return nil
}

func saveBMP(path string, img image.Image) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return writeBMP24(f, img)
}

// ─── Drawing Primitives ───────────────────────────────────────────────────────

func blend(dst *image.RGBA, x, y int, c color.RGBA) {
	if x < 0 || y < 0 || x >= dst.Bounds().Dx() || y >= dst.Bounds().Dy() {
		return
	}
	if c.A == 255 {
		dst.SetRGBA(x, y, c)
		return
	}
	if c.A == 0 {
		return
	}
	orig := dst.RGBAAt(x, y)
	a := float64(c.A) / 255
	dst.SetRGBA(x, y, color.RGBA{
		R: uint8(float64(c.R)*a + float64(orig.R)*(1-a)),
		G: uint8(float64(c.G)*a + float64(orig.G)*(1-a)),
		B: uint8(float64(c.B)*a + float64(orig.B)*(1-a)),
		A: 255,
	})
}

func fillRect(dst *image.RGBA, x, y, w, h int, c color.RGBA) {
	for dy := 0; dy < h; dy++ {
		for dx := 0; dx < w; dx++ {
			blend(dst, x+dx, y+dy, c)
		}
	}
}

func drawGlow(dst *image.RGBA, cx, cy, radius int, r, g, b uint8, maxAlpha float64) {
	for dy := -radius; dy <= radius; dy++ {
		for dx := -radius; dx <= radius; dx++ {
			dist := math.Sqrt(float64(dx*dx + dy*dy))
			if dist > float64(radius) {
				continue
			}
			t := 1.0 - dist/float64(radius)
			alpha := t * t * maxAlpha
			blend(dst, cx+dx, cy+dy, color.RGBA{r, g, b, uint8(alpha * 255)})
		}
	}
}

func drawRoundRect(dst *image.RGBA, x, y, w, h, r int, c color.RGBA) {
	for dy := 0; dy < h; dy++ {
		for dx := 0; dx < w; dx++ {
			px, py := x+dx, y+dy
			inCorner := false
			var cx, cy int
			if dx < r && dy < r {
				cx, cy = x+r, y+r
				inCorner = true
			} else if dx >= w-r && dy < r {
				cx, cy = x+w-r-1, y+r
				inCorner = true
			} else if dx < r && dy >= h-r {
				cx, cy = x+r, y+h-r-1
				inCorner = true
			} else if dx >= w-r && dy >= h-r {
				cx, cy = x+w-r-1, y+h-r-1
				inCorner = true
			}
			if inCorner {
				dist := math.Sqrt(float64((px-cx)*(px-cx) + (py-cy)*(py-cy)))
				if dist > float64(r) {
					continue
				}
			}
			blend(dst, px, py, c)
		}
	}
}

func hLine(dst *image.RGBA, x, y, w int, c color.RGBA) {
	for dx := 0; dx < w; dx++ {
		blend(dst, x+dx, y, c)
	}
}

func vGradient(dst *image.RGBA, x, y, w, h int, c1, c2 color.RGBA) {
	for dy := 0; dy < h; dy++ {
		t := float64(dy) / float64(h)
		c := color.RGBA{
			R: uint8(float64(c1.R)*(1-t) + float64(c2.R)*t),
			G: uint8(float64(c1.G)*(1-t) + float64(c2.G)*t),
			B: uint8(float64(c1.B)*(1-t) + float64(c2.B)*t),
			A: 255,
		}
		for dx := 0; dx < w; dx++ {
			blend(dst, x+dx, y+dy, c)
		}
	}
}

func drawRing(dst *image.RGBA, cx, cy, radius, thickness int, c color.RGBA) {
	for dy := -radius - thickness; dy <= radius+thickness; dy++ {
		for dx := -radius - thickness; dx <= radius+thickness; dx++ {
			dist := math.Sqrt(float64(dx*dx + dy*dy))
			inner := float64(radius - thickness/2)
			outer := float64(radius + thickness/2)
			if dist >= inner && dist <= outer {
				frac := 1.0 - math.Abs(dist-float64(radius))/float64(thickness/2+1)
				if frac > 0 {
					fc := c
					fc.A = uint8(float64(c.A) * frac)
					blend(dst, cx+dx, cy+dy, fc)
				}
			}
		}
	}
}

// ─── Colors ──────────────────────────────────────────────────────────────────

var (
	colBg       = color.RGBA{8, 13, 24, 255}    // #080D18
	colTitleBar = color.RGBA{11, 18, 32, 255}   // #0B1220
	colSep      = color.RGBA{25, 38, 62, 255}   // #19263E
	colEmerald  = color.RGBA{16, 185, 129, 255} // #10B981
	colEmerLt   = color.RGBA{52, 211, 153, 255} // #34D399
	colWhite    = color.RGBA{241, 245, 249, 255} // #F1F5F9
	colGray     = color.RGBA{148, 163, 184, 255} // #94A3B8
)

// ─── Built-in Base Canvas with Dot Grid ───────────────────────────────────────

func createThemedCanvas(W, H int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, W, H))

	// Base gradient
	for y := 0; y < H; y++ {
		t := float64(y) / float64(H)
		r := uint8(8*(1-t) + 6*t)
		g := uint8(13*(1-t) + 10*t)
		b := uint8(24*(1-t) + 18*t)
		for x := 0; x < W; x++ {
			img.SetRGBA(x, y, color.RGBA{r, g, b, 255})
		}
	}

	// Title bar
	vGradient(img, 0, 0, W, 44, color.RGBA{14, 22, 38, 255}, colTitleBar)
	hLine(img, 0, 44, W, colSep)

	// Dot-grid pattern in content area
	gridCol := color.RGBA{22, 34, 54, 180}
	for y := 56; y < H-50; y += 18 {
		for x := 12; x < W-12; x += 18 {
			blend(img, x, y, gridCol)
		}
	}

	// Footer area
	vGradient(img, 0, H-54, W, 54, color.RGBA{7, 11, 20, 255}, color.RGBA{5, 8, 15, 255})
	hLine(img, 0, H-54, W, colSep)

	// Side accents
	for y := 0; y < H; y++ {
		t := math.Abs(float64(y)-float64(H)/2) / float64(H/2)
		a := uint8((1 - t) * 90)
		blend(img, 0, y, color.RGBA{16, 185, 129, a})
		blend(img, W-1, y, color.RGBA{16, 185, 129, a / 3})
	}

	return img
}

// ─── Button Generators ────────────────────────────────────────────────────────

func generatePillButton(text string, W, H int, state int) *image.RGBA {
	// state: 0=normal, 1=hover, 2=pressed
	img := image.NewRGBA(image.Rect(0, 0, W, H))

	var cTop, cBot color.RGBA
	switch state {
	case 1: // hover: lighter emerald
		cTop = color.RGBA{52, 211, 153, 255}
		cBot = color.RGBA{16, 185, 129, 255}
	case 2: // pressed: darker emerald
		cTop = color.RGBA{5, 150, 105, 255}
		cBot = color.RGBA{4, 120, 87, 255}
	default: // normal
		cTop = color.RGBA{16, 185, 129, 255}
		cBot = color.RGBA{5, 150, 105, 255}
	}

	// Transparent outer corners fill with dialog bg
	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			img.SetRGBA(x, y, colBg)
		}
	}

	r := H / 2
	drawRoundRect(img, 0, 0, W, H, r, cTop)
	vGradient(img, 0, 0, W, H, cTop, cBot)

	// Re-apply rounded pill mask
	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			inCorner := false
			var cx, cy int
			if x < r && y < r {
				cx, cy = r, r
				inCorner = true
			} else if x >= W-r && y < r {
				cx, cy = W-r-1, r
				inCorner = true
			} else if x < r && y >= H-r {
				cx, cy = r, H-r-1
				inCorner = true
			} else if x >= W-r && y >= H-r {
				cx, cy = W-r-1, H-r-1
				inCorner = true
			}
			if inCorner {
				dist := math.Sqrt(float64((x-cx)*(x-cx) + (y-cy)*(y-cy)))
				if dist > float64(r) {
					img.SetRGBA(x, y, colBg)
				}
			}
		}
	}

	// Inner top highlight
	hlA := uint8(80)
	if state == 1 {
		hlA = 120
	}
	if state != 2 {
		for x := r; x < W-r; x++ {
			blend(img, x, 1, color.RGBA{255, 255, 255, hlA})
		}
	}

	return img
}

func generateCloseButton(state int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	var bgC, xC color.RGBA
	switch state {
	case 1: // hover
		bgC = color.RGBA{220, 38, 38, 255} // red
		xC = colWhite
	case 2: // pressed
		bgC = color.RGBA{153, 27, 27, 255}
		xC = colWhite
	default:
		bgC = colTitleBar
		xC = colGray
	}
	fillRect(img, 0, 0, 32, 32, bgC)
	// Draw X
	for d := 0; d < 12; d++ {
		blend(img, 10+d, 10+d, xC)
		blend(img, 10+d+1, 10+d, xC)
		blend(img, 10+11-d, 10+d, xC)
		blend(img, 10+12-d, 10+d, xC)
	}
	return img
}

func generateMinButton(state int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	var bgC, minC color.RGBA
	switch state {
	case 1: // hover
		bgC = color.RGBA{30, 45, 75, 255}
		minC = colWhite
	case 2: // pressed
		bgC = color.RGBA{15, 25, 45, 255}
		minC = colWhite
	default:
		bgC = colTitleBar
		minC = colGray
	}
	fillRect(img, 0, 0, 32, 32, bgC)
	for dx := 0; dx < 12; dx++ {
		blend(img, 10+dx, 16, minC)
		blend(img, 10+dx, 17, minC)
	}
	return img
}

func generateBrowseButton(hover bool) *image.RGBA {
	W, H := 110, 32
	img := image.NewRGBA(image.Rect(0, 0, W, H))
	bgC := color.RGBA{18, 28, 48, 255}
	borderC := colSep
	if hover {
		bgC = color.RGBA{25, 40, 68, 255}
		borderC = colEmerald
	}
	drawRoundRect(img, 0, 0, W, H, 6, bgC)
	for x := 0; x < W; x++ {
		blend(img, x, 0, borderC)
		blend(img, x, H-1, borderC)
	}
	for y := 0; y < H; y++ {
		blend(img, 0, y, borderC)
		blend(img, W-1, y, borderC)
	}
	return img
}

func main() {
	W, H := 675, 475

	// Load target_ui.png
	f, err := os.Open("target_ui.png")
	if err != nil {
		fmt.Println("Error opening target_ui.png:", err)
		return
	}
	defer f.Close()

	targetImg, _, err := image.Decode(f)
	if err != nil {
		fmt.Println("Decode error target_ui.png:", err)
		return
	}

	// 1. Process Welcome Background: copy target_ui.png, fill behind button
	bgWelcome := image.NewRGBA(image.Rect(0, 0, W, H))
	draw.Draw(bgWelcome, bgWelcome.Bounds(), targetImg, image.Point{}, draw.Src)

	btnX, btnY, btnW, btnH := 202, 312, 270, 40
	colDark := color.RGBA{8, 13, 24, 255}
	gridCol := color.RGBA{22, 34, 54, 255}
	for y := btnY - 2; y < btnY+btnH+2; y++ {
		for x := btnX - 2; x < btnX+btnW+2; x++ {
			c := colDark
			if (x%18 == 0 || x%18 == 1) && (y%18 == 0 || y%18 == 1) {
				c = gridCol
			}
			bgWelcome.SetRGBA(x, y, c)
		}
	}
	saveBMP("ui_bg.bmp", bgWelcome)
	fmt.Println("Saved ui_bg.bmp (675x475)")

	// 2. Extract Quick Install button (normal, hover, pressed)
	btnNorm := image.NewRGBA(image.Rect(0, 0, btnW, btnH))
	btnHover := image.NewRGBA(image.Rect(0, 0, btnW, btnH))
	btnPress := image.NewRGBA(image.Rect(0, 0, btnW, btnH))

	for dy := 0; dy < btnH; dy++ {
		for dx := 0; dx < btnW; dx++ {
			c := color.RGBAModel.Convert(targetImg.At(btnX+dx, btnY+dy)).(color.RGBA)
			btnNorm.SetRGBA(dx, dy, c)

			// Hover
			hR := uint8(math.Min(255, float64(c.R)*1.25))
			hG := uint8(math.Min(255, float64(c.G)*1.22))
			hB := uint8(math.Min(255, float64(c.B)*1.25))
			btnHover.SetRGBA(dx, dy, color.RGBA{hR, hG, hB, c.A})

			// Pressed
			pR := uint8(float64(c.R) * 0.78)
			pG := uint8(float64(c.G) * 0.78)
			pB := uint8(float64(c.B) * 0.78)
			btnPress.SetRGBA(dx, dy, color.RGBA{pR, pG, pB, c.A})
		}
	}
	saveBMP("ui_btn_install.bmp", btnNorm)
	saveBMP("ui_btn_install_h.bmp", btnHover)
	saveBMP("ui_btn_install_p.bmp", btnPress)
	fmt.Println("Saved ui_btn_install states (270x40)")

	// Extract the logo card from target_ui.png (around x=275, y=75, size 125x125)
	logoCard := image.NewRGBA(image.Rect(0, 0, 130, 130))
	for dy := 0; dy < 130; dy++ {
		for dx := 0; dx < 130; dx++ {
			c := color.RGBAModel.Convert(targetImg.At(272+dx, 70+dy)).(color.RGBA)
			logoCard.SetRGBA(dx, dy, c)
		}
	}
	saveBMP("ui_logo.bmp", logoCard)
	fmt.Println("Saved ui_logo.bmp (130x130)")

	// 3. Options Background (675x475)
	bgOptions := createThemedCanvas(W, H)
	// Titlebar logo + text copied from targetImg
	for y := 0; y < 44; y++ {
		for x := 0; x < 260; x++ {
			bgOptions.SetRGBA(x, y, color.RGBAModel.Convert(targetImg.At(x, y)).(color.RGBA))
		}
	}
	// Card for options
	drawRoundRect(bgOptions, 60, 130, W-120, 240, 10, color.RGBA{13, 20, 36, 220})
	drawRing(bgOptions, 60+10, 130+10, 10, 1, colSep)
	saveBMP("ui_bg_options.bmp", bgOptions)
	fmt.Println("Saved ui_bg_options.bmp")

	// 4. Directory Background (675x475)
	bgDir := createThemedCanvas(W, H)
	for y := 0; y < 44; y++ {
		for x := 0; x < 260; x++ {
			bgDir.SetRGBA(x, y, color.RGBAModel.Convert(targetImg.At(x, y)).(color.RGBA))
		}
	}
	drawRoundRect(bgDir, 60, 140, W-120, 140, 10, color.RGBA{13, 20, 36, 220})
	saveBMP("ui_bg_dir.bmp", bgDir)
	fmt.Println("Saved ui_bg_dir.bmp")

	// 5. Installing Page Background (675x475)
	bgInstall := createThemedCanvas(W, H)
	for y := 0; y < 44; y++ {
		for x := 0; x < 260; x++ {
			bgInstall.SetRGBA(x, y, color.RGBAModel.Convert(targetImg.At(x, y)).(color.RGBA))
		}
	}
	// Place centered logo card with glow
	drawGlow(bgInstall, W/2, 135, 80, 16, 185, 129, 0.22)
	for dy := 0; dy < 130; dy++ {
		for dx := 0; dx < 130; dx++ {
			c := logoCard.RGBAAt(dx, dy)
			blend(bgInstall, W/2-65+dx, 70+dy, c)
		}
	}
	// Progress bar track at (80, 260, 515, 16)
	drawRoundRect(bgInstall, 80, 260, 515, 16, 8, color.RGBA{13, 20, 36, 255})
	for x := 80; x < 80+515; x++ {
		blend(bgInstall, x, 260, colSep)
		blend(bgInstall, x, 260+15, colSep)
	}
	saveBMP("ui_bg_install.bmp", bgInstall)
	fmt.Println("Saved ui_bg_install.bmp")

	// 6. Finish Page Background (675x475)
	bgFinish := createThemedCanvas(W, H)
	for y := 0; y < 44; y++ {
		for x := 0; x < 260; x++ {
			bgFinish.SetRGBA(x, y, color.RGBAModel.Convert(targetImg.At(x, y)).(color.RGBA))
		}
	}
	// Big green glowing checkmark
	drawGlow(bgFinish, W/2, 125, 85, 16, 185, 129, 0.25)
	drawRing(bgFinish, W/2, 125, 48, 3, color.RGBA{16, 185, 129, 230})
	drawRing(bgFinish, W/2, 125, 46, 1, color.RGBA{52, 211, 153, 160})
	// Checkmark path
	chkCol := color.RGBA{16, 185, 129, 255}
	cx, cy := W/2, 125
	for t := 0; t < 16; t++ {
		blend(bgFinish, cx-14+t, cy+t-3, chkCol)
		blend(bgFinish, cx-14+t, cy+t-2, chkCol)
		blend(bgFinish, cx-14+t, cy+t-4, chkCol)
	}
	for t := 0; t < 26; t++ {
		blend(bgFinish, cx+2+t, cy+13-t-3, chkCol)
		blend(bgFinish, cx+2+t, cy+13-t-2, chkCol)
		blend(bgFinish, cx+2+t, cy+13-t-4, chkCol)
	}
	saveBMP("ui_bg_finish.bmp", bgFinish)
	fmt.Println("Saved ui_bg_finish.bmp")

	// 7. Uninstaller Background
	bgUninst := createThemedCanvas(W, H)
	for y := 0; y < 44; y++ {
		for x := 0; x < 260; x++ {
			bgUninst.SetRGBA(x, y, color.RGBAModel.Convert(targetImg.At(x, y)).(color.RGBA))
		}
	}
	drawRoundRect(bgUninst, 60, 130, W-120, 160, 10, color.RGBA{13, 20, 36, 220})
	saveBMP("ui_bg_uninst.bmp", bgUninst)
	fmt.Println("Saved ui_bg_uninst.bmp")

	// 8. Next and Finish Buttons (160x44)
	saveBMP("ui_btn_next.bmp", generatePillButton("Next", 160, 44, 0))
	saveBMP("ui_btn_next_h.bmp", generatePillButton("Next", 160, 44, 1))
	saveBMP("ui_btn_next_p.bmp", generatePillButton("Next", 160, 44, 2))
	saveBMP("ui_btn_finish.bmp", generatePillButton("Finish", 160, 44, 0))
	saveBMP("ui_btn_finish_h.bmp", generatePillButton("Finish", 160, 44, 1))
	saveBMP("ui_btn_finish_p.bmp", generatePillButton("Finish", 160, 44, 2))
	saveBMP("ui_btn_uninstall.bmp", generatePillButton("Uninstall", 200, 44, 0))

	// 9. Window and tool buttons
	saveBMP("ui_btn_browse.bmp", generateBrowseButton(false))
	saveBMP("ui_btn_browse_h.bmp", generateBrowseButton(true))
	saveBMP("ui_btn_close.bmp", generateCloseButton(0))
	saveBMP("ui_btn_close_h.bmp", generateCloseButton(1))
	saveBMP("ui_btn_close_p.bmp", generateCloseButton(2))
	saveBMP("ui_btn_min.bmp", generateMinButton(0))
	saveBMP("ui_btn_min_h.bmp", generateMinButton(1))
	saveBMP("ui_btn_min_p.bmp", generateMinButton(2))

	fmt.Println("All 675x475 assets generated successfully!")
}
