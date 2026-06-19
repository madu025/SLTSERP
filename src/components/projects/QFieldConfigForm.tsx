"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Save, Settings, Layers, ListPlus, RotateCcw } from 'lucide-react';

interface QFieldFieldConfig {
  id?: string;
  layerId: string;
  fieldName: string;
  options: string[];
}

interface QFieldConfigFormProps {
  projectId: string;
  projectCode: string;
  projectName: string;
}

// Map of QGIS template layers and their typical text fields
const LAYER_FIELDS_MAP: Record<string, { label: string; fields: string[] }> = {
  SLT_Poles: {
    label: "Poles (SLT_Poles)",
    fields: ["POLE TYPE", "POLE MAKE", "Exist_New", "POLE HEIGHT", "SIDE", "RISER PIPE", "STAYS", "STRUT", "OVERHEAD GUY", "JOINT"]
  },
  SLT_Cables: {
    label: "Cables (SLT_Cables)",
    fields: ["Cable_Type", "Main_Sheat", "Ext_Sheath"]
  },
  SLT_FJ: {
    label: "Fiber Joint (SLT_FJ)",
    fields: ["TYPE", "Exst_New", "Connected EQ Number"]
  },
  SLT_FDP: {
    label: "Distribution Point (SLT_FDP)",
    fields: ["TYPE", "Exst_New", "SPLITTER TYPE"]
  },
  SLT_Ducts: {
    label: "Ducts (SLT_Ducts)",
    fields: ["TYPE", "PROTECTION", "DAMAGE", "DUCT_ENV"]
  },
  SLT_FTC: {
    label: "FTC Cabinet (SLT_FTC)",
    fields: ["TYPE", "Exst_New", "CAPACITY", "SIDE"]
  },
  SLT_HH: {
    label: "Hand Hole (SLT_HH)",
    fields: ["Exist_New", "SUB TYPE", "FRAME AND COVER STATUS", "NUMBER OF WAYS"]
  },
  SLT_MH: {
    label: "Man Hole (SLT_MH)",
    fields: ["Exst_New", "SUB TYPE", "FRAME AND COVER STATUS", "NUMBER OF WAYS"]
  },
  SLT_ODF: {
    label: "ODF Frame (SLT_ODF)",
    fields: ["Exst_New", "MODEL"]
  },
  SLT_Risers: {
    label: "Risers (SLT_Risers)",
    fields: ["RISER TYPE", "MOUNT_TYPE"]
  },
  SLT_TP: {
    label: "Termination Point (SLT_TP)",
    fields: ["PE NUMBER", "Existing_New", "CUSTOMER TYPE", "CUSTOMER SUB TYPE", "SERVICE STATUS"]
  }
};

// Preset default configs for rapid setup
const DEFAULT_PRESETS: QFieldFieldConfig[] = [
  { layerId: "SLT_Poles", fieldName: "Exist_New", options: ["Existing", "New", "Relocated"] },
  { layerId: "SLT_Poles", fieldName: "POLE TYPE", options: ["Concrete", "GI", "Spun", "Wood"] },
  { layerId: "SLT_Poles", fieldName: "POLE HEIGHT", options: ["7.5m", "8.0m", "9.0m", "10.0m"] },
  { layerId: "SLT_Cables", fieldName: "Cable_Type", options: ["12F SM", "24F SM", "48F SM", "96F SM", "144F SM"] },
  { layerId: "SLT_FJ", fieldName: "Exst_New", options: ["Existing", "New"] },
  { layerId: "SLT_FJ", fieldName: "TYPE", options: ["Splice Joint", "T-Joint", "Branch Joint"] },
  { layerId: "SLT_FDP", fieldName: "Exst_New", options: ["Existing", "New"] },
  { layerId: "SLT_FDP", fieldName: "TYPE", options: ["Wall Mount", "Pole Mount", "Pedestal"] },
  { layerId: "SLT_FDP", fieldName: "SPLITTER TYPE", options: ["1:2", "1:4", "1:8", "1:16", "1:32"] },
  { layerId: "SLT_Ducts", fieldName: "TYPE", options: ["PVC", "PE", "GI"] },
  { layerId: "SLT_Ducts", fieldName: "PROTECTION", options: ["Concrete Slab", "Warning Tape", "None"] },
  { layerId: "SLT_Ducts", fieldName: "DAMAGE", options: ["None", "Minor Scratch", "Cracked", "Blocked"] },
  { layerId: "SLT_FTC", fieldName: "Exst_New", options: ["Existing", "New"] },
  { layerId: "SLT_FTC", fieldName: "TYPE", options: ["Primary Cabinet", "Secondary Cabinet"] },
  { layerId: "SLT_FTC", fieldName: "CAPACITY", options: ["144F", "288F", "576F"] },
  { layerId: "SLT_HH", fieldName: "Exist_New", options: ["Existing", "New"] },
  { layerId: "SLT_HH", fieldName: "SUB TYPE", options: ["Type A", "Type B", "Type C"] },
  { layerId: "SLT_HH", fieldName: "FRAME AND COVER STATUS", options: ["Good", "Broken", "Missing", "Needs Replacement"] },
  { layerId: "SLT_MH", fieldName: "Exst_New", options: ["Existing", "New"] },
  { layerId: "SLT_MH", fieldName: "SUB TYPE", options: ["Type 1", "Type 2", "Type 3", "Type 4"] },
  { layerId: "SLT_MH", fieldName: "FRAME AND COVER STATUS", options: ["Good", "Broken", "Missing", "Needs Replacement"] },
  { layerId: "SLT_ODF", fieldName: "Exst_New", options: ["Existing", "New"] },
  { layerId: "SLT_ODF", fieldName: "MODEL", options: ["Rackmount 24F", "Rackmount 48F", "Rackmount 96F", "Wallmount 12F"] },
  { layerId: "SLT_TP", fieldName: "Existing_New", options: ["Existing", "New"] },
  { layerId: "SLT_TP", fieldName: "CUSTOMER TYPE", options: ["Retail", "Enterprise", "LTE Tower", "FTTH Distribution"] }
];

export default function QFieldConfigForm({ projectId, projectCode, projectName }: QFieldConfigFormProps) {
  const router = useRouter();
  const [configs, setConfigs] = useState<QFieldFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states for adding a new configuration row
  const [selectedLayer, setSelectedLayer] = useState<string>("SLT_Poles");
  const [selectedField, setSelectedField] = useState<string>("");
  const [customField, setCustomField] = useState<string>("");
  const [newOptionVal, setNewOptionVal] = useState<string>("");

  useEffect(() => {
    async function fetchConfigs() {
      try {
        const res = await fetch(`/api/projects/${projectId}/qfield-config`, {
          headers: { 'x-user-id': 'system' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.configs && data.configs.length > 0) {
            setConfigs(data.configs);
          } else {
            setConfigs(DEFAULT_PRESETS);
          }
        } else {
          toast.error("Failed to load existing configurations.");
        }
      } catch (err) {
        console.error(err);
        toast.error("An error occurred while loading configurations.");
      } finally {
        setLoading(false);
      }
    }
    fetchConfigs();
  }, [projectId]);

  // Set default field name when layer changes
  useEffect(() => {
    const fields = LAYER_FIELDS_MAP[selectedLayer]?.fields || [];
    if (fields.length > 0) {
      setSelectedField(fields[0]);
    } else {
      setSelectedField("");
    }
  }, [selectedLayer]);

  const handleAddConfig = () => {
    const fieldName = selectedField === "CUSTOM" ? customField.trim() : selectedField;
    if (!fieldName) {
      toast.error("Please enter or select a field name");
      return;
    }

    // Check if configuration already exists
    const duplicate = configs.find(
      (c) => c.layerId === selectedLayer && c.fieldName.toLowerCase() === fieldName.toLowerCase()
    );
    if (duplicate) {
      toast.error(`Configuration already exists for layer '${selectedLayer}' field '${fieldName}'`);
      return;
    }

    const newConfig: QFieldFieldConfig = {
      layerId: selectedLayer,
      fieldName: fieldName,
      options: []
    };

    setConfigs([...configs, newConfig]);
    if (selectedField === "CUSTOM") {
      setCustomField("");
    }
    toast.success(`Added row for ${selectedLayer} -> ${fieldName}`);
  };

  const handleRemoveConfig = (index: number) => {
    const updated = [...configs];
    updated.splice(index, 1);
    setConfigs(updated);
  };

  const handleAddOption = (configIndex: number, optionText: string) => {
    const trimmed = optionText.trim();
    if (!trimmed) return;

    const updated = [...configs];
    if (updated[configIndex].options.includes(trimmed)) {
      toast.error("Option already exists");
      return;
    }

    updated[configIndex].options.push(trimmed);
    setConfigs(updated);
  };

  const handleRemoveOption = (configIndex: number, optionIndex: number) => {
    const updated = [...configs];
    updated[configIndex].options.splice(optionIndex, 1);
    setConfigs(updated);
  };

  const handleLoadPresets = () => {
    // Add presets that are not already present
    const updated = [...configs];
    let addedCount = 0;

    for (const preset of DEFAULT_PRESETS) {
      const exists = updated.find(
        (c) => c.layerId === preset.layerId && c.fieldName.toLowerCase() === preset.fieldName.toLowerCase()
      );
      if (!exists) {
        updated.push({ ...preset });
        addedCount++;
      }
    }

    setConfigs(updated);
    toast.success(`Loaded ${addedCount} standard presets successfully!`);
  };

  const handleClearAll = () => {
    setConfigs([]);
    toast.info("Cleared all configurations.");
  };

  const handleSaveConfigs = async () => {
    // Basic validation
    const emptyConfigs = configs.filter((c) => c.options.length === 0);
    if (emptyConfigs.length > 0) {
      toast.warning("Some configurations do not have any options configured. They will be ignored.");
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/qfield-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'system'
        },
        body: JSON.stringify({ configs })
      });

      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
        toast.success("Dropdown configurations saved successfully!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save configurations");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to make request to server");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const fields = LAYER_FIELDS_MAP[selectedLayer]?.fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Project
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">QField Dropdown Configurator</h2>
            <p className="text-xs text-slate-500">
              {projectCode} — {projectName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLoadPresets} className="gap-1 bg-white">
            <RotateCcw className="w-3.5 h-3.5" />
            Load Presets
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} className="text-red-600 hover:bg-red-50 gap-1 bg-white">
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </Button>
          <Button size="sm" onClick={handleSaveConfigs} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Configs"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <Card className="lg:col-span-1 border-indigo-100 bg-indigo-50/10">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-indigo-900">
              <Settings className="w-4 h-4" />
              Configure Dropdown Widget
            </CardTitle>
            <CardDescription className="text-xs">
              Add a new dynamic drop-down select list (Value Map) to a target layer field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Target Layer</Label>
              <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LAYER_FIELDS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Layer Field Name</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                  <SelectItem value="CUSTOM">+ Custom Field Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedField === "CUSTOM" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Enter Custom Field Name</Label>
                <Input
                  value={customField}
                  onChange={(e) => setCustomField(e.target.value)}
                  placeholder="e.g. POLE COND"
                  className="bg-white uppercase"
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button onClick={handleAddConfig} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Field Row
            </Button>
          </CardFooter>
        </Card>

        {/* Configurations List */}
        <div className="lg:col-span-2 space-y-4">
          {configs.length === 0 ? (
            <Card className="border-dashed border-slate-300 py-16 text-center">
              <CardContent className="flex flex-col items-center gap-3 text-slate-400">
                <Layers className="w-10 h-10 text-slate-300" />
                <p className="font-medium text-sm">No fields configured yet</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click &ldquo;Load Presets&rdquo; above to populate the standard configurations, or select a layer and field to add custom lists.
                </p>
              </CardContent>
            </Card>
          ) : (
            configs.map((config, idx) => (
              <Card key={`${config.layerId}-${config.fieldName}`} className="hover:border-indigo-200 transition-all">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Badge className="bg-indigo-100 text-indigo-800 font-mono py-0">{config.layerId}</Badge>
                      <span className="text-slate-400">/</span>
                      <span className="font-semibold text-slate-700">{config.fieldName}</span>
                    </CardTitle>
                    <CardDescription className="text-[11px] mt-0.5 text-slate-500">
                      Creates a dynamic &ldquo;Value Map&rdquo; widget in QGIS containing options below.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConfig(idx)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 rounded border border-slate-100">
                    {config.options.length === 0 ? (
                      <span className="text-xs text-slate-400 italic self-center">No options defined. Add options below.</span>
                    ) : (
                      config.options.map((opt, optIdx) => (
                        <Badge key={optIdx} variant="secondary" className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 gap-1 flex items-center pr-1 h-6">
                          {opt}
                          <button
                            onClick={() => handleRemoveOption(idx, optIdx)}
                            className="text-slate-400 hover:text-red-500 font-bold px-0.5"
                          >
                            &times;
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      id={`new-opt-input-${idx}`}
                      placeholder="Add option and press Add or Enter"
                      className="h-8 text-xs bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          handleAddOption(idx, input.value);
                          input.value = "";
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 bg-white text-xs gap-1"
                      onClick={() => {
                        const input = document.getElementById(`new-opt-input-${idx}`) as HTMLInputElement;
                        if (input) {
                          handleAddOption(idx, input.value);
                          input.value = "";
                        }
                      }}
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
