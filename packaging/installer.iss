; Smart Enterprise Suite - Inno Setup Script
; This script creates a Windows installer for the Smart Enterprise Suite

#define MyAppName "Smart Enterprise Suite"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Smart Enterprise"
#define MyAppExeName "smart-enterprise-win-x64.exe"
#define MyAppURL "https://github.com/mkamel30/Smart-Enterprise-Suite"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=..\installer
OutputBaseFilename=SmartEnterpriseSuite-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "firewall"; Description: "Configure Windows Firewall rules (ports 5002, 5173)"; GroupDescription: "System Setup:"; Flags: checked
Name: "service"; Description: "Register as Windows Service (auto-start)"; GroupDescription: "System Setup:"; Flags: checked

[Files]
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\backend\prisma\dev.db"; DestDir: "{app}\data"; Flags: ignoreversion
Source: "..\dist\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: DirExists(ExpandConstant('{app}\dist\resources'))

[Dirs]
Name: "{app}\data"
Name: "{app}\logs"
Name: "{app}\backups"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
function DirExists(DirName: String): Boolean;
begin
  Result := DirExists(DirName);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // Configure Windows Firewall
    if IsTaskSelected('firewall') then
    begin
      Exec('netsh', 'advfirewall firewall add rule name="Smart Enterprise Backend" dir=in action=allow protocol=TCP localport=5002 program="{app}\{#MyAppExeName}" enable=yes', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('netsh', 'advfirewall firewall add rule name="Smart Enterprise Frontend" dir=in action=allow protocol=TCP localport=5173 program="{app}\{#MyAppExeName}" enable=yes', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // Register Windows Service
    if IsTaskSelected('service') then
    begin
      // Install as Windows Service using NSSM or sc.exe
      Exec('sc', 'create SmartEnterpriseSuite binPath= "{app}\{#MyAppExeName} --service" DisplayName= "{#MyAppName}" start= auto', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\backups"
