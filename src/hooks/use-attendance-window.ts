'use client';

import { useEffect, useState } from "react";
import { useCache } from "@/context/CacheContext";
import { format } from "date-fns";

/**
 * Hook useAttendanceWindow menggunakan data dari CacheContext.
 * Mengelola status jendela absensi harian tunggal.
 */

export interface SchoolConfig {
  isAttendanceActive?: boolean;
  useTimeValidation?: boolean;
  checkInStartTime?: string;
  checkInEndTime?: string;
  lateLimitMinutes?: number; // Menggunakan durasi menit
  checkOutStartTime?: string;
  checkOutEndTime?: string;
  dailyCheckOutTimes?: Record<string, { start: string, end: string }>;
  offDays?: number[];
  qrCodeValue?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export type AttendanceWindowStatus =
  | "LOADING"          // Keadaan awal
  | "DISABLED"         // Dinonaktifkan secara manual oleh Admin
  | "SESSION_INACTIVE" // Hari libur terjadwal (rutin atau kalender)
  | "BEFORE_IN"        // Belum jam masuk
  | "CHECK_IN_OPEN"    // Jendela masuk terbuka (termasuk masa terlambat)
  | "AFTER_IN"         // Batas jam masuk berakhir (menunggu jam pulang)
  | "CHECK_OUT_OPEN"   // Jendela pulang terbuka
  | "CLOSED";          // Sesi hari ini berakhir

export const useAttendanceWindow = () => {
  const { schoolConfig: config, monthlyConfig: mConfig, isCacheLoading: configLoading } = useCache();
  const [status, setStatus] = useState<AttendanceWindowStatus>("LOADING");
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (configLoading || !config) {
      setStatus("LOADING");
      return;
    }

    // 1. Cek apakah dinonaktifkan manual oleh Admin
    if (config.isAttendanceActive === false) {
      setStatus("DISABLED"); 
      return;
    }

    const checkStatus = () => {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        const todayStr = format(now, 'yyyy-MM-dd');
        
        // 2. Cek hari libur rutin DAN kalender
        const offDays = (config as any).offDays ?? [0, 6];
        const isSpecificHoliday = (mConfig as any)?.holidays?.includes(todayStr);

        if (offDays.includes(dayOfWeek) || isSpecificHoliday) {
            setStatus("SESSION_INACTIVE");
            return;
        }

        // 3. Jika validasi waktu dimatikan (mode bebas)
        if (config.useTimeValidation === false) {
            setStatus("CHECK_IN_OPEN");
            setIsLate(false);
            return;
        }

        const parseToMinutes = (timeStr: string) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const inStart = parseToMinutes(config.checkInStartTime || "06:00");
        const inEndNormal = parseToMinutes(config.checkInEndTime || "07:30");
        
        // Perhitungan Batas Terlambat: Batas Masuk + Toleransi Menit
        const lateTolerance = (config as any).lateLimitMinutes || 0;
        const inEndLate = inEndNormal + Number(lateTolerance);
        
        // Dapatkan jadwal pulang dinamis sesuai hari
        const dailyOut = (config as any).dailyCheckOutTimes?.[dayOfWeek.toString()];
        const outStart = parseToMinutes(dailyOut?.start || config.checkOutStartTime || "14:00");
        const outEnd = parseToMinutes(dailyOut?.end || config.checkOutEndTime || "16:00");

        if (currentTime < inStart) {
            setStatus("BEFORE_IN");
            setIsLate(false);
        } else if (currentTime >= inStart && currentTime <= inEndLate) {
            setStatus("CHECK_IN_OPEN");
            setIsLate(currentTime > inEndNormal);
        } else if (currentTime > inEndLate && currentTime < outStart) {
            setStatus("AFTER_IN");
            setIsLate(false);
        } else if (currentTime >= outStart && currentTime <= outEnd) {
            setStatus("CHECK_OUT_OPEN");
            setIsLate(false);
        } else {
            setStatus("CLOSED");
            setIsLate(false);
        }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 30000); 

    return () => clearInterval(intervalId);
    
  }, [config, mConfig, configLoading]);

  return { status, config: config as SchoolConfig | null, monthlyConfig: mConfig, isLate };
};
