"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { toast } from "sonner";

export function useOCR() {
  const [isScanning, setIsScanning] = useState(false);

  const scanImage = async (imageUrl: string, fieldName: string) => {
    setIsScanning(true);
    const toastId = toast.loading(`OCR: Extracting data from ${fieldName.replace('Url', '')}...`);
    
    // Ensure absolute URL for worker to fetch image correctly
    const absoluteUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${window.location.origin}${imageUrl}`;

    let worker;

    try {
      console.log(`[OCR-START] Processing: ${fieldName} | URL: ${absoluteUrl}`);
      
      // Controlled worker lifecycle for maximum reliability across environments
      worker = await createWorker('eng');
      
      const { data: { text } } = await worker.recognize(absoluteUrl);
      console.log(`[OCR-RAW] Text Found:`, text);

      // Clean text: Remove brackets, pipe characters and collapse whitespace
      const cleanText = text.replace(/[|[\](){}]/g, '').replace(/\s+/g, ' ');
      let extractedValue = "";
      
      const isNicField = fieldName.toLowerCase().includes('nic') || fieldName.toLowerCase().includes('identity');
      const isBankField = fieldName.toLowerCase().includes('account') || fieldName.toLowerCase().includes('bank');

      if (isNicField) {
        // Fix common OCR misreads in numeric strings
        const nicFriendlyText = cleanText
          .replace(/\|/g, '1')
          .replace(/[Il]/g, '1')
          .replace(/[O]/g, '0');

        const compactText = nicFriendlyText.replace(/\s/g, '');
        console.log(`[OCR-NIC-SEARCH] Digits Only:`, compactText);

        const oldNicMatch = compactText.match(/\d{9}[vVxX]/i);
        const newNicMatch = compactText.match(/\d{12}/);
        
        if (oldNicMatch) {
          extractedValue = oldNicMatch[0].toUpperCase();
        } else if (newNicMatch) {
          extractedValue = newNicMatch[0];
        }
      } else if (isBankField) {
        // Look for account number (8-16 digits)
        const compactText = cleanText.replace(/\s/g, '');
        const accMatch = compactText.match(/\d{8,16}/);
        extractedValue = accMatch ? accMatch[0] : "";
      }
      
      if (extractedValue) {
        console.log(`[OCR-SUCCESS] Value: ${extractedValue}`);
        toast.success(`OCR Detect: ${extractedValue}`, { id: toastId });
        return extractedValue;
      } else {
        console.warn(`[OCR-EMPTY] No data detected`);
        toast.info("OCR: No clear data found. Please enter manually.", { id: toastId });
        return null;
      }
    } catch (error) {
      console.error("[OCR-CRITICAL-ERROR]", error);
      toast.error("OCR Engine Error. Please input manually.", { id: toastId });
      return null;
    } finally {
      if (worker) {
        await worker.terminate().catch(e => console.error("Worker termination failed", e));
      }
      setIsScanning(false);
    }
  };

  return { scanImage, isScanning };
}
