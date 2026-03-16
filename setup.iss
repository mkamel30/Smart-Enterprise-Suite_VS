; Smart Enterprise Suite - Inno Setup Script
; This script generates a Windows Installer (.exe) for the standalone package

#define MyAppName "Smart Enterprise Suite"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Smart Enterprise"
#define MyAppExeName "SmartEnterprise.exe"
#define MyAppServiceName "SmartEnterpriseSuite"
#define MyAppAssocName MyAppName + ""
#define MyAppAssocExt ".ses"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

[Setup]
AppId={{D8C6C38A-9A8E-4A73-BE8C-12A43D0A3D0A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
ChangesAssociations=yes
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=SmartEnterprise-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installservice"; Description: "تثبيت كخدمة ويندوز (يعمل تلقائياً في الخلفية) / Install as Windows Service (Runs automatically in background)"; GroupDescription: "خيارات إضافية / Additional Options"; Flags: unchecked

[Files]
Source: "dist-standalone\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\query_engine-windows.dll.node"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\frontend-dist\*"; DestDir: "{app}\frontend-dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist-standalone\prisma\*"; DestDir: "{app}\prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist-standalone\.env.template"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist-standalone\run.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent; Check: not IsServiceTaskSelected

[UninstallRun]
; Stop and delete service on uninstall if it exists
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyAppServiceName}"; Flags: runhidden; RunOnceId: "StopService"
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyAppServiceName}"; Flags: runhidden; RunOnceId: "DeleteService"
; Remove firewall rule
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Smart Enterprise Suite"""; Flags: runhidden; RunOnceId: "RemoveFirewallRule"

[Code]
function IsServiceTaskSelected: Boolean;
begin
  Result := WizardIsTaskSelected('installservice');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  AppDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    
    // 1. Add Firewall Rule
    Exec('netsh', 'advfirewall firewall add rule name="Smart Enterprise Suite" dir=in action=allow protocol=TCP localport=5000', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    
    // 2. Install as Service if selected
    if IsServiceTaskSelected then
    begin
      // Note: For sc.exe create, the space after binPath= is MANDATORY
      Exec('sc.exe', 'create {#MyAppServiceName} binPath= "' + AppDir + '\{#MyAppExeName}" start= auto displayname= "{#MyAppName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('sc.exe', 'description {#MyAppServiceName} "Backend service for Smart Enterprise Suite"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // Start the service
      Exec('sc.exe', 'start {#MyAppServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      MsgBox('تم تثبيت البرنامج كخدمة ويندوز. سيعمل تلقائياً عند بدء التشغيل.' + #13#10 + 'The application has been installed as a Windows Service. It will start automatically on boot.', mbInformation, MB_OK);
    end;

    // 3. Suggest configuring .env if it doesn't exist
    if not FileExists(AppDir + '\.env') then
    begin
        MsgBox('تنبيه: يجب تهيئة ملف .env في مجلد التثبيت قبل تشغيل البرنامج.' + #13#10 + 'Warning: You must configure the .env file in the installation folder before use.', mbInformation, MB_OK);
    end;
  end;
end;
