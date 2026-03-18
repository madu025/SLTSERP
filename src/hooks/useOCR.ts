"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { toast } from "sonner";

export function useOCR() {
  const [isScanning, setIsScanning] = useState(false);

  const scanImage = async (imageUrl: string, fieldName: string) => {
    setIsScanning(true);
    const toastId = toast.loading(`Scanning ${fieldName} for data...`);
    
    try {
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(imageUrl);
      
      console.log(`[OCR-SCAN] Result for ${fieldName}:`, text);
      
      // Basic extraction pattern for NIC or specific fields
      let extractedValue = "";
      
      if (fieldName.toLowerCase().includes('nic')) {
        // Match Sri Lankan NIC patterns (old: 9 digits + V/X, new: 12 digits)
        const oldNicMatch = text.match(/\b\d{9}[vVxX]\b/);
        const newNicMatch = text.match(/\b\d{12}\b/);
        extractedValue = oldNicMatch ? oldNicMatch[0] : (newNicMatch ? newNicMatch[0] : "");
      }
      
      await worker.terminate();
      
      if (extractedValue) {
        toast.success(`Automatically detected ${fieldName}: ${extractedValue}`, { id: toastId });
        return extractedValue;
      } else {
        toast.info("Could not clearly auto-detect data. Please check and enter manually.", { id: toastId });
        return null;
      }
    } catch (error) {
      console.error("[OCR-ERROR]", error);
      toast.error("OCR scan failed. Please enter data manually.", { id: toastId });
      return null;
    } finally {
      setIsScanning(false);
    }
  };

  return { scanImage, isScanning };
}
