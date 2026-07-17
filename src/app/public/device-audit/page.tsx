"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Laptop, Search, CheckCircle, AlertTriangle, ShieldCheck, User, Building, HelpCircle, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const STANDARD_BRANDS = ["HP", "Lenovo", "Dell", "Asus", "Acer", "MSI", "Apple"];

interface DevicePreview {
  serialNumber: string;
  brand: string;
  model: string;
  deviceType: string;
  assignedStaff?: {
    employeeId: string;
    name: string;
  } | null;
}

export default function PublicDeviceAuditPage() {
  const [step, setStep] = useState<"IDENTIFY" | "CUSTODIAN" | "CONDITION" | "SUCCESS">("IDENTIFY");
  const [serialInput, setSerialInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Found device details (if any)
  const [deviceFound, setDeviceFound] = useState(false);
  const [devicePreview, setDevicePreview] = useState<DevicePreview | null>(null);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(["perfect"]);
  const [customRemarks, setCustomRemarks] = useState("");
  const [siteOffices, setSiteOffices] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    serialNumber: "",
    assetNumber: "",
    deviceType: "LAPTOP" as "LAPTOP" | "DESKTOP" | "MOBILE" | "PRINTER" | "NETWORK" | "OTHER",
    brand: "",
    model: "",
    employeeNo: "",
    custodianName: "",
    department: "",
    siteOfficeId: "",
    location: "",
    status: "ACTIVE" as "ACTIVE" | "UNDER_REPAIR" | "DECOMMISSIONED" | "SPARE" | "FAULTY" | "DISPOSED" | "TRANSFERRED",
    remarks: "",
    isConfirmed: false
  });

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

  // Handle serial input changes and reset search states
  const handleSerialChange = (val: string) => {
    setSerialInput(val);
    setHasSearched(false);
    setDeviceFound(false);
    setDevicePreview(null);
  };

  // Search on Serial Number manually
  const handleSearchSerial = async () => {
    const trimmedSerial = serialInput.trim();
    if (!trimmedSerial) {
      toast.error("Please enter a device serial number to search");
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/helpdesk/assets/search-by-serial?serialNumber=${encodeURIComponent(trimmedSerial)}`);
      const json = await res.json();
      
      setHasSearched(true);
      
      if (json.success && json.data && json.data.found && json.data.asset) {
        const asset = json.data.asset;
        setDeviceFound(true);
        setDevicePreview({
          serialNumber: asset.serialNumber,
          brand: asset.brand || "",
          model: asset.model || "",
          deviceType: asset.deviceType,
          assignedStaff: asset.assignedStaff ? {
            employeeId: asset.assignedStaff.employeeId,
            name: asset.assignedStaff.name
          } : null
        });

        const brandVal = asset.brand || "";
        setIsCustomBrand(brandVal ? !STANDARD_BRANDS.map(b => b.toLowerCase()).includes(brandVal.toLowerCase()) : false);
        
        setFormData((prev) => ({
          ...prev,
          serialNumber: asset.serialNumber,
          assetNumber: asset.assetNumber || "",
          deviceType: asset.deviceType,
          brand: brandVal,
          model: asset.model || "",
          status: asset.status,
          employeeNo: asset.assignedStaff?.employeeId || "",
          custodianName: asset.assignedStaff?.name || "",
          department: asset.department || "",
          siteOfficeId: asset.siteOfficeId || "",
          location: asset.location || ""
        }));
        toast.success("Device recognized in database!");
      } else {
        setDeviceFound(false);
        setDevicePreview(null);
        setIsCustomBrand(false);
        setFormData((prev) => ({
          ...prev,
          serialNumber: trimmedSerial,
          brand: "",
          model: "",
          deviceType: "LAPTOP",
          status: "ACTIVE",
          employeeNo: "",
          custodianName: "",
          department: "",
          siteOfficeId: "",
          location: ""
        }));
        toast.info("Device not found in database. Please enter details manually.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch device details.");
    } finally {
      setSearching(false);
    }
  };

  // Navigate to Step 2
  const handleIdentifyNext = () => {
    if (!serialInput.trim()) {
      toast.error("Please enter a device serial number");
      return;
    }
    if (!hasSearched) {
      toast.error("Please search/verify the serial number first");
      return;
    }
    if (!deviceFound) {
      if (!formData.brand.trim()) {
        toast.error("Please specify the device Brand");
        return;
      }
      if (!formData.model.trim()) {
        toast.error("Please specify the device Model");
        return;
      }
    }
    setStep("CUSTODIAN");
  };

  // Navigate to Step 3
  const handleCustodianNext = () => {
    if (!formData.employeeNo.trim()) {
      toast.error("Please enter your EPF / Employee ID");
      return;
    }
    if (!formData.custodianName.trim()) {
      toast.error("Please enter your Full Name");
      return;
    }
    setStep("CONDITION");
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const conditionsText = selectedConditions.length > 0
        ? selectedConditions.map(c => {
            if (c === "perfect") return "Working Perfectly";
            if (c === "battery") return "Battery Weak";
            if (c === "keyboard") return "Keyboard/Touchpad Malfunction";
            if (c === "screen") return "Display Glitches";
            if (c === "physical") return "Physical Damage";
            if (c === "performance") return "Slow Performance";
            return c;
          }).join(", ")
        : "Working Perfectly";

      const finalRemarks = customRemarks.trim()
        ? `[Condition: ${conditionsText}] ${customRemarks.trim()}`
        : `[Condition: ${conditionsText}]`;

      const res = await fetch("/api/helpdesk/assets/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          remarks: finalRemarks,
          isConfirmed: deviceFound
        })
      });

      const json = await res.json();
      if (json.success) {
        setStep("SUCCESS");
        toast.success("Device audit report submitted successfully!");
      } else {
        toast.error(json.error?.message || "Submission failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Submission failed due to a network error.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step indicator color helper
  const getStepStatusClass = (currentStep: typeof step, target: typeof step) => {
    const stepsOrder: typeof step[] = ["IDENTIFY", "CUSTODIAN", "CONDITION", "SUCCESS"];
    const currentIndex = stepsOrder.indexOf(currentStep);
    const targetIndex = stepsOrder.indexOf(target);

    if (currentIndex > targetIndex) {
      return "bg-emerald-600 border-emerald-600 text-white"; // Completed
    }
    if (currentIndex === targetIndex) {
      return "bg-primary border-primary text-white ring-4 ring-primary/20"; // Active
    }
    return "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"; // Pending
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/5 dark:from-blue-900/20 via-slate-50 dark:via-slate-900 to-white dark:to-black pointer-events-none z-0" />

      <div className="w-full max-w-xl bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl z-10 space-y-6">
        
        {/* Title / Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary/10 text-primary p-3 rounded-full border border-primary/20">
            <Laptop className="h-6 w-6 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">SLTS IT Device Audit</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Quickly verify your assigned workspace equipment to help reconcile our inventory.
          </p>
        </div>

        {/* Dynamic Progress Indicator */}
        {step !== "SUCCESS" && (
          <div className="relative flex justify-between items-center max-w-md mx-auto px-4 py-2">
            <div className="absolute left-8 right-8 top-1/2 h-[2px] bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ 
                  width: step === "IDENTIFY" ? "0%" : step === "CUSTODIAN" ? "50%" : "100%" 
                }}
              />
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${getStepStatusClass(step, "IDENTIFY")}`}>
                {step !== "IDENTIFY" && (step === "CUSTODIAN" || step === "CONDITION") ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Device</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${getStepStatusClass(step, "CUSTODIAN")}`}>
                {step === "CONDITION" ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Custodian</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${getStepStatusClass(step, "CONDITION")}`}>
                3
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Condition</span>
            </div>
          </div>
        )}

        {/* STEP 1: IDENTIFY DEVICE */}
        {step === "IDENTIFY" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Device Serial Number (S/N)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Type Serial Number (e.g. CND8508MNO, PF57...)"
                    value={serialInput}
                    onChange={(e) => handleSerialChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchSerial();
                      }
                    }}
                    className="pl-9 h-10 text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-full"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearchSerial}
                  disabled={searching || !serialInput.trim()}
                  className="h-10 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  Search
                </Button>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                Found on the barcode sticker at the bottom or back of the computer.
              </p>
            </div>

            {/* Instant Prefill / Lookup Status Cards */}
            {hasSearched && (
              <div className="transition-all duration-300">
                {searching ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex justify-center items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Searching inventory...</span>
                  </div>
                ) : deviceFound && devicePreview ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl flex gap-3 items-start animate-fade-in">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Device Automatically Recognized</h3>
                      <p className="text-[10px] text-slate-700 dark:text-slate-300">
                        Specs: <span className="font-semibold">{devicePreview.brand} {devicePreview.model} ({devicePreview.deviceType})</span>
                      </p>
                      {devicePreview.assignedStaff && (
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">
                          Custodian: {devicePreview.assignedStaff.name} ({devicePreview.assignedStaff.employeeId})
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl space-y-3 animate-fade-in">
                    <div className="flex gap-3 items-start">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400">New Device (Not in Database)</h3>
                        <p className="text-[10px] text-slate-700 dark:text-slate-300">
                          Please enter the specifications manually to register this device.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Device Type</label>
                        <Select
                          value={formData.deviceType}
                          onValueChange={(val: "LAPTOP" | "DESKTOP" | "MOBILE" | "PRINTER" | "NETWORK" | "OTHER") => setFormData((prev) => ({ ...prev, deviceType: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <SelectItem value="LAPTOP">Laptop</SelectItem>
                            <SelectItem value="DESKTOP">Desktop</SelectItem>
                            <SelectItem value="MOBILE">Mobile Phone</SelectItem>
                            <SelectItem value="PRINTER">Printer</SelectItem>
                            <SelectItem value="NETWORK">Network Device</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Brand</label>
                        <Select
                          value={isCustomBrand ? "Other" : (STANDARD_BRANDS.includes(formData.brand) ? formData.brand : "")}
                          onValueChange={(val) => {
                            if (val === "Other") {
                              setIsCustomBrand(true);
                              setFormData(prev => ({ ...prev, brand: "" }));
                            } else {
                              setIsCustomBrand(false);
                              setFormData(prev => ({ ...prev, brand: val }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <SelectValue placeholder="Select Brand" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            {STANDARD_BRANDS.map(brand => (
                              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                            ))}
                            <SelectItem value="Other">Other Brand</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isCustomBrand && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Specify Brand</label>
                        <Input
                          placeholder="Type brand name"
                          value={formData.brand}
                          onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                          className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Model</label>
                      <Input
                        placeholder="e.g. ProBook 450 G8, ThinkPad E15"
                        value={formData.model}
                        onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                        className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleIdentifyNext}
              disabled={searching || !serialInput.trim()}
              className="w-full h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center justify-center gap-1.5 mt-2"
            >
              Continue to Custodian Details
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: CUSTODIAN & LOCATION */}
        {step === "CUSTODIAN" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <User className="w-4 h-4 text-emerald-600" />
                Who uses this device?
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Employee ID / EPF No</label>
                  <Input
                    placeholder="e.g. OSP005, EMP123"
                    value={formData.employeeNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, employeeNo: e.target.value }))}
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Full Name</label>
                  <Input
                    placeholder="e.g. Prasad Silva"
                    value={formData.custodianName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, custodianName: e.target.value }))}
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Building className="w-4 h-4 text-emerald-600" />
                Where is it located?
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Department</label>
                  <Input
                    placeholder="e.g. IT, Finance, HR"
                    value={formData.department}
                    onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Site Office</label>
                  <Select
                    value={formData.siteOfficeId || "none"}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, siteOfficeId: val === "none" ? "" : val }))}
                  >
                    <SelectTrigger className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-emerald-500">
                      <SelectValue placeholder="Select Site Office" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
                      <SelectItem value="none">Not Specified</SelectItem>
                      {siteOffices.map((office) => (
                        <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Location / Floor / Room</label>
                <Input
                  placeholder="e.g. 2nd Floor, Server Room"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep("IDENTIFY")}
                className="w-1/3 h-10 text-xs border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleCustodianNext}
                className="w-2/3 h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                Continue to Condition
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: DEVICE CONDITION */}
        {step === "CONDITION" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Check current device health status:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "perfect", label: "Working Perfectly (කිසිදු දෝෂයක් නොමැත)" },
                  { id: "battery", label: "Battery Weak / Not Charging (බැටරි දෝෂ)" },
                  { id: "keyboard", label: "Keyboard & Touchpad Issues" },
                  { id: "screen", label: "Display/Screen Glitches (තිරයේ දෝෂ)" },
                  { id: "physical", label: "Physical Damage (කැඩීම්/Dents)" },
                  { id: "performance", label: "Slow Performance / Overheat" }
                ].map((opt) => {
                  const isChecked = selectedConditions.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedConditions((prev) => {
                          if (opt.id === "perfect") {
                            return ["perfect"];
                          }
                          const filtered = prev.filter(c => c !== "perfect");
                          if (filtered.includes(opt.id)) {
                            const next = filtered.filter(c => c !== opt.id);
                            return next.length === 0 ? ["perfect"] : next;
                          } else {
                            return [...filtered, opt.id];
                          }
                        });
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                        isChecked
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isChecked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-transparent border-slate-300 dark:border-slate-700"
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Additional Comments / Specific Remarks
                </label>
                <Input
                  placeholder="Describe any other issues in detail..."
                  value={customRemarks}
                  onChange={(e) => setCustomRemarks(e.target.value)}
                  className="h-8.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setStep("CUSTODIAN")}
                className="w-1/3 h-10 text-xs border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300 flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="w-2/3 h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {submitting ? "Submitting..." : "Submit Audit Report"}
                <CheckCircle className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS COMPLETED */}
        {step === "SUCCESS" && (
          <div className="text-center space-y-6 py-4 flex flex-col items-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Verification Submitted</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Thank you for completing the verification. The IT department will review your submission and reconcile the records.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 w-full text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Device:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formData.brand} {formData.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Serial No:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{formData.serialNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Custodian:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formData.custodianName} ({formData.employeeNo})</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setSerialInput("");
                setSelectedConditions(["perfect"]);
                setCustomRemarks("");
                setStep("IDENTIFY");
              }}
              className="w-full h-10 text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white"
            >
              Verify Another Device
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
