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
        const string PolicyPath = @"Software\Policies\Google\Chrome\ExtensionInstallForcelist";
        const string ExtensionDir = @"C:\SLT-Bridge";

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
                        "2. Extract extension files\n" +
                        "3. Open Chrome for manual load\n\n" +
                        "Click Yes to continue.",
                        "SLT-ERP Bridge Install",
                        MB_YESNO | MB_ICONINFORMATION);

                    if (result != 6) return;

                    var exe = Process.GetCurrentProcess().MainModule!.FileName!;
                    Process.Start(new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas"
                    });
                    return;
                }

                // We are admin - clean up dead HKLM policy
                CleanUpDeadPolicy();

                // Step 2: Extract extension (should already be done by batch, but verify)
                if (!Directory.Exists(ExtensionDir) || !File.Exists(Path.Combine(ExtensionDir, "manifest.json")))
                {
                    MessageBox(IntPtr.Zero,
                        "Extension files not found at:\n" + ExtensionDir + "\n\n" +
                        "Please run Install-SLTBridge-NoAdmin.bat first to extract the extension.",
                        "SLT-ERP Bridge Install",
                        MB_OK | MB_ICONERROR);
                    return;
                }

                // Step 3: Open chrome://extensions and show instructions
                Process.Start(new ProcessStartInfo("chrome")
                {
                    Arguments = "chrome://extensions",
                    UseShellExecute = true
                });

                // Copy path to clipboard via PowerShell
                try
                {
                    var psi = new ProcessStartInfo("powershell.exe")
                    {
                        Arguments = $"-NoProfile -Command \"Set-Clipboard -Value '{ExtensionDir}'\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    var proc = Process.Start(psi);
                    proc?.WaitForExit(3000);
                }
                catch { /* Clipboard is best-effort */ }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge - Final Step\n\n" +
                    "Extension files extracted to:\n" + ExtensionDir + "\n\n" +
                    "Path copied to clipboard.\n\n" +
                    "In Chrome:\n" +
                    "1. Enable 'Developer mode' (top-right)\n" +
                    "2. Click 'Load unpacked'\n" +
                    "3. Paste path (Ctrl+V)\n" +
                    "4. Click 'Select Folder'",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONINFORMATION);
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
                if (Directory.Exists(ExtensionDir))
                {
                    Directory.Delete(ExtensionDir, true);
                }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge uninstalled!\n\n" +
                    "Also remove from Chrome:\n" +
                    "1. Go to chrome://extensions\n" +
                    "2. Click 'Remove' on SLT-ERP Bridge",
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
