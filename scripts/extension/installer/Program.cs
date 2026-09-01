using System;
using System.IO;
using System.Runtime.InteropServices;

namespace SLTBridgeInstaller
{
    class Program
    {
        const string ExtensionId = "mhbnhnpammnagfmgomcpakeeohbnkajm";
        const string UpdateManifest = "https://sltserp.vercel.app/slt-bridge-updates.xml";

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

        const uint MB_OK = 0;
        const uint MB_ICONINFORMATION = 0x40;
        const uint MB_ICONERROR = 0x10;

        static void Main()
        {
            try
            {
                // Chrome External Extensions via JSON (no admin, no registry)
                // Path: %LOCALAPPDATA%\Google\Chrome\User Data\External Extensions\{id}.json
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string chromeExtensionsDir = Path.Combine(localAppData, "Google", "Chrome", "User Data", "External Extensions");

                if (!Directory.Exists(chromeExtensionsDir))
                {
                    Directory.CreateDirectory(chromeExtensionsDir);
                }

                string jsonPath = Path.Combine(chromeExtensionsDir, $"{ExtensionId}.json");
                string jsonContent = $"{{\"external_update_url\": \"{UpdateManifest}\"}}";

                File.WriteAllText(jsonPath, jsonContent);

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
