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
PrivilegesRequired=admin
InfoBeforeFile=wizard-before.txt
InfoAfterFile=wizard-after.txt
UninstallDisplayIcon={app}\{#MyAppExe}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
english.AutostartTask=Start %1 when the current user logs on to Windows
english.AutostartTaskDesc=Adds a shortcut to your Windows Startup folder (removed on uninstall). Uncheck if you start the agent manually.
english.LaunchAgent=Launch %1 now (system tray; browser setup if needed)
english.OpenReadme=Open setup guide (Read me)

[Tasks]
Name: "autostart"; Description: "{cm:AutostartTask|{#MyAppName}}"; GroupDescription: "Startup:"; Flags: checked

[Files]
Source: "..\dist\amd64\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\amd64\VERSION.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "WINDOWS-README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "wizard-before.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "wizard-after.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Description: "Run in the system tray"
Name: "{group}\Printer settings"; Filename: "{app}\{#MyAppExe}"; Parameters: "configure"; Description: "Map stations and test print"
Name: "{group}\Setup guide"; Filename: "{app}\WINDOWS-README.txt"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: autostart

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "{cm:LaunchAgent|{#MyAppName}}"; Flags: nowait postinstall skipifsilent checked
Filename: "{app}\WINDOWS-README.txt"; Description: "{cm:OpenReadme}"; Flags: postinstall shellexec skipifsilent unchecked
