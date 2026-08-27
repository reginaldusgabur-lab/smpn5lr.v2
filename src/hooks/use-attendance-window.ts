'use client';

import { useEffect, useState } from "react";
import { useCache } from "@/context/CacheContext";
import { format } from "date-fns";

/**
 * Hook useAttendanceWindow menggunakan data dari CacheContext.
 * Kini menyertakan validasi hari libur kalender (monthlyConfig).
 */

export interface SchoolConfig {
  isAttendanceActive?: boolean;
  useTimeValidation?: boolean;
  checkInStartTime?: string;
  checkInEndTime?: string;
  checkOutStartTime?: string;
  checkOutEndTime?: string;
  dailyCheckOutTimes?: Record<string, { start: string, end: string }>;
  offDays?: number[];
}

export type AttendanceWindowStatus =
  | "LOADING"          // Keadaan awal
  | "DISABLED"         // Dinonaktifkan secara manual oleh Admin
  | "SESSION_INACTIVE" // Hari libur terjadwal (rutin atau kalender)
  | "BEFORE_IN"        // Belum jam masuk
  | "CHECK_IN_OPEN"    // Jendela masuk terbuka
  | "AFTER_IN"         // Batas jam masuk berakhir
  | "CHECK_OUT_OPEN"   // Jendela pulang terbuka
  | "CLOSED";          // Sesi hari ini berakhir

export const useAttendanceWindow = () => {
  const { schoolConfig: config, monthlyConfig: mConfig, isCacheLoading: configLoading } = useCache();
  const [status, setStatus] = useState<AttendanceWindowStatus>("LOADING");

  useEffect(() => {
    if (configLoading) {
      setStatus("LOADING");
      return;
    }

    if (!config) {
      setStatus("LOADING");
      return;
    }

    // PRIORITAS 1: Cek apakah dinonaktifkan manual oleh Admin
    if (config.isAttendanceActive === false) {
      setStatus("DISABLED"); 
      return;
    }

    const checkStatus = () => {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        const todayStr = format(now, 'yyyy-MM-dd');
        
        // PRIORITAS 2: Cek hari libur rutin DAN kalender
        const offDays = (config as any).offDays ?? [0, 6];
        const isSpecificHoliday = (mConfig as any)?.holidays?.includes(todayStr);

        if (offDays.includes(dayOfWeek) || isSpecificHoliday) {
            setStatus("SESSION_INACTIVE");
            return;
        }

        if (config.useTimeValidation === false) {
            setStatus("CHECK_IN_OPEN");
            return;
        }

        const parseToMinutes = (timeStr: string) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const inStart = parseToMinutes(config.checkInStartTime || "00:00");
        const inEnd = parseToMinutes(config.checkInEndTime || "23:59");
        
        const dailyOut = (config as any).dailyCheckOutTimes?.[dayOfWeek.toString()];
        const outStart = parseToMinutes(dailyOut?.start || config.checkOutStartTime || "14:00");
        const outEnd = parseToMinutes(dailyOut?.end || config.checkOutEndTime || "16:00");

        if (currentTime < inStart) {
            setStatus("BEFORE_IN");
        } else if (currentTime >= inStart && currentTime <= inEnd) {
            setStatus("CHECK_IN_OPEN");
        } else if (currentTime > inEnd && currentTime < outStart) {
            setStatus("AFTER_IN");
        } else if (currentTime >= outStart && currentTime <= outEnd) {
            setStatus("CHECK_OUT_OPEN");
        } else {
            setStatus("CLOSED");
        }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 30000); 

    return () => clearInterval(intervalId);
    
  }, [config, mConfig, configLoading]);

  return { status, config: config as SchoolConfig | null, monthlyConfig: mConfig };
};
