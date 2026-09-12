'use client';

import { useEffect, useState, useRef } from "react";
import { useCache } from "@/context/CacheContext";
import { format } from "date-fns";

/**
 * Hook useAttendanceWindow versi Sesi Ganda yang stabil.
 */

export interface SchoolConfig {
  isAttendanceActive?: boolean;
  useTimeValidation?: boolean;
  checkInStartTime?: string;
  checkInEndTime?: string;
  checkOutStartTime?: string;
  checkOutEndTime?: string;
  s2CheckInStartTime?: string;
  s2CheckInEndTime?: string;
  s2CheckOutStartTime?: string;
  s2CheckOutEndTime?: string;
  dailyCheckOutTimes?: Record<string, { start: string, end: string }>;
  offDays?: number[];
  qrCodeValue?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export type SessionStatus = "BEFORE" | "IN_OPEN" | "IN_CLOSED" | "OUT_OPEN" | "CLOSED";

export interface AttendanceStatus {
    status: "LOADING" | "DISABLED" | "SESSION_INACTIVE" | "ACTIVE";
    activeSession: 1 | 2 | null;
    s1Status: SessionStatus;
    s2Status: SessionStatus;
    config: SchoolConfig | null;
}

export const useAttendanceWindow = (): AttendanceStatus => {
  const { schoolConfig: config, monthlyConfig: mConfig, isCacheLoading: configLoading } = useCache();
  const [state, setState] = useState<AttendanceStatus>({
    status: "LOADING",
    activeSession: null,
    s1Status: "BEFORE",
    s2Status: "BEFORE",
    config: null
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (configLoading || !config) return;

    if (config.isAttendanceActive === false) {
      if (stateRef.current.status !== "DISABLED") {
        setState(prev => ({ ...prev, status: "DISABLED", config: config as SchoolConfig }));
      }
      return;
    }

    const checkStatus = () => {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        const todayStr = format(now, 'yyyy-MM-dd');
        
        const offDays = (config as any).offDays ?? [0, 6];
        const isSpecificHoliday = (mConfig as any)?.holidays?.includes(todayStr);

        if (offDays.includes(dayOfWeek) || isSpecificHoliday) {
            if (stateRef.current.status !== "SESSION_INACTIVE") {
                setState(prev => ({ ...prev, status: "SESSION_INACTIVE", config: config as SchoolConfig }));
            }
            return;
        }

        const parseToMinutes = (timeStr: string | undefined) => {
            if (!timeStr) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const s1InStart = parseToMinutes(config.checkInStartTime) ?? 360;
        const s1InEnd = parseToMinutes(config.checkInEndTime) ?? 480;
        const s1OutStart = parseToMinutes(config.checkOutStartTime) ?? 720;
        const s1OutEnd = parseToMinutes(config.checkOutEndTime) ?? 810;

        let s1Status: SessionStatus = "BEFORE";
        if (currentTime >= s1InStart && currentTime <= s1InEnd) s1Status = "IN_OPEN";
        else if (currentTime > s1InEnd && currentTime < s1OutStart) s1Status = "IN_CLOSED";
        else if (currentTime >= s1OutStart && currentTime <= s1OutEnd) s1Status = "OUT_OPEN";
        else if (currentTime > s1OutEnd) s1Status = "CLOSED";

        const s2InStart = parseToMinutes(config.s2CheckInStartTime) ?? 780;
        const s2InEnd = parseToMinutes(config.s2CheckInEndTime) ?? 840;
        const s2OutStart = parseToMinutes(config.s2CheckOutStartTime) ?? 900;
        const s2OutEnd = parseToMinutes(config.s2CheckOutEndTime) ?? 1020;

        let s2Status: SessionStatus = "BEFORE";
        if (currentTime >= s2InStart && currentTime <= s2InEnd) s2Status = "IN_OPEN";
        else if (currentTime > s2InEnd && currentTime < s2OutStart) s2Status = "IN_CLOSED";
        else if (currentTime >= s2OutStart && currentTime <= s2OutEnd) s2Status = "OUT_OPEN";
        else if (currentTime > s2OutEnd) s2Status = "CLOSED";

        const activeSession = currentTime >= s2InStart ? 2 : 1;

        if (
            stateRef.current.status !== "ACTIVE" ||
            stateRef.current.activeSession !== activeSession ||
            stateRef.current.s1Status !== s1Status ||
            stateRef.current.s2Status !== s2Status
        ) {
            setState({
                status: "ACTIVE",
                activeSession,
                s1Status,
                s2Status,
                config: config as SchoolConfig
            });
        }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 15000); 
    return () => clearInterval(intervalId);
    
  }, [config, mConfig, configLoading]);

  return state;
};
