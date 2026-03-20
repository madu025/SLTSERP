"use client";

import { useState } from "react";
import Tesseract from "tesseract.js";
import { toast } from "sonner";

export function useOCR() {
  const [isScanning, setIsScanning] = useState(false);

  const scanImage = async (imageUrl: string, fieldName: string) => {
    setIsScanning(true);
    const toastId = toast.loading(`OCR: Reading ${fieldName.replace('Url', '')}...`);
    
    try {
      console.log(`[OCR-START] Processing: ${fieldName}`);
      
      // Use the simpler recognize method for better reliability in v7
      const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                console.log(`[OCR-PROGRESS] ${Math.round(m.progress * 100)}%`);
            }
        }
      });
      
      console.log(`[OCR-RAW] Result:`, text);

      // Clean text from common OCR noise and normalize
      const cleanText = text.replace(/[|[\](){}]/g, '').replace(/\s+/g, ' ');
      let extractedValue = "";
      
      const isNicField = fieldName.toLowerCase().includes('nic') || fieldName.toLowerCase().includes('identity');
      const isBankField = fieldName.toLowerCase().includes('account') || fieldName.toLowerCase().includes('bank');

      if (isNicField) {
        // Handle common character misreads (I/l/| -> 1, O -> 0)
        const nicFriendlyText = cleanText
          .replace(/\|/g, '1')
          .replace(/[Il]/g, '1')
          .replace(/[O]/g, '0');

        const compactText = nicFriendlyText.replace(/\s/g, '');
        console.log(`[OCR-NIC-SEARCH] Checking:`, compactText);

        // Pattern for 9 digits followed by V or X
        const oldNicMatch = compactText.match(/\d{9}[vVxX]/i);
        // Pattern for 12 digits
        const newNicMatch = compactText.match(/\d{12}/);
        
        if (oldNicMatch) {
          extractedValue = oldNicMatch[0].toUpperCase();
        } else if (newNicMatch) {
          extractedValue = newNicMatch[0];
        }
      } else if (isBankField) {
        // Match standard bank account number patterns (8-16 digits)
        const accMatch = cleanText.replace(/\s/g, '').match(/\d{8,16}/);
        extractedValue = accMatch ? accMatch[0] : "";
      }
      
      if (extractedValue) {
        console.log(`[OCR-SUCCESS] Extracted ${fieldName}: ${extractedValue}`);
        toast.success(`OCR: ${fieldName.replace('Url', '')} detected: ${extractedValue}`, { id: toastId });
        return extractedValue;
      } else {
        console.log(`[OCR-FAIL] No match found in text`);
        toast.info("OCR: Could not clearly detect data. Please verify manually.", { id: toastId });
        return null;
      }
    } catch (error) {
      console.error("[OCR-ERROR]", error);
      toast.error("OCR scan failed. Technical error.", { id: toastId });
      return null;
    } finally {
      setIsScanning(false);
    }
  };

  return { scanImage, isScanning };
}
