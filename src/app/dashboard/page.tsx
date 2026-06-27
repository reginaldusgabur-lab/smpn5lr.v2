'use client';

import { useState, useMemo, useEffect } from 'export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const { stats, isLoading: isStatsLoading } = useStaffDashboardStats(firestore, user);
  const { summary: personalSummary, isLoading: isPersonalSummaryLoading } = useMonthlyAttendanceSummary(user);

  const todaysAttendanceQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'attendanceRecords'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), limit(1)) : null, [firestore, user]);
  const { data: todaysAttendance, isLoading: isAttendanceLoading } = useCollection(user, todaysAttendanceQuery);

  const schoolConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolConfig', 'default') : null, [firestore]);
  const { data: schoolConfig, isLoading: isConfigLoading } = useDoc(user, schoolConfigRef);

  const role = user?.role;
  const isAdminOrKepsek = role === 'admin' || role === 'kepala_sekolah';
  const isGuruOrPegawai = role === 'guru' || role === 'pegawai';

  return (
    <PageWrapper>
        <div className="w-full">
            <WelcomeCard user={user} isLoading={isUserLoading} />

            {isGuruOrPegawai && (
                <div className="w-full space-y-5">
                    <div className="w-full">
                        <PersonalAttendanceCardUI 
                            attendanceData={todaysAttendance} 
                            schoolConfig={schoolConfig} 
                            isLoading={isAttendanceLoading || isUserLoading || isConfigLoading} 
                        />
                    </div>

                    <div className="space-y-2 w-full">
                        <div className="px-1">
                            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                                <TrendingUp size={14} className="text-primary" /> Riwayat Bulan {format(new Date(), 'MMMM', { locale: id })}
                            </h2>
                            <p className="text-[10px] text-muted-foreground">
                                Persentase kehadiran: <span className="font-bold text-primary">{isPersonalSummaryLoading ? '...' : `${personalSummary.percentage}%`}</span>
                            </p>
                        </div>
                        <MonthlyAttendanceChartUI 
                            summaryData={personalSummary} 
                            isLoading={isPersonalSummaryLoading || isUserLoading} 
                        />
                    </div>
                </div>
            )}

            {isAdminOrKepsek && (
                <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                        <StatCard 
                            title="Hadir Hari Ini" 
                            value={stats.hadir} 
                            icon={UserCheck} 
                            isLoading={isStatsLoading || isUserLoading} 
                        />
                        <StatCard 
                            title="Izin/Sakit" 
                            value={stats.izin + stats.sakit} 
                            icon={BookUser} 
                            description={`${stats.izin} Izin, ${stats.sakit} Sakit`} 
                            isLoading={isStatsLoading || isUserLoading} 
                        />
                        <StatCard 
                            title="Menunggu" 
                            value={stats.pending} 
                            icon={MailWarning} 
                            description="Pengajuan tertunda" 
                            isLoading={isStatsLoading || isUserLoading} 
                            className="cursor-pointer hover:bg-accent/10 border-accent/20" 
                            onClick={() => router.push('/dashboard/izin-kepala-sekolah')} 
                        />
                    </div>
                    <div className="w-full"><TodaysActivityTable /></div>
                    <div className="w-full"><AbsentUsersTable /></div>
                </div>
            )}
        </div>
    </PageWrapper>
  );
}
