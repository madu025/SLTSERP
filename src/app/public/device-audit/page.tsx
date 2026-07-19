"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Laptop, Smartphone, Search, CheckCircle, AlertTriangle, ShieldCheck, User, HelpCircle, Check, ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const LAPTOP_BRANDS = ["HP", "Lenovo", "Dell", "Asus", "Acer", "MSI", "Apple"];
const MOBILE_BRANDS = ["Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "ZTE", "Nubia", "OnePlus", "Nokia", "Sony", "Google", "Apple"];

const LAPTOP_CONDITIONS = [
  { id: "perfect", label: "Working Perfectly (කිසිදු දෝෂයක් නොමැත)" },
  { id: "battery", label: "Battery Weak / Not Charging (බැටරි දෝෂ)" },
  { id: "keyboard", label: "Keyboard & Touchpad Issues" },
  { id: "screen", label: "Display/Screen Glitches (තිරයේ දෝෂ)" },
  { id: "physical", label: "Physical Damage (කැඩීම්/Dents)" },
  { id: "performance", label: "Slow Performance / Overheat" }
];

const MOBILE_CONDITIONS = [
  { id: "perfect", label: "Working Perfectly (කිසිදු දෝෂයක් නොමැත)" },
  { id: "battery", label: "Battery Weak / Rapid Drain" },
  { id: "screen", label: "Display / Screen Cracks (තිරයේ දෝෂ)" },
  { id: "physical", label: "Physical Damage / Button Issues" },
  { id: "signal", label: "Network / Signal Issues" },
  { id: "performance", label: "Slow Performance / Lagging" }
];

export default function PublicDeviceAuditPage() {
  const [step, setStep] = useState<"CUSTODIAN" | "DEVICES" | "SUCCESS">("CUSTODIAN");
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [staffFound, setStaffFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [siteOffices, setSiteOffices] = useState<{ id: string; name: string }[]>([]);

  // Custodian & Location Details
  const [employeeNo, setEmployeeNo] = useState("");
  const [custodianName, setCustodianName] = useState("");
  const [department, setDepartment] = useState("");
  const [siteOfficeId, setSiteOfficeId] = useState("");
  const [location, setLocation] = useState("");

interface DBAsset {
  id: string;
  serialNumber: string;
  assetNumber?: string | null;
  deviceType: "LAPTOP" | "MOBILE" | "DESKTOP" | "PRINTER" | "NETWORK" | "OTHER";
  brand?: string | null;
  model?: string | null;
  status: string;
}

  // Assigned Assets returned from DB (to show for confirmation)
  const [assignedAssets, setAssignedAssets] = useState<DBAsset[]>([]);

  // Laptop State
  const [laptopMode, setLaptopMode] = useState<"COMPANY" | "PERSONAL" | "NONE">("COMPANY");
  const [laptopSerial, setLaptopSerial] = useState("");
  const [laptopBrand, setLaptopBrand] = useState("");
  const [laptopModel, setLaptopModel] = useState("");
  const [laptopSearching, setLaptopSearching] = useState(false);
  const [laptopFound, setLaptopFound] = useState(false);
  const [laptopIsConfirmed, setLaptopIsConfirmed] = useState(false);
  const [laptopCustomBrand, setLaptopCustomBrand] = useState(false);
  const [laptopUseDifferent, setLaptopUseDifferent] = useState(false);
  const [laptopConditions, setLaptopConditions] = useState<string[]>(["perfect"]);
  const [laptopRemarks, setLaptopRemarks] = useState("");

  // Mobile State
  const [mobileMode, setMobileMode] = useState<"COMPANY" | "PERSONAL" | "NONE">("COMPANY");
  const [mobileSerial, setMobileSerial] = useState("");
  const [mobileBrand, setMobileBrand] = useState("");
  const [mobileModel, setMobileModel] = useState("");
  const [mobileSearching, setMobileSearching] = useState(false);
  const [mobileFound, setMobileFound] = useState(false);
  const [mobileIsConfirmed, setMobileIsConfirmed] = useState(false);
  const [mobileCustomBrand, setMobileCustomBrand] = useState(false);
  const [mobileUseDifferent, setMobileUseDifferent] = useState(false);
  const [mobileConditions, setMobileConditions] = useState<string[]>(["perfect"]);
  const [mobileRemarks, setMobileRemarks] = useState("");

  // Load site offices
  useEffect(() => {
    fetch("/api/public/site-offices")
      .then(res => res.json())
      .then(json => {
        const list = json.success ? (json.data || []) : (Array.isArray(json) ? json : []);
        setSiteOffices(list);
      })
      .catch(err => console.error("Failed to load site offices:", err));
  }, []);

  // Automatically fetch Staff Name and Assigned Devices by Employee ID / EPF No
  useEffect(() => {
    const empNo = employeeNo.trim();
    if (empNo.length < 2) {
      setStaffFound(false);
      setCustodianName("");
      setAssignedAssets([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setFetchingStaff(true);
      try {
        const res = await fetch(`/api/public/staff?employeeNo=${encodeURIComponent(empNo)}`);
        const json = await res.json();

        if (json.success && json.data && json.data.found && json.data.staff) {
          const staff = json.data.staff;
          setStaffFound(true);
          setCustodianName(staff.name);
          
          const assets: DBAsset[] = staff.assignedITAssets || [];
          setAssignedAssets(assets);

           // Reset Laptop config
          const dbLaptop = assets.find((a) => a.deviceType === "LAPTOP");
          if (dbLaptop) {
            setLaptopMode("COMPANY");
            setLaptopSerial(dbLaptop.serialNumber);
            setLaptopBrand(dbLaptop.brand || "");
            setLaptopModel(dbLaptop.model || "");
            setLaptopFound(true);
            setLaptopIsConfirmed(true);
            setLaptopUseDifferent(false);
          } else {
            setLaptopMode("COMPANY");
            setLaptopSerial("");
            setLaptopBrand("");
            setLaptopModel("");
            setLaptopFound(false);
            setLaptopIsConfirmed(false);
            setLaptopUseDifferent(true);
          }

          // Reset Mobile config
          const dbMobile = assets.find((a) => a.deviceType === "MOBILE");
          if (dbMobile) {
            setMobileMode("COMPANY");
            setMobileSerial(dbMobile.serialNumber);
            setMobileBrand(dbMobile.brand || "");
            setMobileModel(dbMobile.model || "");
            setMobileFound(true);
            setMobileIsConfirmed(true);
            setMobileUseDifferent(false);
          } else {
            setMobileMode("COMPANY");
            setMobileSerial("");
            setMobileBrand("");
            setMobileModel("");
            setMobileFound(false);
            setMobileIsConfirmed(false);
            setMobileUseDifferent(true);
          }

          toast.success(`Welcome back, ${staff.name}!`);
        } else {
          setStaffFound(false);
        }
      } catch (err) {
        console.error("Error looking up staff:", err);
      } finally {
        setFetchingStaff(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [employeeNo]);

  // Search Serial manually
  const handleSearchDevice = async (type: "LAPTOP" | "MOBILE") => {
    const serial = type === "LAPTOP" ? laptopSerial.trim() : mobileSerial.trim();
    if (!serial) {
      toast.error("Please enter a serial number to search");
      return;
    }

    if (type === "LAPTOP") setLaptopSearching(true);
    else setMobileSearching(true);

    try {
      const res = await fetch(`/api/helpdesk/assets/search-by-serial?serialNumber=${encodeURIComponent(serial)}`);
      const json = await res.json();

      if (type === "LAPTOP") {
        if (json.success && json.data && json.data.found && json.data.asset) {
          const asset = json.data.asset;
          setLaptopFound(true);
          setLaptopBrand(asset.brand || "");
          setLaptopModel(asset.model || "");
          setLaptopIsConfirmed(true);
          setLaptopCustomBrand(!LAPTOP_BRANDS.includes(asset.brand));
          toast.success("Laptop recognized!");
        } else {
          setLaptopFound(false);
          setLaptopIsConfirmed(false);
          toast.info("Laptop not in database. Enter specs manually.");
        }
      } else {
        if (json.success && json.data && json.data.found && json.data.asset) {
          const asset = json.data.asset;
          setMobileFound(true);
          setMobileBrand(asset.brand || "");
          setMobileModel(asset.model || "");
          setMobileIsConfirmed(true);
          setMobileCustomBrand(!MOBILE_BRANDS.includes(asset.brand));
          toast.success("Mobile Phone recognized!");
        } else {
          setMobileFound(false);
          setMobileIsConfirmed(false);
          toast.info("Mobile not in database. Enter specs manually.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to query device details.");
    } finally {
      if (type === "LAPTOP") setLaptopSearching(false);
      else setMobileSearching(false);
    }
  };

  // Navigations
  const handleCustodianNext = () => {
    if (!employeeNo.trim()) {
      toast.error("Please enter your Employee ID / EPF No");
      return;
    }
    if (!custodianName.trim()) {
      toast.error("Please enter your Full Name");
      return;
    }
    setStep("DEVICES");
  };

  // Submit all verified devices
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (laptopMode === "COMPANY" && laptopUseDifferent) {
      if (!laptopSerial.trim()) {
        toast.error("Please enter the Laptop Serial Number");
        return;
      }
      if (!laptopBrand.trim()) {
        toast.error("Please specify the Laptop Brand");
        return;
      }
      if (!laptopModel.trim()) {
        toast.error("Please specify the Laptop Model");
        return;
      }
    }

    if (mobileMode === "COMPANY" && mobileUseDifferent) {
      if (!mobileSerial.trim()) {
        toast.error("Please enter the Mobile Serial Number");
        return;
      }
      if (!mobileBrand.trim()) {
        toast.error("Please specify the Mobile Brand");
        return;
      }
      if (!mobileModel.trim()) {
        toast.error("Please specify the Mobile Model");
        return;
      }
    }

    if (laptopMode === "NONE" && mobileMode === "NONE") {
      toast.error("Please configure at least one device or mark it as personal");
      return;
    }

    setSubmitting(true);
    try {
      const promises = [];

      // 1. Submit Laptop Audit
      if (laptopMode !== "NONE") {
        const isPers = laptopMode === "PERSONAL";
        const laptopCondText = laptopConditions.length > 0
          ? laptopConditions.map(c => {
              if (c === "perfect") return "Working Perfectly";
              if (c === "battery") return "Battery Weak";
              if (c === "keyboard") return "Input/Keyboard Issues";
              if (c === "screen") return "Display Glitches";
              if (c === "physical") return "Physical Damage";
              if (c === "performance") return "Slow Performance";
              return c;
            }).join(", ")
          : "Working Perfectly";

        const finalLaptopRemarks = laptopRemarks.trim()
          ? `[Condition: ${laptopCondText}] ${laptopRemarks.trim()}`
          : `[Condition: ${laptopCondText}]`;

        promises.push(
          fetch("/api/helpdesk/assets/audits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serialNumber: isPers ? `PERSONAL-LAPTOP-${employeeNo}` : laptopSerial.trim(),
              assetNumber: null,
              deviceType: "LAPTOP",
              brand: isPers ? "Personal" : laptopBrand.trim(),
              model: isPers ? "Personal Device" : laptopModel.trim(),
              employeeNo,
              custodianName,
              department,
              siteOfficeId: siteOfficeId || null,
              location,
              status: "ACTIVE",
              remarks: finalLaptopRemarks,
              isConfirmed: laptopIsConfirmed && !isPers,
              isPersonal: isPers
            })
          })
        );
      }

      // 2. Submit Mobile Audit
      if (mobileMode !== "NONE") {
        const isPers = mobileMode === "PERSONAL";
        const mobileCondText = mobileConditions.length > 0
          ? mobileConditions.map(c => {
              if (c === "perfect") return "Working Perfectly";
              if (c === "battery") return "Battery Weak";
              if (c === "screen") return "Screen Cracks";
              if (c === "physical") return "Physical/Button Damage";
              if (c === "signal") return "Signal Issues";
              if (c === "performance") return "Slow/Lagging";
              return c;
            }).join(", ")
          : "Working Perfectly";

        const finalMobileRemarks = mobileRemarks.trim()
          ? `[Condition: ${mobileCondText}] ${mobileRemarks.trim()}`
          : `[Condition: ${mobileCondText}]`;

        promises.push(
          fetch("/api/helpdesk/assets/audits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serialNumber: isPers ? `PERSONAL-MOBILE-${employeeNo}` : mobileSerial.trim(),
              assetNumber: null,
              deviceType: "MOBILE",
              brand: isPers ? "Personal" : mobileBrand.trim(),
              model: isPers ? "Personal Device" : mobileModel.trim(),
              employeeNo,
              custodianName,
              department,
              siteOfficeId: siteOfficeId || null,
              location,
              status: "ACTIVE",
              remarks: finalMobileRemarks,
              isConfirmed: mobileIsConfirmed && !isPers,
              isPersonal: isPers
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      let successCount = 0;
      for (const res of responses) {
        const json = await res.json();
        if (json.success) successCount++;
      }

      if (successCount > 0) {
        setStep("SUCCESS");
        toast.success("Device audit report submitted successfully!");
      } else {
        toast.error("Submission failed. Please check inputs.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during audit submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepStatusClass = (currentStep: typeof step, target: typeof step) => {
    const stepsOrder: typeof step[] = ["CUSTODIAN", "DEVICES", "SUCCESS"];
    const currentIndex = stepsOrder.indexOf(currentStep);
    const targetIndex = stepsOrder.indexOf(target);

    if (currentIndex > targetIndex) return "bg-emerald-600 border-emerald-600 text-white"; 
    if (currentIndex === targetIndex) return "bg-emerald-600 border-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/40"; 
    return "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-450";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/5 dark:from-blue-900/10 via-slate-50 dark:via-slate-900 to-white dark:to-black pointer-events-none z-0" />

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl z-10 space-y-6">
        
        {/* Title */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-full border border-emerald-200 dark:border-emerald-800/40">
            <Laptop className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">SLTS IT Assets Audit</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Quickly reconcile and verify Laptops and Mobiles issued to you by the IT department.
          </p>
        </div>

        {/* Progress bar */}
        {step !== "SUCCESS" && (
          <div className="relative flex justify-between items-center max-w-xs mx-auto px-4 py-2">
            <div className="absolute left-8 right-8 top-1/2 h-[2px] bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10">
              <div 
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ 
                  width: step === "CUSTODIAN" ? "0%" : "100%" 
                }}
              />
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${getStepStatusClass(step, "CUSTODIAN")}`}>
                {step !== "CUSTODIAN" ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Custodian</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-sm transition-all ${getStepStatusClass(step, "DEVICES")}`}>
                2
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Devices & Condition</span>
            </div>
          </div>
        )}

        {/* STEP 1: CUSTODIAN PROFILE */}
        {step === "CUSTODIAN" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                Who is auditing these devices?
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Employee ID / EPF No</label>
                  <Input
                    placeholder="e.g. 604, 618"
                    value={employeeNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val) && val.length <= 4) {
                        setEmployeeNo(val);
                      }
                    }}
                    className="h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center justify-between">
                    <span>Full Name</span>
                    {fetchingStaff && <span className="text-[10px] text-emerald-600 animate-pulse lowercase font-normal">fetching...</span>}
                    {!fetchingStaff && staffFound && <span className="text-[10px] text-emerald-600 font-bold lowercase flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> verified</span>}
                  </label>
                  <Input
                    placeholder="Auto-loaded from DB"
                    value={custodianName}
                    onChange={(e) => setCustodianName(e.target.value)}
                    disabled={staffFound || fetchingStaff}
                    className={`h-10 text-sm border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500 ${
                      staffFound ? "bg-slate-100 dark:bg-slate-900 text-slate-550 cursor-not-allowed border-emerald-250 dark:border-emerald-800" : "bg-white dark:bg-slate-955"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Department</label>
                  <Input
                    placeholder="e.g. IT, Finance, HR"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Site Office</label>
                  <Select
                    value={siteOfficeId || "none"}
                    onValueChange={(val) => setSiteOfficeId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-emerald-500">
                      <SelectValue placeholder="Select Site Office" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
                      <SelectItem value="none">Not Specified</SelectItem>
                      {siteOffices.map((office) => (
                        <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Location / Floor / Room</label>
                <Input
                  placeholder="e.g. 2nd Floor, Server Room"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <Button
              onClick={handleCustodianNext}
              disabled={fetchingStaff || !employeeNo.trim() || !custodianName.trim()}
              className="w-full h-11 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              Continue to Device Details
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: DEVICES & CONDITIONS */}
        {step === "DEVICES" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 💻 LAPTOP CARD SECTION */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Laptop className="w-4.5 h-4.5 text-emerald-600" />
                  Laptop Configuration
                </h3>
                
                <Select
                  value={laptopMode}
                  onValueChange={(val: "COMPANY" | "PERSONAL" | "NONE") => {
                    setLaptopMode(val);
                    if (val === "PERSONAL") {
                      setLaptopSerial(`PERSONAL-LAPTOP-${employeeNo}`);
                      setLaptopBrand("Personal");
                      setLaptopModel("Personal Device");
                      setLaptopIsConfirmed(false);
                    } else if (val === "NONE") {
                      setLaptopSerial("");
                      setLaptopBrand("");
                      setLaptopModel("");
                      setLaptopIsConfirmed(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-8.5 text-xs w-36 bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-850">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850">
                    <SelectItem value="COMPANY">Company Issued</SelectItem>
                    <SelectItem value="PERSONAL">Personal Laptop</SelectItem>
                    <SelectItem value="NONE">No Laptop Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {laptopMode === "COMPANY" && (
                <div className="space-y-4">
                  {/* Quick Sync Agent Recommendation Banner */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 rounded-xl p-4 space-y-3 text-xs text-slate-800 dark:text-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-400">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <span>Quick Sync & Auto-Audit (නිර්දේශිතයි)</span>
                      </div>
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">Recommended</span>
                    </div>
                    
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-350">
                      ඔබගේ ලැප්ටොප් පරිගණකයේ විස්තර (Serial Number, OS configuration, Hardware specifications) ස්වයංක්‍රීයවම ERP පද්ධතියට සම්බන්ධ කිරීමට, පහත දැක්වෙන **SLTS ERP Desktop Sync Agent** ස්ථාපනය කරන්න. එය ස්ථාපනය කිරීමෙන් පසු මෙම Form එක පිරවීම අවශ්‍ය නොවේ.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://github.com/madu025/SLTSERPAGENT/releases/download/v1.0.0/SLTSERPagent_setup.exe"
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all"
                      >
                        Download Desktop Agent <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="mt-3 border-t border-slate-200 dark:border-slate-800/80 pt-3 space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wide">Installation Steps (පිළිපැදිය යුතු පියවර):</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1.5">
                        <div className="bg-white/40 dark:bg-slate-955/20 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-lg space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4.5 h-4.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                            <span className="font-bold text-[10px]">Download Setup</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Click above button to download <code>SLTSERPagent_setup.exe</code>.
                          </p>
                        </div>

                        <div className="bg-white/40 dark:bg-slate-955/20 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-lg space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4.5 h-4.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                            <span className="font-bold text-[10px]">Install Agent</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Run setup file & follow the installation wizard.
                          </p>
                        </div>

                        <div className="bg-white/40 dark:bg-slate-955/20 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-lg space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4.5 h-4.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                            <span className="font-bold text-[10px]">Auto-Sync Done</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            The agent will query motherboard S/N & sync automatically.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {laptopFound && !laptopUseDifferent ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 p-4 rounded-lg flex justify-between items-start gap-2 animate-fade-in">
                      <div className="flex gap-2.5 items-start">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Assigned Company Laptop Detected</h4>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                            Specs: <span className="font-semibold text-slate-900 dark:text-slate-100">{laptopBrand} {laptopModel}</span>
                          </p>
                          <p className="text-sm text-slate-500 font-mono mt-0.5">S/N: {laptopSerial}</p>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        onClick={() => {
                          setLaptopUseDifferent(true);
                          setLaptopSerial("");
                          setLaptopBrand("");
                          setLaptopModel("");
                          setLaptopIsConfirmed(false);
                          setLaptopFound(false);
                        }}
                        className="text-xs text-amber-600 dark:text-amber-500 font-semibold p-0 h-auto"
                      >
                        Change S/N
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-fade-in">
                      {laptopUseDifferent && assignedAssets.some(a => a.deviceType === "LAPTOP") && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-amber-500 font-semibold">Custom Laptop Entry Mode</span>
                          <Button
                            variant="link"
                            type="button"
                            onClick={() => {
                              const dbLap = assignedAssets.find(a => a.deviceType === "LAPTOP");
                              if (dbLap) {
                                setLaptopUseDifferent(false);
                                setLaptopSerial(dbLap.serialNumber);
                                setLaptopBrand(dbLap.brand || "");
                                setLaptopModel(dbLap.model || "");
                                setLaptopFound(true);
                                setLaptopIsConfirmed(true);
                              }
                            }}
                            className="text-xs text-emerald-600 p-0 h-auto"
                          >
                            Revert to Assigned
                          </Button>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Laptop Serial Number (S/N)</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Type Laptop S/N"
                              value={laptopSerial}
                              onChange={(e) => {
                                setLaptopSerial(e.target.value);
                                setLaptopIsConfirmed(false);
                                setLaptopFound(false);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSearchDevice("LAPTOP");
                                  }
                              }}
                              className="pl-9 h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleSearchDevice("LAPTOP")}
                            disabled={laptopSearching || !laptopSerial.trim()}
                            className="h-10 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            {laptopSearching ? "Looking up..." : "Search"}
                          </Button>
                        </div>
                      </div>

                      {/* Display warning or manually spec inputs */}
                      {laptopSerial.trim().length >= 4 && (
                        <div className="transition-all duration-300">
                          {laptopSearching ? null : laptopIsConfirmed && laptopFound ? (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 p-3.5 rounded-lg flex gap-2 items-start animate-fade-in text-xs text-emerald-800 dark:text-emerald-400">
                              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                              <span>Recognized in inventory database: <strong>{laptopBrand} {laptopModel}</strong></span>
                            </div>
                          ) : (
                            <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-800/40 p-4 rounded-lg space-y-3 animate-fade-in">
                              <div className="flex gap-2 items-start text-xs text-amber-800 dark:text-amber-400">
                                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                                <span>Device not found in DB. Provide specifications manually:</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Brand</label>
                                  <Select
                                    value={laptopCustomBrand ? "Other" : (LAPTOP_BRANDS.includes(laptopBrand) ? laptopBrand : "")}
                                    onValueChange={(val) => {
                                      if (val === "Other") {
                                        setLaptopCustomBrand(true);
                                        setLaptopBrand("");
                                      } else {
                                        setLaptopCustomBrand(false);
                                        setLaptopBrand(val);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-950 border-slate-200">
                                      <SelectValue placeholder="Brand" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200">
                                      {LAPTOP_BRANDS.map(b => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                      ))}
                                      <SelectItem value="Other">Other Brand</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Model</label>
                                  <Input
                                    placeholder="e.g. ThinkPad E15"
                                    value={laptopModel}
                                    onChange={(e) => setLaptopModel(e.target.value)}
                                    className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200"
                                  />
                                </div>
                              </div>

                              {laptopCustomBrand && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Specify Brand Name</label>
                                  <Input
                                    placeholder="Type Brand"
                                    value={laptopBrand}
                                    onChange={(e) => setLaptopBrand(e.target.value)}
                                    className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-150 dark:border-slate-850/80 space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      Laptop Condition
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {LAPTOP_CONDITIONS.map((opt) => {
                        const isChecked = laptopConditions.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setLaptopConditions((prev) => {
                                if (opt.id === "perfect") return ["perfect"];
                                const filtered = prev.filter(c => c !== "perfect");
                                if (filtered.includes(opt.id)) {
                                  const next = filtered.filter(c => c !== opt.id);
                                  return next.length === 0 ? ["perfect"] : next;
                                } else {
                                  return [...filtered, opt.id];
                                }
                              });
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded border text-left text-xs font-medium transition-all ${
                              isChecked
                                ? "bg-emerald-50/50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
                                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900 dark:border-slate-800 dark:text-slate-350"
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                              isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "bg-transparent border-slate-300 dark:border-slate-700"
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Laptop Comments / Remarks</label>
                      <Input
                        placeholder="Describe any laptop keyboard, battery or display issues..."
                        value={laptopRemarks}
                        onChange={(e) => setLaptopRemarks(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-slate-950 border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {laptopMode === "PERSONAL" && (
                <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-lg text-xs text-slate-650 flex gap-2">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
                  <span>You have reported using your <strong>Personal Laptop</strong>. We will record this status. No technical specifications are saved.</span>
                </div>
              )}

              {laptopMode === "NONE" && (
                <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-lg text-xs text-slate-650 flex gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                  <span>You have reported that you do <strong>not use</strong> a laptop for your work.</span>
                </div>
              )}
            </div>

            {/* 📱 MOBILE CARD SECTION */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-4.5 h-4.5 text-emerald-600" />
                  Mobile Phone Configuration
                </h3>
                
                <Select
                  value={mobileMode}
                  onValueChange={(val: "COMPANY" | "PERSONAL" | "NONE") => {
                    setMobileMode(val);
                    if (val === "PERSONAL") {
                      setMobileSerial(`PERSONAL-MOBILE-${employeeNo}`);
                      setMobileBrand("Personal");
                      setMobileModel("Personal Device");
                      setMobileIsConfirmed(false);
                    } else if (val === "NONE") {
                      setMobileSerial("");
                      setMobileBrand("");
                      setMobileModel("");
                      setMobileIsConfirmed(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-8.5 text-xs w-36 bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-850">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-850">
                    <SelectItem value="COMPANY">Company Issued</SelectItem>
                    <SelectItem value="PERSONAL">Personal Phone</SelectItem>
                    <SelectItem value="NONE">No Phone Issued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mobileMode === "COMPANY" && (
                <div className="space-y-4">
                  {mobileFound && !mobileUseDifferent ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 p-4 rounded-lg flex justify-between items-start gap-2 animate-fade-in">
                      <div className="flex gap-2.5 items-start">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Assigned Company Phone Detected</h4>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                            Specs: <span className="font-semibold text-slate-900 dark:text-slate-100">{mobileBrand} {mobileModel}</span>
                          </p>
                          <p className="text-sm text-slate-500 font-mono mt-0.5">S/N: {mobileSerial}</p>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        onClick={() => {
                          setMobileUseDifferent(true);
                          setMobileSerial("");
                          setMobileBrand("");
                          setMobileModel("");
                          setMobileIsConfirmed(false);
                          setMobileFound(false);
                        }}
                        className="text-xs text-amber-600 dark:text-amber-500 font-semibold p-0 h-auto"
                      >
                        Change S/N
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-fade-in">
                      {mobileUseDifferent && assignedAssets.some(a => a.deviceType === "MOBILE") && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-amber-500 font-semibold">Custom Phone Entry Mode</span>
                          <Button
                            variant="link"
                            type="button"
                            onClick={() => {
                              const dbMob = assignedAssets.find(a => a.deviceType === "MOBILE");
                              if (dbMob) {
                                setMobileUseDifferent(false);
                                setMobileSerial(dbMob.serialNumber);
                                setMobileBrand(dbMob.brand || "");
                                setMobileModel(dbMob.model || "");
                                setMobileFound(true);
                                setMobileIsConfirmed(true);
                              }
                            }}
                            className="text-xs text-emerald-600 p-0 h-auto"
                          >
                            Revert to Assigned
                          </Button>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mobile Serial / IMEI Number</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Type Mobile S/N or IMEI"
                              value={mobileSerial}
                              onChange={(e) => {
                                setMobileSerial(e.target.value);
                                setMobileIsConfirmed(false);
                                setMobileFound(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSearchDevice("MOBILE");
                                }
                              }}
                              className="pl-9 h-10 text-sm bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleSearchDevice("MOBILE")}
                            disabled={mobileSearching || !mobileSerial.trim()}
                            className="h-10 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            {mobileSearching ? "Looking up..." : "Search"}
                          </Button>
                        </div>
                      </div>

                      {/* Manual Mobile Inputs */}
                      {mobileSerial.trim().length >= 4 && (
                        <div className="transition-all duration-300">
                          {mobileSearching ? null : mobileIsConfirmed && mobileFound ? (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 p-3.5 rounded-lg flex gap-2 items-start animate-fade-in text-xs text-emerald-800 dark:text-emerald-400">
                              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                              <span>Recognized in inventory database: <strong>{mobileBrand} {mobileModel}</strong></span>
                            </div>
                          ) : (
                            <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-800/40 p-4 rounded-lg space-y-3 animate-fade-in">
                              <div className="flex gap-2 items-start text-xs text-amber-800 dark:text-amber-400">
                                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                                <span>Phone not in database. Provide details manually:</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Brand</label>
                                  <Select
                                    value={mobileCustomBrand ? "Other" : (MOBILE_BRANDS.includes(mobileBrand) ? mobileBrand : "")}
                                    onValueChange={(val) => {
                                      if (val === "Other") {
                                        setMobileCustomBrand(true);
                                        setMobileBrand("");
                                      } else {
                                        setMobileCustomBrand(false);
                                        setMobileBrand(val);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200">
                                      <SelectValue placeholder="Brand" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-955 border-slate-200">
                                      {MOBILE_BRANDS.map(b => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                      ))}
                                      <SelectItem value="Other">Other Brand</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Model</label>
                                  <Input
                                    placeholder="e.g. Galaxy A34, Redmi 12"
                                    value={mobileModel}
                                    onChange={(e) => setMobileModel(e.target.value)}
                                    className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200"
                                  />
                                </div>
                              </div>

                              {mobileCustomBrand && (
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Specify Brand Name</label>
                                  <Input
                                    placeholder="Type Brand"
                                    value={mobileBrand}
                                    onChange={(e) => setMobileBrand(e.target.value)}
                                    className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mobile Conditions & Remarks Section */}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-150 dark:border-slate-850/80 space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      Mobile Phone Condition
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MOBILE_CONDITIONS.map((opt) => {
                        const isChecked = mobileConditions.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setMobileConditions((prev) => {
                                if (opt.id === "perfect") return ["perfect"];
                                const filtered = prev.filter(c => c !== "perfect");
                                if (filtered.includes(opt.id)) {
                                  const next = filtered.filter(c => c !== opt.id);
                                  return next.length === 0 ? ["perfect"] : next;
                                } else {
                                  return [...filtered, opt.id];
                                }
                              });
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded border text-left text-xs font-medium transition-all ${
                              isChecked
                                ? "bg-emerald-50/50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
                                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900 dark:border-slate-800 dark:text-slate-355"
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                              isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "bg-transparent border-slate-300 dark:border-slate-700"
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mobile Comments / Remarks</label>
                      <Input
                        placeholder="Describe any mobile screen cracks, button defects or battery drain issues..."
                        value={mobileRemarks}
                        onChange={(e) => setMobileRemarks(e.target.value)}
                        className="h-10 text-sm bg-white dark:bg-slate-955 border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {mobileMode === "PERSONAL" && (
                <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-lg text-xs text-slate-650 flex gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
                  <span>You have reported using your <strong>Personal Mobile Phone</strong>. We will record this status. No technical specifications are saved.</span>
                </div>
              )}

              {mobileMode === "NONE" && (
                <div className="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-lg text-xs text-slate-650 flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-slate-400 shrink-0" />
                  <span>You have reported that you do <strong>not use</strong> a mobile phone for company work.</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep("CUSTODIAN")}
                className="w-1/3 h-11 text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="w-2/3 h-11 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-2 transition-all duration-300"
              >
                {submitting ? "Submitting..." : "Submit Audit Report"}
                <CheckCircle className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS COMPLETED */}
        {step === "SUCCESS" && (
          <div className="text-center space-y-6 py-4 flex flex-col items-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Audit Verification Submitted</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Thank you for completing your hardware reconciliation. The IT asset team will review the submitted information.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 w-full text-left space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Employee ID:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{employeeNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Custodian:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{custodianName}</span>
              </div>
              {laptopMode !== "NONE" && (
                <div className="flex justify-between border-t border-dashed border-slate-250 dark:border-slate-800 pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Laptop Status:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {laptopMode === "PERSONAL" ? "Personal Laptop" : `${laptopBrand} ${laptopModel}`}
                  </span>
                </div>
              )}
              {mobileMode !== "NONE" && (
                <div className="flex justify-between border-t border-dashed border-slate-250 dark:border-slate-800 pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Mobile Status:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {mobileMode === "PERSONAL" ? "Personal Phone" : `${mobileBrand} ${mobileModel}`}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                setEmployeeNo("");
                setCustodianName("");
                setDepartment("");
                setSiteOfficeId("");
                setLocation("");
                setAssignedAssets([]);
                setLaptopConditions(["perfect"]);
                setLaptopRemarks("");
                setMobileConditions(["perfect"]);
                setMobileRemarks("");
                setStep("CUSTODIAN");
              }}
              className="w-full h-11 text-sm font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white"
            >
              Verify Another Employee Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
