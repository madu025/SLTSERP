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

        // IMPROVED: Remove all spaces for matching to handle '90 301 391 5V' cases
        const compactText = nicFriendlyText.replace(/\s/g, '');
        console.log(`[OCR-COMPACT] Searching in:`, compactText);

        // Pattern for 9 digits followed by V or X
        const oldNicMatch = compactText.match(/\d{9}[vVxX]/);
        
        // Pattern for 12 digits
        const newNicMatch = compactText.match(/\d{12}/);
        
        if (oldNicMatch) {
          extractedValue = oldNicMatch[0].toUpperCase();
        } else if (newNicMatch) {
          extractedValue = newNicMatch[0];
        }
      } else if (fieldName.toLowerCase().includes('account') || fieldName.toLowerCase().includes('bank')) {
        // Match standard bank account number patterns (8-16 digits)
        const accMatch = cleanText.replace(/\s/g, '').match(/\d{8,16}/);
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
