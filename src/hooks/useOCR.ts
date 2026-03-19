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
      
      // Clean text from common OCR noise and normalize
      const cleanText = text.replace(/[|[\](){}]/g, '').replace(/\s+/g, ' ');
      console.log(`[OCR-CLEAN] Result for ${fieldName}:`, cleanText);
      
      let extractedValue = "";
      
      if (fieldName.toLowerCase().includes('nic') || fieldName.toLowerCase().includes('identity')) {
        // For NICs, handle common character misreads (I/l/| -> 1, O -> 0)
        const nicFriendlyText = cleanText
          .replace(/\|/g, '1')
          .replace(/[Il]/g, '1')
          .replace(/[O]/g, '0');

        // Match Sri Lankan NIC patterns directly from normalized text with word boundaries
        // Old: 9 digits + V/X
        const oldNicMatch = nicFriendlyText.match(/\b\d{9}[vVxX]\b/i);
        
        // New: Exactly 12 digits (usually starting with 19 or 20)
        const all12DigitGroups = nicFriendlyText.match(/\b\d{12}\b/g) || [];
        
        // Prefer matches starting with birth year patterns (19/20)
        const birthYearNic = all12DigitGroups.find(num => num.startsWith('19') || num.startsWith('20'));
        const newNicValue = birthYearNic || all12DigitGroups[0];
        
        if (oldNicMatch) {
          extractedValue = oldNicMatch[0].toUpperCase();
        } else if (newNicValue) {
          extractedValue = newNicValue;
        }
      } else if (fieldName.toLowerCase().includes('account') || fieldName.toLowerCase().includes('bank')) {
        // Match standard bank account number patterns (8-16 digits)
        const accMatch = cleanText.match(/\b\d{8,16}\b/);
        extractedValue = accMatch ? accMatch[0] : "";
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
