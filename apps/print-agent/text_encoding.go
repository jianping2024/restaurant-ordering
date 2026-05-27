package main

import "strings"

type paperEncoding int

const (
	paperEncLatin paperEncoding = iota
	paperEncGBK
	paperEncUTF8
)

func normalizeTextEncoding(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "gbk", "gb2312":
		return "gbk"
	case "utf8", "utf-8":
		return "utf8"
	case "latin", "windows1252", "cp1252":
		return "latin"
	default:
		return "auto"
	}
}

func (c *config) resolvePaperEncoding(needChinese bool) paperEncoding {
	if !needChinese {
		return paperEncLatin
	}
	pref := "auto"
	if c != nil {
		pref = normalizeTextEncoding(c.TextEncoding)
	}
	switch pref {
	case "gbk":
		return paperEncGBK
	case "utf8":
		return paperEncUTF8
	case "latin":
		return paperEncLatin
	default:
		// Reference printer UNYKA UK56009 documents Chinese columns + FS & GBK; not UTF-8 on spec sheet.
		return paperEncGBK
	}
}

func loadPaperEncodingForPayload(needChinese bool) paperEncoding {
	cfg, err := loadConfig(defaultConfigPath())
	if err != nil || cfg == nil {
		if needChinese {
			return paperEncGBK
		}
		return paperEncLatin
	}
	return cfg.resolvePaperEncoding(needChinese)
}
