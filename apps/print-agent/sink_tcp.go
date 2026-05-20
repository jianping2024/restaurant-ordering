package main

import (
	"net"
	"time"
)

func tcpPrint(hostPort string, data []byte) error {
	c, err := net.DialTimeout("tcp", hostPort, 8*time.Second)
	if err != nil {
		return err
	}
	defer c.Close()
	_ = c.SetWriteDeadline(time.Now().Add(12 * time.Second))
	_, err = c.Write(data)
	return err
}
