
// Trigger Vercel deployment
import { AttendanceSection } from "@/components/features/attendance/AttendanceSection";
import { UserWelcome } from "@/components/features/user/UserWelcome";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ReportChart } from "@/components/features/report/ReportChart";
import { getStartAndEndOfMonth } from "@/lib/utils";
import { QuoteCard } from "@/components/features/quote/QuoteCard";


export default async function DashboardPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/auth/login");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await db.attendance.findFirst({
        where: {
            userId: user.id,
            date: {
                gte: today,
            },
        },
    });


    // Mendapatkan tanggal awal dan akhir bulan ini
    const { startOfMonth, endOfMonth } = getStartAndEndOfMonth(new Date());

    // Mengambil data absensi untuk bulan ini
    const monthlyAttendances = await db.attendance.findMany({
        where: {
            userId: user.id,
            date: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
        },
        orderBy: {
            date: 'asc',
        },
    });

    let todayAttendanceStatus: {
        status: 'present' | 'absent' | 'incomplete' | 'no_attendance';
        description: string;
    };

    if (existingAttendance) {
        if (existingAttendance.checkInTime && existingAttendance.checkOutTime) {
            todayAttendanceStatus = {
                status: 'present',
                description: 'Anda sudah melakukan absensi datang dan pulang hari ini. Terima kasih.'
            };
        } else if (existingAttendance.checkInTime) {
            todayAttendanceStatus = {
                status: 'incomplete',
                description: 'Anda belum melakukan absensi pulang. Jangan lupa untuk absen sebelum jam pulang.'
            };
        } else {
            // This case should ideally not happen if check-in is mandatory first
            todayAttendanceStatus = {
                status: 'absent',
                description: 'Anda tidak tercatat melakukan absensi hari ini.'
            };
        }
    } else {
        const dayOfWeek = new Date().getDay();
        // 0 is Sunday, 6 is Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            todayAttendanceStatus = {
                status: 'no_attendance',
                description: 'Hari ini adalah hari libur. Tidak ada jadwal absensi.'
            };
        } else {
            const now = new Date();
            const checkInCutOff = new Date();
            checkInCutOff.setHours(9, 0, 0, 0); // batas absen jam 9 pagi

            const checkOutCutOff = new Date();
            checkOutCutOff.setHours(17, 0, 0, 0); // batas pulang jam 5 sore

            if (now > checkOutCutOff) {
                todayAttendanceStatus = {
                    status: 'absent',
                    description: 'Anda tidak melakukan absensi masuk dan pulang hari ini.'
                };
            } else if (now > checkInCutOff) {
                todayAttendanceStatus = {
                    status: 'absent',
                    description: 'Anda tidak melakukan absensi masuk hari ini.'
                };
            }
            else {
                todayAttendanceStatus = {
                    status: 'no_attendance',
                    description: 'Belum ada catatan absensi untuk hari ini. Silakan lakukan absensi.'
                };
            }
        }
    }

    // Logic to check if yesterday's attendance was incomplete
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayDayOfWeek = yesterday.getDay();

    if (yesterdayDayOfWeek !== 0 && yesterdayDayOfWeek !== 6) {
        const yesterdayAttendance = await db.attendance.findFirst({
            where: {
                userId: user.id,
                date: {
                    gte: yesterday
                }
            }
        });

        if (yesterdayAttendance) {
            if (yesterdayAttendance.checkInTime && !yesterdayAttendance.checkOutTime) {
                // If there's a check-in but no check-out for yesterday, create a notification
                const notification = {
                    title: 'Absensi Tidak Lengkap',
                    description: 'Anda tidak melakukan absensi pulang. Kehadiran Anda hari ini tercatat tidak lengkap.'
                };
             }
        }
    }


    return (
        <div className="flex flex-col space-y-6">
            <UserWelcome
                name={user.name || "Pengguna"}
                role={user.role}
                todayStatus={todayAttendanceStatus}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <AttendanceSection
                        userId={user.id}
                        checkInTime={existingAttendance?.checkInTime?.toISOString() ?? null}
                        checkOutTime={existingAttendance?.checkOutTime?.toISOString() ?? null}
                        attendanceId={existingAttendance?.id ?? null}
                        todayStatus={todayAttendanceStatus}
                    />
                </div>
                <div className="lg:col-span-1 row-start-1 md:row-start-auto">
                    <QuoteCard />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Laporan Absensi Bulanan</CardTitle>
                    <CardDescription>
                        Grafik ini menunjukkan ringkasan kehadiran Anda selama sebulan terakhir.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ReportChart attendanceData={monthlyAttendances} />
                </CardContent>
            </Card>

        </div>
    );
}

