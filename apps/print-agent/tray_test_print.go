package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// runTrayTestPrint sends a connection-test slip to the first mapped station printer.
func runTrayTestPrint(cfg *config) error {
	if cfg == nil || !cfg.hasPrinterRouting() {
		return fmt.Errorf("请先在「打印机设置」中映射至少一个出品档口")
	}
	var rawAddr string
	for _, v := range cfg.StationPrinters {
		if strings.TrimSpace(v) != "" {
			rawAddr = strings.TrimSpace(v)
			break
		}
	}
	if rawAddr == "" {
		return fmt.Errorf("未找到已映射的打印机")
	}
	target, err := parsePrinterTarget(rawAddr)
	if err != nil {
		return err
	}
	locale := "zh"
	payload := jobPayload{
		ConnectionTest: true,
		Locale:         locale,
		RestaurantName: "Mesa",
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
