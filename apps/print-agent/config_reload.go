package main

// reloadAgentSessionConfig refreshes in-memory config from disk (configure UI saves).
func reloadAgentSessionConfig(sess *agentSession) {
	if sess == nil {
		return
	}
	path := sess.cfgPath
	if path == "" {
		path = defaultConfigPath()
	}
	prev := sess.cfg
	cfg, err := loadConfig(path)
	if err != nil || cfg == nil {
		return
	}
	if prev != nil {
		sess.printerReady().noteMappingChanges(cfg, path, prev, cfg)
	}
	sess.cfg = cfg
}
