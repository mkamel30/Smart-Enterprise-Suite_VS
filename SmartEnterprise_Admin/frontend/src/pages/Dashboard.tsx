import { LayoutDashboard, Users, Package, CreditCard, Activity, ArrowUpRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Executive Overview</h1>
        <p className="text-slate-500 font-medium">Real-time consolidated data across the entire enterprise network.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={<Activity className="text-blue-600" />} label="Online Branches" value="0/0" trend="+0" />
        <MetricCard icon={<Package className="text-purple-600" />} label="Total Inventory" value="0" trend="+0%" />
        <MetricCard icon={<Users className="text-orange-600" />} label="Avg. Productivity" value="0%" trend="-0%" />
        <MetricCard icon={<CreditCard className="text-green-600" />} label="Monthly Rev" value="$0k" trend="+0%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-900 tracking-tighter">Performance Comparison</h3>
              <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600">
                <option>Last 30 Days</option>
              </select>
           </div>
           <div className="h-64 flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">Chart visualization will appear here once branches are connected.</p>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8">
           <h3 className="font-black text-xl text-slate-900 mb-6 tracking-tighter">Recent Activities</h3>
           <div className="space-y-4">
              <ActivityItem text="Portal initialized" time="Just now" type="system" />
              <ActivityItem text="Super admin created" time="Just now" type="auth" />
           </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="bg-slate-50 p-3 rounded-2xl">{icon}</div>
        <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
          trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {trend}
          <ArrowUpRight size={10} />
        </div>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function ActivityItem({ text, time }: any) {
  return (
    <div className="flex gap-4">
       <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
       <div>
         <p className="text-sm font-bold text-slate-700">{text}</p>
         <p className="text-[10px] font-bold text-slate-400 uppercase">{time}</p>
       </div>
    </div>
  );
}
