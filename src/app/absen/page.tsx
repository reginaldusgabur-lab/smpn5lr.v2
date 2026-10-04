'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, CameraOff, CalendarOff, MapPin, Clock as ClockIcon, CheckCircle, Lock, FileText, Sparkles } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, isWithinInterval, setHours, setMinutes } from 'date-fns';
import QuoteOfTheDay from '@/components/layout/quote-of-the-day';
import { useAttendanceWindow } from '@/hooks/use-attendance-window';
import { invalidateCache } from '@/lib/cache';

// --- Helper Functions ---
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

const getCurrentPosition = (options?: PositionOptions): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

/**
 * Menghasilkan konfirmasi audio dan getaran.
 */
const playSuccessFeedback = async (customAudioBase64?: string) => {
    try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]); 
        }

        if (customAudioBase64 && customAudioBase64.length > 100) {
            const audio = new Audio(customAudioBase64);
            await audio.play();
        } else {
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const context = new AudioContextClass();
            if (context.state === 'suspended') {
                await context.resume();
            }

            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1900, context.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(1400, context.currentTime + 0.6);

            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(0.4, context.currentTime + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.8);
            
            setTimeout(() => context.close(), 1000);
        }
    } catch (e) {
        console.warn("Feedback failed", e);
    }
};

type FeedbackStatus = 'idle' | 'processing' | 'locating' | 'success_in' | 'success_in_late' | 'success_out' | 'error_radius' | 'error_time' | 'error_checkin_closed' | 'error_already_in' | 'error_already_out' | 'error_generic' | 'error_location' | 'info_holiday' | 'info_checked_out' | 'info_no_camera' | 'info_disabled' | 'info_leave';

export default function AbsenPage() {
  const [status, setStatus] = useState<FeedbackStatus>('idle');
  const statusRef = useRef<FeedbackStatus>('idle');
  useEffect(() => { statusRef.current = status; }, [status]);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { status: windowStatus, config: schoolConfig } = useAttendanceWindow();
  
  const [isScannerReady, setIsScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-fullscreen-v3";

  // Hydration safety
  useEffect(() => {
    setIsClient(true);
  }, []);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userData } = useDoc(user, userDocRef);
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysAttendanceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr));
  }, [user?.uid, firestore, todayStr]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);
  
  const todaysRecord = useMemo(() => {
      if (!todaysAttendance || todaysAttendance.length === 0) return null;
      const recordWithCheckIn = todaysAttendance.find(a => !!a.checkInTime);
      return recordWithCheckIn || todaysAttendance[0];
  }, [todaysAttendance]);

  const activeLeavesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'leaveRequests'), where('status', '==', 'approved'));
  }, [user?.uid, firestore]);
  const { data: activeLeaves, isLoading: isLeaveLoading } = useCollection(user, activeLeavesQuery);

  const currentActiveLeave = useMemo(() => {
      if (!activeLeaves || !isClient) return null;
      const now = new Date();
      return activeLeaves.find(l => isWithinInterval(now, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) }));
  }, [activeLeaves, isClient]);

  const isDataLoading = !isClient || isAttendanceLoading || isLeaveLoading || windowStatus === 'LOADING';
  const isHoliday = windowStatus === 'SESSION_INACTIVE';
  const isManualDisabled = windowStatus === 'DISABLED';
  const hasCompletedAttendance = useMemo(() => !!(todaysRecord?.checkInTime && todaysRecord?.checkOutTime), [todaysRecord]);

  const effectiveStatus: FeedbackStatus = useMemo(() => {
      if (status !== 'idle') return status;
      if (isDataLoading) return 'idle';
      if (currentActiveLeave) return 'info_leave';
      if (hasCompletedAttendance) return 'info_checked_out';
      if (isManualDisabled) return 'info_disabled';
      if (isHoliday) return 'info_holiday';
      if (windowStatus === 'AFTER_IN') return 'error_checkin_closed';
      if (windowStatus === 'BEFORE_IN' || windowStatus === 'CLOSED') return 'error_time';
      if (cameraError) return 'info_no_camera';
      return 'idle';
  }, [status, isDataLoading, currentActiveLeave, hasCompletedAttendance, isHoliday, isManualDisabled, windowStatus, cameraError]);

  const showScanner = isClient && !isDataLoading && !isHoliday && !isManualDisabled && !hasCompletedAttendance && !currentActiveLeave && (windowStatus === 'CHECK_IN_OPEN' || windowStatus === 'CHECK_OUT_OPEN');

  const handleAttendance = useCallback(async () => {
    if (statusRef.current !== 'idle' && statusRef.current !== 'processing') return;
    setLocationError(null);
    if (!user || !firestore || !schoolConfig) {
        return;
    }
    
    setStatus('processing');
    try {
        let latitude: number | null = null, longitude: number | null = null;
        if (schoolConfig.useLocationValidation) {
            setStatus('locating');
            try {
                const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                latitude = pos.coords.latitude; longitude = pos.coords.longitude;
                if (schoolConfig.radius && schoolConfig.latitude && schoolConfig.longitude) {
                    if (getDistance(latitude, longitude, schoolConfig.latitude, schoolConfig.longitude) > schoolConfig.radius) {
                        setStatus('error_radius');
                        return;
                    }
                }
            } catch (error: any) {
                setStatus('error_location');
                return;
            }
        }

        const now = new Date();
        const tDateStr = format(now, 'yyyy-MM-dd');

        if (windowStatus === 'CHECK_IN_OPEN') {
            if (todaysRecord?.checkInTime) return setStatus('error_already_in');
            
            let isLate = false;
            if (schoolConfig.useTimeValidation && schoolConfig.checkInEndTime) {
                const [h, m] = schoolConfig.checkInEndTime.split(':').map(Number);
                const deadline = setMinutes(setHours(startOfDay(now), h), m);
                if (now > deadline) isLate = true;
            }

            const attendanceData = { 
                date: tDateStr, 
                checkInTime: now, 
                checkInLatitude: latitude, 
                checkInLongitude: longitude,
                reasonForUpdate: isLate ? 'Terlambat' : 'Kehadiran penuh'
            };

            if (todaysRecord) {
                await updateDoc(doc(firestore, 'users', user.uid, 'attendanceRecords', todaysRecord.id), attendanceData);
            } else {
                await addDoc(collection(firestore, 'users', user.uid, 'attendanceRecords'), { 
                    userId: user.uid, 
                    ...attendanceData,
                    checkOutTime: null 
                });
            }
            invalidateCache();
            await playSuccessFeedback((schoolConfig as any).successSoundUrl);
            setStatus(isLate ? 'success_in_late' : 'success_in');
        } else if (windowStatus === 'CHECK_OUT_OPEN') {
            if (todaysRecord?.checkOutTime) return setStatus('error_already_out');
            if (!todaysRecord) {
                 await addDoc(collection(firestore, 'users', user.uid, 'attendanceRecords'), { userId: user.uid, date: tDateStr, checkInTime: null, checkOutTime: now, checkOutLatitude: latitude, checkOutLongitude: longitude, reasonForUpdate: 'Absen pulang (Tanpa masuk)' });
            } else {
                await updateDoc(doc(firestore, 'users', user.uid, 'attendanceRecords', todaysRecord.id), { checkOutTime: now, checkOutLatitude: latitude, checkOutLongitude: longitude });
            }
            invalidateCache();
            await playSuccessFeedback((schoolConfig as any).successSoundUrl);
            setStatus('success_out');
        }
    } catch (error) {
        setStatus('error_generic');
    }
}, [user, firestore, schoolConfig, todaysRecord, windowStatus]);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (statusRef.current === 'idle' && decodedText === schoolConfig?.qrCodeValue) {
        handleAttendance();
    } else if (statusRef.current === 'idle' && decodedText !== schoolConfig?.qrCodeValue) {
        toast({ variant: 'destructive', title: 'QR Code tidak valid' });
    }
  }, [schoolConfig?.qrCodeValue, handleAttendance, toast]);

  useEffect(() => {
    if (!showScanner || status !== 'idle') return;

    let isMounted = true;
    const scanner = new Html5Qrcode(readerId);
    html5QrCodeRef.current = scanner;

    const startScanner = async () => {
        try {
            await scanner.start(
                { facingMode: 'environment' }, 
                { fps: 30, aspectRatio: 1.0 }, 
                onScanSuccess, 
                undefined
            );
            if (isMounted) setIsScannerReady(true);
        } catch (err) {
            console.error("Scanner start error:", err);
            if (isMounted) setCameraError(true);
        }
    };

    startScanner();

    return () => {
        isMounted = false;
        if (scanner.isScanning) {
            scanner.stop().catch(e => console.warn("Scanner stop error", e));
        }
    };
  }, [showScanner, status, onScanSuccess]);

  if (!isClient) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black overflow-hidden" style={{ touchAction: 'none' }}>
        {showScanner && (
            <div className="absolute inset-0">
                <div id={readerId} className="w-full h-full" />
                <style>{`
                    #${readerId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
                    #${readerId}__scan_region, #${readerId}__dashboard_section_csr { display: none !important; }
                `}</style>
            </div>
        )}
        <div className="absolute top-12 left-0 right-0 z-50 text-center pointer-events-none px-10">
            <h2 className="text-white text-2xl font-black tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Scan Qr Code</h2>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">SMP NEGERI 5 LANGKE REMBONG</p>
        </div>
        <div className="absolute inset-0 z-10 pointer-events-none">
            {isScannerReady && <div className="absolute left-0 right-0 h-24 animate-scan-line bg-gradient-to-b from-transparent via-primary/30 to-transparent" />}
            {isDataLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>}
        </div>
        {effectiveStatus !== 'idle' && (
            <StatusFeedbackOverlay 
                status={effectiveStatus} 
                onClose={() => effectiveStatus.includes('success') || effectiveStatus.includes('info') ? router.push('/dashboard') : setStatus('idle')} 
                userData={userData} 
            />
        )}
    </div>
  );
}

const StatusFeedbackOverlay = ({ status, onClose, userData }: any) => {
    const theme = useMemo(() => {
        const isError = status.startsWith('error') || status === 'info_no_camera' || status === 'success_in_late';
        const isSuccess = status.startsWith('success');
        const isInfo = status.startsWith('info') && status !== 'info_no_camera';

        if (isError) return { border: 'border-red-500/40', iconColor: 'text-red-500' };
        if (isSuccess) {
            if (status === 'success_in') return { border: 'border-emerald-500/40', iconColor: 'text-emerald-500' };
            return { border: 'border-blue-500/40', iconColor: 'text-blue-500' };
        }
        if (isInfo) return { border: 'border-amber-500/40', iconColor: 'text-amber-500' };
        return { border: 'border-primary/40', iconColor: 'text-primary' };
    }, [status]);

    const feedback = useMemo(() => {
        const iconSize = "h-12 w-12";
        const loadingIcon = <Loader2 className={cn(iconSize, "animate-spin text-primary")} />;
        
        switch (status) {
            case 'processing': return { icon: loadingIcon, title: 'Memproses', desc: 'Sedang memvalidasi data absensi...' };
            case 'locating': return { icon: loadingIcon, title: 'Mencari Lokasi', desc: 'Menghubungkan ke satelit GPS...' };
            case 'success_in': return { icon: <CheckCircle className={cn(iconSize, "text-emerald-500")} />, title: 'Absen Masuk Berhasil', desc: 'Kehadiran Anda telah terekam.' };
            case 'success_in_late': return { icon: <ClockIcon className={cn(iconSize, "text-red-500")} />, title: 'Absen Terlambat', desc: 'Absensi terekam dengan status terlambat.' };
            case 'success_out': return { icon: <CheckCircle className={cn(iconSize, "text-blue-500")} />, title: 'Absen Pulang Berhasil', desc: 'Absen pulang terekam. Hati-hati di jalan!' };
            case 'error_radius': return { icon: <MapPin className={cn(iconSize, "text-red-500")} />, title: 'Di Luar Radius', desc: 'Anda harus berada di dalam area sekolah.' };
            case 'error_time': return { icon: <ClockIcon className={cn(iconSize, "text-red-500")} />, title: 'Jadwal Tutup', desc: 'Sesi absensi untuk saat ini telah ditutup.' };
            case 'error_checkin_closed': return { icon: <ClockIcon className={cn(iconSize, "text-amber-500")} />, title: 'Batas Masuk Berakhir', desc: 'Silahkan tunggu sesi absen pulang.' };
            case 'info_holiday': return { icon: <CalendarOff className={cn(iconSize, "text-amber-500")} />, title: 'Hari Libur', desc: 'Sistem absensi tidak aktif hari ini.' };
            case 'info_checked_out': return { icon: <Sparkles className={cn(iconSize, "text-emerald-500")} />, title: 'Absensi Selesai', desc: 'Absensi Anda hari ini telah tuntas.' };
            case 'info_no_camera': return { icon: <CameraOff className={cn(iconSize, "text-red-500")} />, title: 'Kamera Error', desc: 'Izinkan akses kamera di browser Anda.' };
            case 'info_leave': return { icon: <FileText className={cn(iconSize, "text-blue-500")} />, title: `Izin Disetujui`, desc: `Anda memiliki izin sah hari ini.` };
            default: return { icon: <X className={cn(iconSize, "text-red-500")} />, title: 'Gagal', desc: 'Terjadi kesalahan sistem. Coba lagi.' };
        }
    }, [status]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-6 py-10 overflow-y-auto">
            <div className={cn(
                "w-full max-w-sm text-center p-8 rounded-3xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-500 relative flex flex-col my-auto",
                theme.border
            )} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 p-2 opacity-30 hover:opacity-100 transition-opacity z-10"><X className="h-5 w-5" /></button>
                <div className="flex flex-col items-center">
                    <div className="mb-6 mt-4 p-2 rounded-full border-[0.5px] border-border/40">{feedback.icon}</div>
                    <div className="space-y-1 mb-8">
                        <h3 className="text-2xl font-black text-foreground tracking-tighter leading-tight px-2">{feedback.title}</h3>
                        <p className="text-muted-foreground text-[11px] font-bold leading-relaxed px-4">{feedback.desc}</p>
                    </div>
                    
                    {status.includes('success') && (
                        <div className="w-full flex-1 min-h-[140px]">
                            <QuoteOfTheDay category={userData?.role} attendanceType={status === 'success_out' ? 'out' : 'in'} />
                        </div>
                    )}
                    
                    <div className="mt-10 pt-6 border-t border-border/10 w-full flex flex-col items-center gap-1.5 opacity-40">
                        <p className="text-[9px] font-black text-foreground tracking-[0.2em] uppercase">SMP NEGERI 5 LANGKE REMBONG</p>
                        <p className="text-[8px] font-bold text-muted-foreground">©2026 | All Rights Reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
