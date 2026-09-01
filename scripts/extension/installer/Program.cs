using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32;

namespace SLTBridgeInstaller
{
    class Program
    {
        const string ExtensionId = "mhbnhnpammnagfmgomcpakeeohbnkajm";
        const string UpdateManifest = "https://sltserp.vercel.app/slt-bridge-updates.xml";
        const string PolicyPath = @"Software\Policies\Google\Chrome\ExtensionInstallForcelist";
        const string ExtensionDir = "SLT-Bridge-Extension";
        const string ShortcutName = "Chrome with SLT-Bridge";

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

        const uint MB_OK = 0;
        const uint MB_ICONINFORMATION = 0x40;
        const uint MB_ICONERROR = 0x10;
        const uint MB_YESNO = 0x4;

        static bool IsAdmin()
        {
            using (var identity = WindowsIdentity.GetCurrent())
            {
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }

        static void Main(string[] args)
        {
            try
            {
                if (args.Length > 0 && args[0] == "--uninstall")
                {
                    Uninstall();
                    return;
                }

                // Step 1: Clean up dead HKLM policy (needs admin)
                if (!IsAdmin())
                {
                    var result = MessageBox(IntPtr.Zero,
                        "SLT-ERP Bridge Installer\n\n" +
                        "This will:\n" +
                        "1. Remove old Chrome policy (requires admin)\n" +
                        "2. Install extension via --load-extension\n" +
                        "3. Create Desktop shortcut\n\n" +
                        "Click Yes to continue.",
                        "SLT-ERP Bridge Install",
                        MB_YESNO | MB_ICONINFORMATION);

                    if (result != 6) return;

                    var exe = Process.GetCurrentProcess().MainModule!.FileName!;
                    var psi = new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas"
                    };
                    Process.Start(psi);
                    return;
                }

                // We are admin - clean up dead HKLM policy
                CleanUpDeadPolicy();

                // Step 2: Set up --load-extension approach (no admin needed)
                SetupLoadExtension();

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge installed successfully!\n\n" +
                    "Chrome will restart with the extension loaded.\n" +
                    "A Desktop shortcut 'Chrome with SLT-Bridge' was created.\n\n" +
                    "Use this shortcut to start Chrome with the extension.\n" +
                    "If a yellow bar appears, click 'Keep changes'.",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONINFORMATION);

                // Restart Chrome with extension
                RestartChromeWithExtension();
            }
            catch (System.ComponentModel.Win32Exception)
            {
                return; // User clicked No on UAC
            }
            catch (Exception ex)
            {
                MessageBox(IntPtr.Zero,
                    $"Installation failed:\n{ex.Message}",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONERROR);
            }
        }

        static void CleanUpDeadPolicy()
        {
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(PolicyPath, true))
                {
                    if (key != null)
                    {
                        foreach (var name in key.GetValueNames())
                        {
                            var val = key.GetValue(name)?.ToString();
                            if (val != null && val.StartsWith(ExtensionId))
                            {
                                key.DeleteValue(name);
                            }
                        }
                    }
                }
            }
            catch { /* Policy cleanup is best-effort */ }
        }

        static void SetupLoadExtension()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string extDir = Path.Combine(localAppData, ExtensionDir);

            // Extension should already be extracted by the batch file or previous install
            if (!Directory.Exists(extDir) || !File.Exists(Path.Combine(extDir, "manifest.json")))
            {
                throw new DirectoryNotFoundException(
                    $"Extension not found at {extDir}\n\n" +
                    "Please run Install-SLTBridge-NoAdmin.bat first to extract the extension.");
            }

            // Create Desktop shortcut
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string shortcutPath = Path.Combine(desktop, $"{ShortcutName}.lnk");

            try
            {
                // Use PowerShell to create shortcut
                string psCmd = $"$ws = New-Object -ComObject WScript.Shell; " +
                    $"$sc = $ws.CreateShortcut('{shortcutPath}'); " +
                    $"$sc.TargetPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; " +
                    $"$sc.Arguments = '--load-extension=\"{extDir}\"'; " +
                    $"$sc.Description = 'Chrome with SLT-ERP Bridge extension'; " +
                    $"$sc.IconLocation = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,0'; " +
                    $"$sc.Save()";

                var psi = new ProcessStartInfo("powershell.exe")
                {
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{psCmd}\"",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                var proc = Process.Start(psi);
                proc?.WaitForExit(5000);
            }
            catch { /* Shortcut creation is best-effort */ }
        }

        static void RestartChromeWithExtension()
        {
            try
            {
                // Kill all Chrome processes
                foreach (var p in Process.GetProcessesByName("chrome"))
                {
                    p.Kill();
                }
                System.Threading.Thread.Sleep(2000);

                // Start Chrome with --load-extension
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string extDir = Path.Combine(localAppData, ExtensionDir);

                Process.Start(new ProcessStartInfo("chrome")
                {
                    Arguments = $"--load-extension=\"{extDir}\"",
                    UseShellExecute = true
                });
            }
            catch { /* Chrome restart is best-effort */ }
        }

        static void Uninstall()
        {
            try
            {
                if (!IsAdmin())
                {
                    var exe = Process.GetCurrentProcess().MainModule!.FileName!;
                    Process.Start(new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas",
                        Arguments = "--uninstall"
                    });
                    return;
                }

                // Clean up dead policy
                CleanUpDeadPolicy();

                // Remove extension directory
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string extDir = Path.Combine(localAppData, ExtensionDir);
                if (Directory.Exists(extDir))
                {
                    Directory.Delete(extDir, true);
                }

                // Remove Desktop shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string shortcutPath = Path.Combine(desktop, $"{ShortcutName}.lnk");
                if (File.Exists(shortcutPath))
                {
                    File.Delete(shortcutPath);
                }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge uninstalled successfully!\n\n" +
                    "Restart Chrome normally (without the shortcut) to complete.",
                    "SLT-ERP Bridge Uninstall",
                    MB_OK | MB_ICONINFORMATION);
            }
            catch (System.ComponentModel.Win32Exception)
            {
                return;
            }
            catch (Exception ex)
            {
                MessageBox(IntPtr.Zero,
                    $"Uninstall failed:\n{ex.Message}",
                    "SLT-ERP Bridge Uninstall",
                    MB_OK | MB_ICONERROR);
            }
        }
    }
}
