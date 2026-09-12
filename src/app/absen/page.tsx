'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, CameraOff, CalendarOff, MapPin, Clock as ClockIcon, CheckCircle, Lock, FileText, Sparkles } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import QuoteOfTheDay from '@/components/layout/quote-of-the-day';
import { useAttendanceWindow } from '@/hooks/use-attendance-window';
import { invalidateCache } from '@/lib/cache';

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
            if (context.state === 'suspended') await context.resume();
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

type FeedbackStatus = 'idle' | 'processing' | 'locating' | 'success_in' | 'success_out' | 'error_radius' | 'error_time' | 'error_checkin_closed' | 'error_already_in' | 'error_already_out' | 'error_generic' | 'error_location' | 'info_holiday' | 'info_checked_out' | 'info_no_camera' | 'info_disabled' | 'info_leave';

export default function AbsenPage() {
  const [status, setStatus] = useState<FeedbackStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { status: globalStatus, activeSession, s1Status, s2Status, config: schoolConfig } = useAttendanceWindow();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-fullscreen";

  useEffect(() => { setIsClient(true); }, []);

  const { data: userData } = useDoc(user, user ? doc(firestore, 'users', user.uid) : null);
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, user ? query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', todayStr)) : null);
  const todaysRecord = todaysAttendance?.[0];

  const { data: activeLeaves, isLoading: isLeaveLoading } = useCollection(user, user ? query(collection(firestore, 'users', user.uid, 'leaveRequests'), where('status', '==', 'approved')) : null);
  const currentActiveLeave = useMemo(() => {
      if (!activeLeaves || !isClient) return null;
      const now = new Date();
      return activeLeaves.find(l => isWithinInterval(now, { start: startOfDay(l.startDate.toDate()), end: endOfDay(l.endDate.toDate()) }));
  }, [activeLeaves, isClient]);

  const isDataLoading = !isClient || isAttendanceLoading || isLeaveLoading || globalStatus === 'LOADING';
  const currentSessionStatus = activeSession === 1 ? s1Status : s2Status;

  const effectiveStatus: FeedbackStatus = useMemo(() => {
      if (status !== 'idle') return status;
      if (isDataLoading) return 'idle';
      if (currentActiveLeave) return 'info_leave';
      if (globalStatus === 'DISABLED') return 'info_disabled';
      if (globalStatus === 'SESSION_INACTIVE') return 'info_holiday';
      
      const hasIn = activeSession === 1 ? !!todaysRecord?.checkInTime : !!todaysRecord?.s2CheckInTime;
      const hasOut = activeSession === 1 ? !!todaysRecord?.checkOutTime : !!todaysRecord?.s2CheckOutTime;

      if (hasIn && hasOut) return 'info_checked_out';
      if (currentSessionStatus === 'IN_CLOSED') return 'error_checkin_closed';
      if (currentSessionStatus === 'BEFORE' || currentSessionStatus === 'CLOSED') return 'error_time';
      if (hasCameraPermission === false) return 'info_no_camera';
      return 'idle';
  }, [status, isDataLoading, currentActiveLeave, globalStatus, activeSession, todaysRecord, currentSessionStatus, hasCameraPermission]);

  const showScanner = isClient && !isDataLoading && hasCameraPermission && globalStatus === 'ACTIVE' && (currentSessionStatus === 'IN_OPEN' || currentSessionStatus === 'OUT_OPEN');

  const handleAttendance = useCallback(async () => {
    if (!user || !firestore || !schoolConfig || !activeSession) return;
    setStatus('processing');
    try {
        let lat = null, lon = null;
        if (schoolConfig.useLocationValidation) {
            setStatus('locating');
            try {
                const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
                lat = pos.coords.latitude; lon = pos.coords.longitude;
                if (getDistance(lat, lon, schoolConfig.latitude!, schoolConfig.longitude!) > schoolConfig.radius!) return setStatus('error_radius');
            } catch (e) { return setStatus('error_location'); }
        }

        const now = new Date();
        const recordRef = todaysRecord ? doc(firestore, 'users', user.uid, 'attendanceRecords', todaysRecord.id) : null;
        
        if (currentSessionStatus === 'IN_OPEN') {
            const hasIn = activeSession === 1 ? !!todaysRecord?.checkInTime : !!todaysRecord?.s2CheckInTime;
            if (hasIn) return setStatus('error_already_in');
            
            const field = activeSession === 1 ? 'checkInTime' : 's2CheckInTime';
            const latField = activeSession === 1 ? 'checkInLatitude' : 's2CheckInLatitude';
            const lonField = activeSession === 1 ? 'checkInLongitude' : 's2CheckInLongitude';

            if (recordRef) {
                await updateDoc(recordRef, { [field]: now, [latField]: lat, [lonField]: lon });
            } else {
                await addDoc(collection(firestore, 'users', user.uid, 'attendanceRecords'), { userId: user.uid, date: todayStr, [field]: now, [latField]: lat, [lonField]: lon });
            }
            setStatus('success_in');
        } else {
            const hasOut = activeSession === 1 ? !!todaysRecord?.checkOutTime : !!todaysRecord?.s2CheckOutTime;
            if (hasOut) return setStatus('error_already_out');

            const field = activeSession === 1 ? 'checkOutTime' : 's2CheckOutTime';
            const latField = activeSession === 1 ? 'checkOutLatitude' : 's2CheckOutLatitude';
            const lonField = activeSession === 1 ? 'checkOutLongitude' : 's2CheckOutLongitude';

            if (recordRef) {
                await updateDoc(recordRef, { [field]: now, [latField]: lat, [lonField]: lon });
            } else {
                await addDoc(collection(firestore, 'users', user.uid, 'attendanceRecords'), { userId: user.uid, date: todayStr, [field]: now, [latField]: lat, [lonField]: lon, reasonForUpdate: `Absen Pulang S${activeSession} (Tanpa Masuk)` });
            }
            setStatus('success_out');
        }
        invalidateCache();
        playSuccessFeedback((schoolConfig as any).successSoundUrl);
    } catch (e) { setStatus('error_generic'); }
  }, [user, firestore, schoolConfig, todaysRecord, currentSessionStatus, activeSession, todayStr]);

  const onScanSuccess = useCallback((decoded: string) => {
    if (status === 'idle' && decoded === schoolConfig?.qrCodeValue) handleAttendance();
    else if (decoded !== schoolConfig?.qrCodeValue) toast({ variant: 'destructive', title: 'QR Code tidak valid' });
  }, [schoolConfig, status, handleAttendance, toast]);

  useEffect(() => {
    if (showScanner && status === 'idle') {
        const qr = html5QrCodeRef.current || new Html5Qrcode(readerId);
        html5QrCodeRef.current = qr;
        qr.start({ facingMode: 'environment' }, { fps: 30 }, onScanSuccess, undefined)
          .then(() => setIsScannerReady(true)).catch(() => setIsScannerReady(false));
    }
    return () => { if (html5QrCodeRef.current?.isScanning) html5QrCodeRef.current.stop(); };
  }, [showScanner, status, onScanSuccess]);

  if (!isClient) return null;

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-hidden">
        {showScanner && <div id={readerId} className="w-full h-full" />}
        <div className="absolute top-8 left-0 right-0 z-50 text-center pointer-events-none">
            <h2 className="text-white text-2xl font-bold drop-shadow-lg uppercase tracking-tighter">ABSENSI SESI {activeSession}</h2>
            <p className="text-white/70 text-[10px] font-bold mt-1">SISTEM E-SPENLI</p>
        </div>
        <div className="absolute inset-0 z-10 pointer-events-none">
            {isScannerReady && <div className="absolute left-0 right-0 h-16 animate-scan-line bg-gradient-to-b from-transparent via-primary/40 to-transparent" />}
            {isDataLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>}
        </div>
        {effectiveStatus !== 'idle' && (
            <StatusFeedbackOverlay 
                status={effectiveStatus} 
                session={activeSession}
                onClose={() => effectiveStatus.includes('success') || effectiveStatus.includes('info') ? router.push('/dashboard') : setStatus('idle')} 
                userData={userData} 
            />
        )}
    </div>
  );
}

const StatusFeedbackOverlay = ({ status, session, onClose, userData }: any) => {
    const feedback = useMemo(() => {
        const iconSize = "h-12 w-12";
        switch (status) {
            case 'success_in': return { icon: <CheckCircle className={cn(iconSize, "text-emerald-500")} />, title: `MASUK SESI ${session} BERHASIL`, desc: 'Kehadiran Anda telah terekam. Selamat beraktivitas!' };
            case 'success_out': return { icon: <CheckCircle className={cn(iconSize, "text-blue-500")} />, title: `PULANG SESI ${session} BERHASIL`, desc: 'Absen pulang terekam. Hati-hati di jalan!' };
            case 'error_radius': return { icon: <MapPin className={cn(iconSize, "text-red-500")} />, title: 'DI LUAR RADIUS', desc: 'Anda harus berada di area sekolah.' };
            case 'error_time': return { icon: <ClockIcon className={cn(iconSize, "text-red-500")} />, title: 'WAKTU HABIS', desc: `Sesi absensi ${session} sudah ditutup.` };
            case 'error_checkin_closed': return { icon: <ClockIcon className={cn(iconSize, "text-amber-500")} />, title: 'BATAS MASUK BERAKHIR', desc: 'Waktu masuk berakhir, silakan tunggu absen pulang.' };
            case 'info_holiday': return { icon: <CalendarOff className={cn(iconSize, "text-amber-500")} />, title: 'HARI LIBUR', desc: 'Sistem absensi tidak aktif hari ini.' };
            case 'info_checked_out': return { icon: <Sparkles className={cn(iconSize, "text-emerald-500")} />, title: `ABSENSI S${session} SELESAI`, desc: 'Anda sudah tuntas untuk sesi ini.' };
            default: return { icon: <X className={cn(iconSize, "text-red-500")} />, title: 'GAGAL', desc: 'Terjadi kesalahan sistem.' };
        }
    }, [status, session]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl px-10">
            <div className="w-full max-w-sm text-center p-8 rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-500">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 opacity-40 hover:opacity-100"><X /></button>
                <div className="flex flex-col items-center">
                    <div className="mb-4">{feedback.icon}</div>
                    <h3 className="text-xl font-black tracking-tighter mb-2">{feedback.title}</h3>
                    <p className="text-muted-foreground text-xs font-bold leading-relaxed px-4">{feedback.desc}</p>
                    {(status === 'success_in' || status === 'success_out') && <QuoteOfTheDay category={userData?.role} attendanceType={status === 'success_in' ? 'in' : 'out'} />}
                </div>
            </div>
        </div>
    );
};