using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace SLTBridgeInstaller
{
    class Program
    {
        const string ExtensionId = "mhbnhnpammnagfmgomcpakeeohbnkajm";
        const string UpdateManifest = "https://sltserp.vercel.app/slt-bridge-updates.xml";
        const string RegistryPath = @"Software\Policies\Google\Chrome\ExtensionInstallForcelist";

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

        const uint MB_OK = 0;
        const uint MB_ICONINFORMATION = 0x40;
        const uint MB_ICONERROR = 0x10;

        static void Main()
        {
            try
            {
                using (var key = Registry.CurrentUser.CreateSubKey(RegistryPath))
                {
                    if (key == null)
                    {
                        MessageBox(IntPtr.Zero, "Failed to create registry key.", "SLT-ERP Bridge Install", MB_OK | MB_ICONERROR);
                        return;
                    }

                    int index = 1;
                    while (key.GetValue(index.ToString()) != null)
                        index++;

                    string value = $"{ExtensionId};{UpdateManifest}";
                    key.SetValue(index.ToString(), value, RegistryValueKind.String);
                }

                MessageBox(IntPtr.Zero,
                    "SLT-ERP Bridge installed successfully!\n\nPlease restart Chrome.\nThe extension will auto-update from the server.",
                    "SLT-ERP Bridge Install",
                    MB_OK | MB_ICONINFORMATION);
            }
            catch (Exception ex)
            {
                MessageBox(IntPtr.Zero, $"Installation failed:\n{ex.Message}", "SLT-ERP Bridge Install", MB_OK | MB_ICONERROR);
            }
        }
    }
}
