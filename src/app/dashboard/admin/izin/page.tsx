
'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, Calendar, Clock } from 'lucide-react';
import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from '@/firebase';
import { collection, doc, query, where, Timestamp, getDocs, type DocumentData, collectionGroup, orderBy } from 'firebase/firestore';
import { format, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest } from '@/types';

const approvalStatusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'approved': 'default',
    'pending': 'outline',
    'rejected': 'destructive',
};

const ApprovalTableSkeleton = ({ cols, rows = 3 }: { cols: number, rows?: number }) => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {[...Array(cols)].map((_, i) => (
                        <TableHead key={i}>
                            <Skeleton className="h-5 w-full" />
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(rows)].map((_, i) => (
                    <TableRow key={i}>
                        {[...Array(cols)].map((_, j) => (
                            <TableCell key={j}>
                                <Skeleton className="h-5 w-full" />
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export default function PersetujuanIzinPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc(user, userDocRef);

  const isRoleCheckLoading = isAuthLoading || isUserDataLoading;
  const isPrivileged = !isRoleCheckLoading && (userData?.role === 'kepala_sekolah' || userData?.role === 'admin');

  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [recentHistory, setRecentHistory] = useState<LeaveRequest[]>([]);
  const [isLeaveRequestsLoading, setIsLeaveRequestsLoading] = useState(true);

  useEffect(() => {
    if (!isPrivileged || !firestore) {
        setIsLeaveRequestsLoading(false);
        return;
    }

    const fetchLeaveRequests = async () => {
        setIsLeaveRequestsLoading(true);
        try {
            // FETCH ALL PENDING GLOBALLY (INBOX)
            const qPending = query(
                collectionGroup(firestore, 'leaveRequests'),
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            );
            
            // FETCH RECENT HISTORY (6 DAYS)
            const sixDaysAgo = new Date();
            sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
            const qHistory = query(
                collectionGroup(firestore, 'leaveRequests'),
                where('status', 'in', ['approved', 'rejected']),
                where('startDate', '>=', Timestamp.fromDate(startOfDay(sixDaysAgo))),
                orderBy('startDate', 'desc')
            );

            const [snapPending, snapHistory] = await Promise.all([
                getDocs(qPending),
                getDocs(qHistory)
            ]);

            setPendingRequests(snapPending.docs.map(d => ({ 
                ...d.data(), 
                id: d.id, 
                userId: d.ref.parent.parent?.id 
            }) as LeaveRequest));

            setRecentHistory(snapHistory.docs.map(d => ({ 
                ...d.data(), 
                id: d.id, 
                userId: d.ref.parent.parent?.id 
            }) as LeaveRequest));

        } catch (error) {
            console.error("Failed to fetch leave requests:", error);
        } finally {
            setIsLeaveRequestsLoading(false);
        }
    };

    fetchLeaveRequests();
  }, [isPrivileged, firestore]);

  useEffect(() => {
    if (!isRoleCheckLoading) {
      if (!user) {
        router.replace('/');
      } else if (!isPrivileged) {
        router.replace('/dashboard');
      }
    }
  }, [isRoleCheckLoading, user, isPrivileged, router]);

  if (isRoleCheckLoading || !isPrivileged) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border shadow-none rounded-3xl bg-card">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight">Permintaan izin tertunda (Inbox)</CardTitle>
          <CardDescription className="text-muted-foreground font-bold pt-1">Menampilkan seluruh permintaan yang belum diproses, diurutkan dari yang terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isLeaveRequestsLoading ? (
            <ApprovalTableSkeleton cols={4} />
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-20">
                <Inbox className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-bold text-foreground">Kotak masuk kosong</p>
                <p className="text-xs font-bold">Semua permintaan izin dan sakit telah diproses.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Nama personil</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Jenis</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Rencana Tanggal</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Alasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map(req => {
                    return (
                      <TableRow key={req.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                        <TableCell className="font-bold text-sm text-foreground">{req.userName}</TableCell>
                        <TableCell>
                          <Badge variant={req.type === 'Sakit' ? 'destructive' : 'secondary'} className="text-[9px] font-bold uppercase px-3 py-0.5">
                            {req.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black text-foreground">{req.startDate?.toDate ? format(req.startDate.toDate(), 'd MMM yyyy', { locale: id }) : ''}</span>
                                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">s/d</span>
                                <span className="text-[10px] font-black text-foreground">{req.endDate?.toDate ? format(req.endDate.toDate(), 'd MMM yyyy', { locale: id }) : ''}</span>
                            </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-[11px] font-bold" title={req.reason}>{req.reason}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border shadow-none rounded-3xl bg-card">
        <CardHeader className="p-4 sm:p-6 text-primary border-b border-muted-foreground/10">
          <CardTitle className="font-bold text-sm tracking-tight">Riwayat persetujuan (6 hari terakhir)</CardTitle>
          <CardDescription className="text-muted-foreground font-bold pt-1">Daftar izin yang telah diproses oleh Kepala Sekolah baru-baru ini.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isLeaveRequestsLoading ? (
            <ApprovalTableSkeleton cols={5} />
          ) : recentHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-20">
              <p className="text-xs font-bold">Tidak ada riwayat baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Nama personil</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Jenis</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Tanggal</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-primary/80">Alasan</TableHead>
                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-primary/80">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHistory.map(req => (
                    <TableRow key={req.id} className="border-muted-foreground/5 hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-sm text-foreground">{req.userName}</TableCell>
                      <TableCell>
                        <Badge variant={req.type === 'Sakit' ? 'destructive' : 'secondary'} className="text-[9px] font-bold uppercase px-3 py-0.5">
                          {req.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black text-foreground">{req.startDate?.toDate ? format(req.startDate.toDate(), 'd MMM yyyy', { locale: id }) : ''}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-[11px] font-bold" title={req.reason}>{req.reason}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={approvalStatusVariant[req.status] || 'secondary'} className="text-[9px] font-bold uppercase px-3 py-1 rounded-full border-none shadow-none">
                            {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : req.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
