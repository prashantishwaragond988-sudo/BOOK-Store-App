import { Skeleton } from './Skeleton';

export default function StatCard({ title, value, icon: Icon, iconClassName = '', loading }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 transition-transform duration-200 hover:scale-[1.02] hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-500">{title}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? <Skeleton className="h-9 w-32" /> : value}
          </div>
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-slate-50 ${iconClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

