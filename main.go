package main

import (
	"context"
	"embed"
	"fmt"
	"unsafe"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	syswindows "golang.org/x/sys/windows"

	"levilamina-server-manager/backend"
)

//go:embed all:frontend/dist
var assets embed.FS

var (
	user32              = syswindows.NewLazySystemDLL("user32.dll")
	procSetForeground   = user32.NewProc("SetForegroundWindow")
	procShowWindowAsync = user32.NewProc("ShowWindowAsync")
	procFindWindowW     = user32.NewProc("FindWindowW")
)

const swRestore = 9

func showNativeError(title, msg string) {
	titlePtr, _ := syswindows.UTF16PtrFromString(title)
	msgPtr, _ := syswindows.UTF16PtrFromString(msg)
	syswindows.MessageBox(0, msgPtr, titlePtr, syswindows.MB_OK|syswindows.MB_ICONERROR)
}

// forceWindowToFront uses Win32 to reliably restore and foreground the existing
// window, bypassing Windows focus-steal prevention heuristics.
func forceWindowToFront() {
	titlePtr, _ := syswindows.UTF16PtrFromString("LeviLamina Server Manager")
	hwnd, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(nil)), uintptr(unsafe.Pointer(titlePtr)))
	if hwnd != 0 {
		procShowWindowAsync.Call(hwnd, swRestore)
		procSetForeground.Call(hwnd)
	}
}

func main() {
	app, err := backend.NewApp()
	if err != nil {
		showNativeError("LeviLamina Server Manager - Startup Error",
			fmt.Sprintf("Failed to initialize application database and subsystems:\n\n%v\n\nPlease ensure your user profile directory (~/.llsm) is writable.", err))
		return
	}

	err = wails.Run(&options.App{
		Title:     "LeviLamina Server Manager",
		Width:     1320,
		Height:    860,
		MinWidth:  1080,
		MinHeight: 700,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 243, G: 245, B: 248, A: 255},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		OnBeforeClose: func(ctx context.Context) bool {
			app.Shutdown(ctx)
			return false
		},
		Bind: []interface{}{
			app,
		},
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			BackdropType:                      windows.Mica,
			DisableFramelessWindowDecorations: false,
		},
		// Single-instance lock: if this app is already running, the second launch
		// is silently dropped and the original window is restored & focused instead.
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "e3b0c442-98fc-1c14-b39f-4c8c3b2e8e7d",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				// Use Wails runtime to unminimise + show, then Win32 to force focus
				app.BringToFront()
				forceWindowToFront()
			},
		},
	})

	if err != nil {
		showNativeError("LeviLamina Server Manager - Runtime Error",
			fmt.Sprintf("Application encountered an unrecoverable window/rendering error:\n\n%v\n\nIf Microsoft Edge WebView2 is not installed on this machine, please install the Microsoft Edge WebView2 Runtime.", err))
	}
}
