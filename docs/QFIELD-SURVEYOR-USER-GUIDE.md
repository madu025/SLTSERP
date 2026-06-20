# QField Mobile Surveyor User Guide
## (SLTSERP Fiber Survey Field Manual)

This guide provides step-by-step instructions for field surveyors to open projects, capture pole variants, record cable paths, place closures, and sync data using the **QField** mobile application on Android or iOS.

---

## 1. Getting Started & Opening Your Project

1. **Install QField:** Download and install **QField** from the Google Play Store or Apple App Store.
2. **Configure Server:**
   * Open QField → Tap **Cloud Projects**.
   * Tap the settings gear/plus icon to add a custom server.
   * Enter the server URL provided by your administrator (e.g., `https://sltserp.vynorstore.com` or local IP `http://192.168.1.xxx:8100`).
3. **Login:** Enter your QFieldCloud credentials provided by the Project Manager.
4. **Download Project:**
   * You will see the list of projects assigned to you.
   * Tap on your active project to download it.
   * Once downloaded, tap on it again to open the map view.

---

## 2. Navigating the Map & Selecting Layers (In-Depth Guide)

Understanding how to control the map view and manage layers is essential to prevent data entry errors.

### A. Map Interface and Navigation Controls
* **Basic Gestures:**
  * **Zoom In/Out:** Pinch two fingers together or spread them apart on the screen.
  * **Pan/Move Map:** Drag a single finger across the screen to move the map.
  * **Rotate Map:** Twist two fingers on the screen to rotate. A compass icon will appear in the top-right corner; tap it to reset the map north.
* **GPS Tracking Controls (Target Crosshair Icon):**
  * Tap the **Crosshair Icon** (usually at the bottom-left or bottom-right corner) to center the map on your current GPS location.
  * **Color Indicators:**
    * **Red/Crossed-out Crosshair:** GPS is turned off or has no signal lock. Ensure your mobile device's Location Services are set to "High Accuracy" mode.
    * **Blue Crosshair:** GPS is active. The map will center on your location.
    * **Pulsing Blue Circle:** Shows the margin of error/accuracy of your current GPS signal. If the circle is too large (e.g. > 10 meters), wait under clear sky until the circle shrinks (ideally < 3 meters) before capturing points.
  * **Autopan Mode:** Double-tap the crosshair icon. The map will lock to your GPS position and automatically pan as you walk, keeping your location centered.

### B. Switching Basemaps (Satellite vs. Street Maps)
To change the background map to see either satellite imagery or local roads:
1. Tap the **Menu Button (three bars)** in the top-left corner.
2. At the bottom of the sidebar, look for the **Basemaps** section.
3. Tap on your preferred basemap:
   * **Google Hybrid/Satellite:** Best for identifying physical trees, buildings, and poles on the ground.
   * **OpenStreetMap (OSM) / Vector Street Map:** Best for viewing street names, land parcels, and road intersections.
   * **Offline Topographic Map:** Automatically loaded for areas with poor internet connection.

### C. Using the Layer Tree (Visibility & Control)
The project contains **12 distinct layers** for poles, cables, enclosures, chambers, etc. To avoid cluttering your screen, you can toggle their visibility:
1. Open the sidebar menu (top-left button).
2. You will see a checkbox or **Eye Icon** next to each layer name.
3. **Uncheck** a layer to hide its points from the map.
4. **Check** the layer to show its points.
5. *Tip:* Keeping all layers visible is recommended during the survey to avoid placing duplicate features in the same location.

### D. Activating "Edit Mode" and Selecting the Active Layer
Before you can add any points (poles, cables, closures), you must tell QField which layer you want to write to:
1. Open the sidebar menu (top-left button).
2. Tap the **Edit Mode** button (indicated by a **Pencil Icon** at the top of the sidebar).
3. The layers list will highlight.
4. Tap on the specific layer you wish to edit (e.g., tap on `New Pole` or `Cable Start`).
5. A small **pencil icon** or **bold highlight** will appear next to the selected layer, and a **Plus (+)** button will appear at the bottom-right corner of the map.
6. Now, any point you add will be saved into that active layer.
7. *Important:* When you change from recording poles to recording cable paths, you **must** open this menu and tap on the new target layer (`Cable Start` / `Cable Mid-Point`) to switch the active edit layer.

### E. Using the Map Measuring Tool
To quickly measure the distance between two poles or along a road crossing:
1. Tap the **Menu Button (three bars)**.
2. Tap the **Ruler Icon** or select **Measure**.
3. Tap points on the map to draw a line. QField will display the segment length and total path distance dynamically in meters.
4. Tap the **Trash/Clear** icon to exit measuring mode.

---

## 3. Adding Poles and Selecting Pole Variants

When you reach a pole site:
1. Select the target layer:
   * **`Existing Pole`** (🌳 Green) — for utilizing existing electricity or telecom poles.
   * **`New Pole`** (🔩 Red) — where a new pole needs to be erected.
2. Tap the **Plus (+)** button at the bottom-right corner to mark your current GPS location.
3. A form will slide up automatically with dropdown choices:
   * **POLE TYPE:** Choose from the dropdown options pre-configured by the PM (e.g., `Concrete`, `GI`, `Spun`, `Wood`).
   * **POLE HEIGHT:** Select the height variant (e.g., `7.5m`, `8.0m`, `9.0m`, `10.0m`).
   * **Exist_New:** Select the status (`Existing`, `New`, `Relocated`).
   * **PL_Number:** Enter the sequential number (e.g., `PL-01`).
4. Tap the **Checkmark (✓)** in the top-right corner to save the pole.

---

## 4. Marking Cable Paths (Start, End, and Mid-Points)

To map a cable section (e.g., Section #1), you must use a combination of **Cable Start**, **Cable End**, and **Cable Mid-Points** matching the same **Section Number**:

### A. Marking the Start of a Cable Section (Point A)
1. Select layer **`Cable Start`** (🅰️ Amber).
2. Tap **Plus (+)** to mark the start point.
3. Fill in the form:
   * **section_number:** Enter a unique number (e.g., `1`).
   * **cable_type:** Select from the dropdown (e.g., `12F SM`, `24F SM`, `48F SM`).
   * **fiber_count:** Enter the number of fibers (e.g., `24`).
4. Save (✓).

### B. Marking the Cable Path (Intermediate Points)
As you walk the route along the poles:
1. Select layer **`Cable Mid-Point`** (➖ Yellow) at every pole or turn where the cable runs.
2. Tap **Plus (+)** to mark the intermediate position.
3. Fill in the form:
   * **section_number:** Enter the same section number (e.g., `1`).
4. Save (✓).

### C. Marking the End of the Cable Section (Point B)
1. Select layer **`Cable End`** (🅱️ Orange) at the termination point.
2. Tap **Plus (+)** to mark the end point.
3. Fill in the form:
   * **section_number:** Enter the same section number (e.g., `1`).
   * **cable_type:** Enter the matching type (e.g., `24F SM`).
   * **fiber_count:** Enter the matching count (e.g., `24`).
4. Save (✓).

*Note: The SLTSERP web engine will automatically connect all points matching `section_number = 1` to calculate the exact route length and generate the BOQ.*

---

## 5. Branching & Splice Closures (Joint Closures) - Step-by-Step Scenario

Here is how you handle a complex branching scenario on the field.

### Scenario:
* You have a total path of **500m**.
* **First 200m:** A **24-core (24F)** cable runs from the main line to **Point C**.
* **At Point C (Joint Closure/Splice Point):** The cable capacity splits:
  * A **4-core (4F)** cable branches off to the right towards **Point D** (300m distance).
  * A **20-core (20F)** cable branches off to another direction towards **Point E** (150m distance).

### Step 1: Record the First 200m Section (Section 1)
1. **Start of Cable (A-End):**
   * Walk to the start of the 24F cable.
   * Select layer **`Cable Start`** (🅰️ Amber).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 1`, `cable_type = 24F SM`, `fiber_count = 24`. Save (✓).
2. **Intermediate Paths:**
   * Walk along the poles.
   * For every pole or path bend, select **`Cable Mid-Point`** (➖ Yellow), tap **Plus (+)**, and fill `section_number = 1`. Save (✓).
3. **End of Section at Point C:**
   * Walk to **Point C** (at 200m).
   * Select layer **`Cable End`** (🅱️ Orange).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 1`, `cable_type = 24F SM`, `fiber_count = 24`. Save (✓).

### Step 2: Record the Joint Closure at Point C
1. While standing at **Point C**:
   * Select layer **`Joint Closure`** (🔗 Blue).
   * Tap **Plus (+)** to place a closure.
   * Fill details: `closure_number = JC-01`, `type = T-Joint` (or `Splice Joint`), `capacity = 24`. Save (✓).

### Step 3: Record the 4F Branch to Point D (Section 2 - 300m)
1. **Start of 4F Cable at Point C:**
   * Still at **Point C**, select layer **`Cable Start`** (🅰️ Amber).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 2`, `cable_type = 4F SM`, `fiber_count = 4`. Save (✓).
2. **Intermediate Paths:**
   * Walk the 300m path towards Point D.
   * At poles/bends along this path, select **`Cable Mid-Point`** (➖ Yellow), tap **Plus (+)**, and fill `section_number = 2`. Save (✓).
3. **End of Section at Point D:**
   * Walk to **Point D**.
   * Select layer **`Cable End`** (🅱️ Orange).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 2`, `cable_type = 4F SM`, `fiber_count = 4`. Save (✓).

### Step 4: Record the 20F Branch to Point E (Section 3 - 150m)
1. **Start of 20F Cable at Point C:**
   * Return or refer to **Point C**, select layer **`Cable Start`** (🅰️ Amber).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 3`, `cable_type = 20F SM` (or select closest preset), `fiber_count = 20`. Save (✓).
2. **Intermediate Paths:**
   * Walk the 150m path towards Point E.
   * At poles/bends along this path, select **`Cable Mid-Point`** (➖ Yellow), tap **Plus (+)**, and fill `section_number = 3`. Save (✓).
3. **End of Section at Point E:**
   * Walk to **Point E**.
   * Select layer **`Cable End`** (🅱️ Orange).
   * Tap **Plus (+)** to add.
   * Fill details: `section_number = 3`, `cable_type = 20F SM`, `fiber_count = 20`. Save (✓).

---

## 6. Synchronizing Your Data to the Cloud

Once you have finished the survey or completed the day's work:
1. Ensure your phone has an active internet connection (WiFi or Mobile Data).
2. Tap the **Menu Button (three bars)** in the top-left corner.
3. Tap the **Cloud Synchronization icon** (cloud icon with arrows) next to the project name.
4. Tap **Synchronize (Push Changes)**.
5. Wait for the sync progress bar to complete. 
6. Notify your Project Manager to review and approve the survey points on the SLTSERP Web Dashboard.

---
---

# QField ජංගම දුරකථන සමීක්ෂණ පරිශීලක අත්පොත
## (SLTSERP ෆයිබර් සමීක්ෂණ ක්ෂේත්‍ර අත්පොත)

මෙම මාර්ගෝපදේශය මඟින් ඇන්ඩ්‍රොයිඩ් (Android) හෝ iOS උපාංග මත **QField** ජංගම යෙදුම භාවිතයෙන් ව්‍යාපෘති විවෘත කිරීම, කණු වර්ග (pole variants) සටහන් කිරීම, කේබල් මාර්ග වාර්තා කිරීම, closures ස්ථානගත කිරීම සහ දත්ත සමමුහුර්තකරණය (sync) කිරීම සඳහා වන පියවරෙන් පියවර උපදෙස් ලබා දේ.

---

## 1. ආරම්භ කිරීම සහ ව්‍යාපෘතිය විවෘත කිරීම

1. **QField ස්ථාපනය කරන්න:** Google Play Store හෝ Apple App Store වෙතින් **QField** ඇප් එක බාගත කර ස්ථාපනය කරන්න.
2. **Server එක සකස් කිරීම:**
   * QField ඇප් එක විවෘත කර → **Cloud Projects** ක්ලික් කරන්න.
   * Settings (gear) හෝ Plus (+) අයිකනය ක්ලික් කර custom server එකක් එකතු කරන්න.
   * Server URL එක ලෙස: `https://sltserp.vynorstore.com` හෝ අදාළ local IP එක (උදා: `http://192.168.1.xxx:8100`) ඇතුළත් කරන්න.
3. **Login වීම:** ව්‍යාපෘති කළමනාකරු (Project Manager) විසින් ලබා දුන් QFieldCloud පරිශීලක නාමය (Username) සහ මුරපදය (Password) ඇතුළත් කර Login වන්න.
4. **Project එක බාගත කිරීම (Download):**
   * ඔබට පවරා ඇති ව්‍යාපෘති ලැයිස්තුව දිස්වනු ඇත.
   * අදාළ ව්‍යාපෘතිය (Project) මත ක්ලික් කර එය බාගත (Download) කරගන්න.
   * බාගත වූ පසු, සිතියම (Map View) විවෘත කර ගැනීමට නැවත ඒ මත ක්ලික් කරන්න.

---

## 2. සිතියම හැසිරවීම සහ ලේයර් තෝරා ගැනීම (සවිස්තරාත්මක මඟපෙන්වීම)

දත්ත ඇතුළත් කිරීමේදී සිදුවන වැරදි වළක්වා ගැනීමට සිතියම හැසිරවීම සහ ලේයර් පාලනය කරන ආකාරය අවබෝධ කර ගැනීම අත්‍යවශ්‍ය වේ.

### A. සිතියම් අතුරුමුහුණත සහ සංචාලනය (Map Interface & Navigation)
* **මූලික ක්‍රියාකාරකම්:**
  * **Zoom In/Out:** ඇඟිලි දෙකක් එකට ළං කිරීමෙන් හෝ ඈත් කිරීමෙන් සිතියම විශාල හෝ කුඩා කරන්න.
  * **Map එක ගෙනයාම (Pan):** සිතියම එහා මෙහා කිරීමට තනි ඇඟිල්ලකින් ඇදගෙන යන්න.
  * **Map එක කරකැවීම (Rotate):** ඇඟිලි දෙකක් තබා කරකවන්න. සිතියම නැවත උතුරු දිශාවට හැරවීමට ඉහළ දකුණු කෙළවරේ ඇති මාලිමා (Compass) ලකුණ ක්ලික් කරන්න.
* **GPS Tracking Controls (Target Crosshair Icon):**
  * ඔබ සිටින ස්ථානයට සිතියම කේන්ද්‍රගත (Center) කර ගැනීමට **Crosshair** ලකුණ (පහළ වම් හෝ දකුණු කෙළවරේ ඇති ලකුණ) ක්ලික් කරන්න.
  * **වර්ණ දර්ශක:**
    * **රතු/හරස් ඉරක් සහිත Crosshair:** GPS අක්‍රීයයි හෝ සංඥා නොමැත. දුරකථනයේ Location Services "High Accuracy" ලෙස සක්‍රීය කර ඇති බව තහවුරු කරගන්න.
    * **නිල් පැහැති Crosshair:** GPS සක්‍රීයයි. සිතියම ඔබ සිටින ස්ථානයට කේන්ද්‍රගත වේ.
    * **නිල් පැහැති විහිදෙන වටය (Accuracy Circle):** ඔබගේ GPS සංඥාවේ නිවැරදිභාවය පෙන්වයි. මෙම වටය විශාල නම් (උදා: මීටර් 10ට වැඩි), ස්ථාන සලකුණු කිරීමට පෙර එය කුඩා වන තෙක් (මීටර් 3ට අඩු වන තෙක්) එළිමහන් ස්ථානයක රැඳී සිටින්න.
  * **Autopan Mode:** Crosshair ලකුණ මත දෙවරක් ක්ලික් (Double-tap) කරන්න. එවිට ඔබ ඇවිදින විට සිතියම ස්වයංක්‍රීයව ඔබ සමඟ ගමන් කරනු ඇත.

### B. Basemaps මාරු කිරීම (Satellite vs. Street Maps)
පසුබිම් සිතියම (Satellite imagery හෝ සාමාන්‍ය පාරවල් සහිත සිතියම) වෙනස් කිරීමට:
1. ඉහළ වම් කෙළවරේ ඇති **Menu Button (ඉරි තුන)** ක්ලික් කරන්න.
2. Sidebar එකේ පහළ ඇති **Basemaps** කොටස වෙත යන්න.
3. ඔබට අවශ්‍ය සිතියම තෝරන්න:
   * **Google Hybrid/Satellite:** ගස්, ගොඩනැගිලි සහ කණු පැහැදිලිව හඳුනා ගැනීමට.
   * **OpenStreetMap (OSM) / Vector Street Map:** පාරවල්වල නම් සහ හන්දි බලා ගැනීමට.
   * **Offline Topographic Map:** අන්තර්ජාල සංඥා දුර්වල ප්‍රදේශ සඳහා ස්වයංක්‍රීයව ක්‍රියාත්මක වේ.

### C. Layer Tree භාවිතය (Layers පෙනීම පාලනය කිරීම)
මෙහි කණු, කේබල්, closures ආදිය සඳහා **ලේයර් 12ක්** පවතී. සිතියම පැහැදිලිව තබා ගැනීමට මේවායේ පෙනීම පාලනය කළ හැක:
1. Sidebar මෙනුව විවෘත කරන්න.
2. සෑම ලේයර් එකක් අසලම ඇති **Eye Icon (ඇසක ලකුණ)** හෝ Checkbox එක දැකගත හැක.
3. ලේයර් එකක් සිතියමෙන් ඉවත් කිරීමට එය Uncheck කරන්න.
4. නැවත පෙන්වීමට Check කරන්න.
5. *උපදෙස්:* ක්ෂේත්‍රයේදී එකම ස්ථානයක දත්ත දෙවරක් සලකුණු වීම වැළැක්වීම සඳහා සියලුම ලේයර්ස් Visible (පෙනෙන සේ) තබා ගැනීම නිර්දේශ කෙරේ.

### D. "Edit Mode" සක්‍රිය කිරීම සහ අදාළ Layer එක තෝරා ගැනීම
සිතියමට ලක්ෂ්‍යයක් (කණුවක්, කේබලයක් හෝ closure එකක්) එකතු කිරීමට පෙර QField එකට අදාළ ලේයරය තෝරා දිය යුතුය:
1. Sidebar මෙනුව විවෘත කරන්න.
2. ඉහළින්ම ඇති **Edit Mode (පැන්සලක ලකුණ)** ක්ලික් කරන්න.
3. එවිට ලේයර් ලැයිස්තුව edit කිරීමට සුදානම් වේ.
4. ඔබට එකතු කිරීමට අවශ්‍ය ලේයරය මත ක්ලික් කරන්න (උදා: `New Pole` හෝ `Cable Start`).
5. තෝරාගත් ලේයරය අසල පැන්සල් ලකුණක් හෝ highlight වීමක් දිස්වන අතර සිතියමේ පහළ දකුණු කෙළවරේ **Plus (+)** බොත්තම දිස්වේ.
6. දැන් ඔබ එකතු කරන ලක්ෂ්‍යය එම ලේයරය තුළ තැන්පත් වේ.
7. *වැදගත්:* කණු සලකුණු කිරීමෙන් පසු කේබල් සලකුණු කිරීමට යන විට, අනිවාර්යයෙන්ම මෙනුව විවෘත කර අදාළ කේබල් ලේයරය (`Cable Start` / `Cable Mid-Point`) තෝරාගත යුතුය.

### E. සිතියම් මිනුම් මෙවලම (Measuring Tool)
ක්ෂේත්‍රයේදී කණු දෙකක් අතර හෝ පාරක් හරහා ඇති දුර මැන ගැනීමට:
1. Menu Button එක ක්ලික් කරන්න.
2. **Ruler Icon** හෝ **Measure** තෝරන්න.
3. සිතියම මත අවශ්‍ය ලක්ෂ්‍ය ක්ලික් කර රේඛාවක් අඳින්න. එවිට දුර මීටර් ප්‍රමාණයෙන් සිතියම මත දිස්වනු ඇත.

---

## 3. කණු එකතු කිරීම සහ කණු වර්ග තෝරා ගැනීම (Pole Variants)

ඔබ කණුවක් පිහිටුවන ස්ථානයට ළඟා වූ පසු:
1. අදාළ ලේයරය තෝරන්න:
   * **`Existing Pole`** (🌳 කොළ පැහැති) — දැනට පවතින විදුලි හෝ විදුලි සංදේශ කණුවක් භාවිතා කරන්නේ නම්.
   * **`New Pole`** (🔩 රතු පැහැති) — නව කණුවක් සිටුවීමට අවශ්‍ය ස්ථානයකදී.
2. පහළ දකුණු කෙළවරේ ඇති **Plus (+)** බොත්තම ක්ලික් කර ඔබ සිටින ස්ථානය සලකුණු කරන්න.
3. ස්වයංක්‍රීයව Form එකක් දිස්වන අතර, එහි පහත විකල්ප තෝරන්න:
   * **POLE TYPE:** Concrete, GI, Spun, Wood ආදී වර්ග.
   * **POLE HEIGHT:** කණුවේ උස (උදා: `7.5m`, `8.0m`, `9.0m`, `10.0m`).
   * **Exist_New:** කණුවේ තත්ත්වය (Existing, New, Relocated).
   * **PL_Number:** කණුවේ අංකය (උදා: `PL-01`).
4. ඉහළ දකුණු කෙළවරේ ඇති **Checkmark (✓)** ලකුණ ක්ලික් කර දත්ත සේව් කරන්න.

---

## 4. කේබල් මාර්ග සලකුණු කිරීම (Start, End, and Mid-Points)

කේබල් කොටසක් (Cable Section - උදා: Section #1) සලකුණු කිරීමේදී, එකම **Section Number** එක සහිත **Cable Start**, **Cable End** සහ **Cable Mid-Points** සංයෝජනයක් භාවිතා කළ යුතුය.

### A. කේබල් කොටසක ආරම්භය සලකුණු කිරීම (Point A)
1. **`Cable Start`** (🅰️ කහ/තැඹිලි) ලේයරය තෝරන්න.
2. **Plus (+)** ක්ලික් කර ආරම්භක ස්ථානය සලකුණු කරන්න.
3. Form එක පුරවන්න:
   * **section_number:** අනන්‍ය අංකයක් ලබා දෙන්න (උදා: `1`).
   * **cable_type:** 12F SM, 24F SM, 48F SM ආදී වර්ග.
   * **fiber_count:** ෆයිබර් ගණන (උදා: `24`).
4. Save (✓) කරන්න.

### B. අතරමැද කේබල් මාර්ගය සලකුණු කිරීම (Mid-Points)
කේබලය ඇදගෙන යන මාර්ගය දිගේ:
1. කේබලය ගමන් කරන සෑම කණුවක් හෝ හැරවුමක් අසලදීම **`Cable Mid-Point`** (➖ කහ) ලේයරය තෝරන්න.
2. **Plus (+)** ක්ලික් කර සලකුණු කරන්න.
3. Form එකෙහි **section_number** එක ලෙස කලින් ලබා දුන් අංකයම (උදා: `1`) ඇතුළත් කරන්න.
4. Save (✓) කරන්න.

### C. කේබල් කොටසක අවසානය සලකුණු කිරීම (Point B)
1. කේබලය අවසන් වන ස්ථානයේදී **`Cable End`** (🅱️ තැඹිලි) ලේයරය තෝරන්න.
2. **Plus (+)** ක්ලික් කර අවසාන ස්ථානය සලකුණු කරන්න.
3. Form එක පුරවන්න:
   * **section_number:** එකම අංකය (උදා: `1`) ලබා දෙන්න.
   * **cable_type:** කලින් තෝරාගත් වර්ගයම (උදා: `24F SM`).
   * **fiber_count:** ෆයිබර් ගණන (උදා: `24`).
4. Save (✓) කරන්න.

*සටහන: SLTSERP පද්ධතිය මඟින් `section_number = 1` සහිත සියලුම ලක්ෂ්‍ය එකිනෙක සම්බන්ධ කර ස්වයංක්‍රීයව කේබල් දිග ගණනය කර BOQ එක සාදනු ලබයි.*

---

## 5. කේබල් බෙදීයෑමේ අවස්ථාව (Branching & Joint Closures) - පියවරෙන් පියවර නිදසුනක්

ක්ෂේත්‍රයේදී කේබල් බෙදීයන (Branching) අවස්ථාවන් සටහන් කරන ආකාරය මෙසේය:

### උදාහරණයක් ලෙස:
* මුළු මාර්ගයේ දුර **මීටර් 500ක්** වේ.
* **පළමු මීටර් 200:** ප්‍රධාන මාර්ගයේ සිට **C ස්ථානය (Point C)** දක්වා **24F කේබල්** එකක් ඇද ඇත.
* **C ස්ථානයේදී (Joint Closure/Splice Point):** කේබලය කොටස් දෙකකට බෙදේ:
  * **4F කේබල්** එකක් දකුණු දෙසට **D ස්ථානය (Point D)** දක්වා මීටර් 300ක් ගමන් කරයි.
  * **20F කේබල්** එකක් වෙනත් දිශාවකට **E ස්ථානය (Point E)** දක්වා මීටර් 150ක් ගමන් කරයි.

### පියවර 1: පළමු මීටර් 200 කොටස (Section 1) සලකුණු කිරීම
1. **කේබලයේ ආරම්භය (Point A):**
   * කේබලය ආරම්භ වන ස්ථානයට ගොස්, **`Cable Start`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 1`, `cable_type = 24F SM`, `fiber_count = 24`. Save (✓) කරන්න.
2. **අතරමැද මාර්ගය:**
   * මාර්ගය දිගේ ගොස්, සෑම කණුවක් ළඟදීම **`Cable Mid-Point`** ලේයරය තෝරා **Plus (+)** ක්ලික් කර `section_number = 1` ලබා දෙන්න. Save (✓) කරන්න.
3. **C ස්ථානයේ අවසානය (Point C):**
   * මීටර් 200ක් අවසානයේ C ස්ථානයට ගොස්, **`Cable End`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 1`, `cable_type = 24F SM`, `fiber_count = 24`. Save (✓) කරන්න.

### පියවර 2: Point C හි Joint Closure එක සටහන් කිරීම
1. ඔබ තවමත් C ස්ථානයේ සිටින අතරතුර:
   * **`Joint Closure`** (🔗 නිල් පැහැති) ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `closure_number = JC-01`, `type = T-Joint` (හෝ `Splice Joint`), `capacity = 24`. Save (✓) කරන්න.

### පියවර 3: Point C සිට D දක්වා 4F කේබල් කොටස (Section 2 - 300m) සලකුණු කිරීම
1. **D දක්වා යන කේබලයේ ආරම්භය (Point C හිදී):**
   * නැවත C ස්ථානයේ සිටම, **`Cable Start`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 2`, `cable_type = 4F SM`, `fiber_count = 4`. Save (✓) කරන්න. (මෙහිදී section number එක වෙනස් විය යුතුය).
2. **අතරමැද මාර්ගය:**
   * D ස්ථානය දෙසට ඇවිද යමින් අතරමැද කණුවලදී **`Cable Mid-Point`** ලේයරය තෝරා `section_number = 2` ලෙස සලකුණු කරන්න.
3. **D ස්ථානයේ අවසානය (Point D):**
   * D ස්ථානයට ළඟා වූ පසු, **`Cable End`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 2`, `cable_type = 4F SM`, `fiber_count = 4`. Save (✓) කරන්න.

### පියවර 4: Point C සිට E දක්වා 20F කේබල් කොටස (Section 3 - 150m) සලකුණු කිරීම
1. **E දක්වා යන කේබලයේ ආරම්භය (නැවත Point C ස්ථානයෙන්):**
   * නැවත C ස්ථානය වෙත යොමු වී, **`Cable Start`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 3`, `cable_type = 20F SM`, `fiber_count = 20`. Save (✓) කරන්න.
2. **අතරමැද මාර්ගය:**
   * E ස්ථානය දෙසට ගමන් කරමින් අතරමැද කණුවලදී **`Cable Mid-Point`** ලේයරය තෝරා `section_number = 3` ලෙස සලකුණු කරන්න.
3. **E ස්ථානයේ අවසානය (Point E):**
   * E ස්ථානයට ළඟා වූ පසු, **`Cable End`** ලේයරය තෝරා **Plus (+)** ක්ලික් කරන්න.
   * දත්ත ඇතුළත් කරන්න: `section_number = 3`, `cable_type = 20F SM`, `fiber_count = 20`. Save (✓) කරන්න.

---

## 6. දත්ත Cloud එකට සමමුහුර්ත කිරීම (Cloud Synchronization)

දවසේ සමීක්ෂණ කටයුතු අවසන් වූ පසු හෝ වැඩ අවසන් වූ විට:
1. ඔබගේ ජංගම දුරකථනයට අන්තර්ජාල පහසුකම් (WiFi හෝ Mobile Data) සක්‍රීය කර ඇති බව තහවුරු කරගන්න.
2. ඉහළ වම් කෙළවරේ ඇති **Menu Button (ඉරි තුන)** ක්ලික් කරන්න.
3. ව්‍යාපෘතියේ නමට එහා පැත්තේ ඇති **Cloud Synchronization (වලාකුළු සහ ඊතල සහිත ලකුණ)** ක්ලික් කරන්න.
4. **Synchronize (Push Changes)** ක්ලික් කරන්න.
5. සමමුහුර්තකරණය (Sync process) 100% අවසන් වන තෙක් රැඳී සිටින්න.
6. ඉන්පසු වෙබ් අඩවියෙන් (SLTSERP Web Dashboard) දත්ත පරීක්ෂා කර අනුමත (Approve) කරන ලෙස ව්‍යාපෘති කළමනාකරුට දැනුම් දෙන්න.
