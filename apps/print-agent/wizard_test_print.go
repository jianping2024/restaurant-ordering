package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

type testPrintRequest struct {
	StationID string `json:"station_id"`
	Printer   string `json:"printer,omitempty"`
}

func runTestPrintForStation(cfg *config, stationID, printerOverride string) error {
	if cfg == nil {
		return fmt.Errorf("未加载配置")
	}
	stationID = strings.TrimSpace(stationID)
	printerOverride = strings.TrimSpace(printerOverride)

	var rawAddr string
	if printerOverride != "" {
		rawAddr = printerOverride
	} else if stationID != "" && cfg.StationPrinters != nil {
		rawAddr = strings.TrimSpace(cfg.StationPrinters[stationID])
	}
	if rawAddr == "" {
		for sid, v := range cfg.StationPrinters {
			if strings.TrimSpace(v) != "" {
				stationID = sid
				rawAddr = strings.TrimSpace(v)
				break
			}
		}
	}
	if rawAddr == "" {
		return fmt.Errorf("请先为至少一个出品档口选择打印机并保存")
	}

	target, err := parsePrinterTarget(rawAddr)
	if err != nil {
		return err
	}

	venue := "Mesa"
	if u := strings.TrimSpace(cfg.APIBase); u != "" {
		venue = u
		if i := strings.Index(u, "://"); i >= 0 {
			venue = strings.TrimPrefix(u[i+3:], "www.")
			if j := strings.IndexAny(venue, "/:"); j > 0 {
				venue = venue[:j]
			}
		}
	}

	payload := jobPayload{
		ConnectionTest: true,
		Locale:         "zh",
		RestaurantName: venue,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	job := printJob{Type: "order_receipt", Payload: raw}
	data := escposFromJob(job)
	if err := printToTarget(target, data); err != nil {
		return fmt.Errorf("打印失败（%s）：%w", target.Display, err)
	}
	return nil
}
