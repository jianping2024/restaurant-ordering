//go:build windows

package main

import (
	"log"
	"os"
	"syscall"
	"unsafe"
)

const agentMutexName = "Global\\MesaPrintAgent-SingleInstance-v1"

const errorAlreadyExists = syscall.Errno(183)

// Held until process exit so the mutex stays owned by this instance.
var agentInstanceMutex syscall.Handle

// acquireAgentSingleInstance returns false if another main agent instance is already running.
func acquireAgentSingleInstance() bool {
	if agentInstanceMutex != 0 {
		return true
	}
	name, err := syscall.UTF16PtrFromString(agentMutexName)
	if err != nil {
		return true
	}
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openMutexW := kernel32.NewProc("OpenMutexW")
	createMutexW := kernel32.NewProc("CreateMutexW")
	getLastError := kernel32.NewProc("GetLastError")

	const mutexAllAccess = 0x001F0001
	if existing, _, _ := openMutexW.Call(mutexAllAccess, 0, uintptr(unsafe.Pointer(name))); existing != 0 {
		_ = syscall.CloseHandle(syscall.Handle(existing))
		log.Println("single-instance: OpenMutex found existing agent")
		return false
	}

	// bInitialOwner=TRUE so this instance owns the mutex immediately.
	handle, _, _ := createMutexW.Call(0, 1, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return true
	}
	agentInstanceMutex = syscall.Handle(handle)

	errno, _, _ := getLastError.Call()
	if syscall.Errno(errno) == errorAlreadyExists {
		_ = syscall.CloseHandle(agentInstanceMutex)
		agentInstanceMutex = 0
		log.Println("single-instance: CreateMutex ERROR_ALREADY_EXISTS")
		return false
	}
	return true
}

func exitAlreadyRunning() {
	messageBoxOK(
		"Mesa Print Agent",
		"打印代理已在运行，无法启动第二个实例。\n\n请在任务栏右下角点击 ^ 查看「Mesa Print」托盘图标。\n若需重启，请先在任务管理器中结束所有 MesaPrintAgent.exe，再重新打开。",
	)
	os.Exit(0)
}
