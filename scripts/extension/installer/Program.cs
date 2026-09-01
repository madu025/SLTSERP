using System;
using System.Diagnostics;
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
                // Handle --uninstall flag
                if (args.Length > 0 && args[0] == "--uninstall")
                {
                    Uninstall();
                    return;
                }

                // If not admin, re-launch with UAC elevation
                if (!IsAdmin())
                {
                    var result = MessageBox(IntPtr.Zero,
                        "SLT-ERP Bridge needs administrator access to install the Chrome extension policy.\n\nClick Yes to continue.",
                        "SLT-ERP Bridge Install",
                        MB_YESNO | MB_ICONINFORMATION);

                    if (result != 6) // IDYES
                    {
                        MessageBox(IntPtr.Zero,
                            "Installation cancelled.\n\nWithout admin access, the extension cannot be auto-installed.\nUse the batch file installer for manual installation instead.",
                            "SLT-ERP Bridge Install",
                            MB_OK | MB_ICONERROR);
                        return;
                    }

                    var exe = Process.GetCurrentProcess().MainModule!.FileName!;
                    var psi = new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas"
                    };
                    Process.Start(psi);
                    return;
                }

                // We are admin - write HKLM registry policy
                using (var key = Registry.LocalMachine.CreateSubKey(PolicyPath))
                {
                    if (key == null)
                    {
                        MessageBox(IntPtr.Zero,
                            "Failed to create registry key.",
                            "SLT-ERP Bridge Install",
                            MB_OK | MB_ICONERROR);
                        return;
                    }

                    // Find next available index
                    int index = 1;
                    while (key.GetValue(index.ToString()) != null)
                    {
                        // Check if our extension is already registered
                        var existing = key.GetValue(index.ToString())?.ToString();
                        if (existing != null && existing.StartsWith(ExtensionId))
                        {
                            MessageBox(IntPtr.Zero,
                                "SLT-ERP Bridge is already installed!\n\nRegistry policy is configured.\nRestart Chrome to apply.",
                                "SLT-ERP Bridge Install",
                                MB_OK | MB_ICONINFORMATION);
                            return;
                        }
                        index++;
                    }

                    // Write policy: extensionId;updateManifestUrl
                    key.SetValue(index.ToString(), $"{ExtensionId};{UpdateManifest}", RegistryValueKind.String);
                }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge installed successfully!\n\n" +
                    "Chrome will auto-download and install the extension.\n" +
                    "Please restart Chrome if it's currently running.\n\n" +
                    "The extension will auto-update from the server.",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONINFORMATION);
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // User clicked "No" on UAC prompt
                return;
            }
            catch (Exception ex)
            {
                MessageBox(IntPtr.Zero,
                    $"Installation failed:\n{ex.Message}",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONERROR);
            }
        }

        static void Uninstall()
        {
            try
            {
                if (!IsAdmin())
                {
                    var exe = Process.GetCurrentProcess().MainModule!.FileName!;
                    var psi = new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas",
                        Arguments = "--uninstall"
                    };
                    Process.Start(psi);
                    return;
                }

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
                                break;
                            }
                        }
                    }
                }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge uninstalled successfully!\n\nRestart Chrome to complete removal.",
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
