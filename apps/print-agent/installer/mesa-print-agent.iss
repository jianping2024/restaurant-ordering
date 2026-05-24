; Mesa Print Agent — Inno Setup (x64). From apps/print-agent:
;   ISCC /DMyAppVersion=0.1.0 installer\mesa-print-agent.iss

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif

#define MyAppName "Mesa Print Agent"
#define MyAppExe "MesaPrintAgent.exe"
#define MyAppPublisher "Mesa"
#define MyAppURL "https://github.com/jianping2024/restaurant-ordering"

[Setup]
AppId={{A3B8F2E1-9C4D-4A2B-8E1F-0D5C6B7A8E9F}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=MesaPrintAgent-Setup-amd64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autostart"; Description: "Start {#MyAppName} when the current user logs on to Windows"; GroupDescription: "Additional options:"; Flags: checked

[Files]
Source: "..\dist\amd64\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\amd64\VERSION.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "WINDOWS-README.txt"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExe}"""; Flags: uninsdeletevalue; Tasks: autostart

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{group}\Read me"; Filename: "{app}\WINDOWS-README.txt"
