import { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Building,
  AlertCircle, 
  ShoppingCart, 
  DollarSign, 
  Activity, 
  Timer, 
  PiggyBank, 
  ArrowUpRight 
} from 'lucide-react';
import { Purchase, APV } from '../types';
import { 
  formatCurrency, 
  getAgingCategory, 
  getDaysDiff, 
  safeParseDate 
} from '../utils';

interface DashboardViewProps {
  purchases: Purchase[];
  apvs: APV[];
  dbError: boolean;
  dbErrorMessage: string;
  onViewPoExceptions?: () => void;
  selectedMonth: string;
}

export default function DashboardView({ purchases, apvs, dbError, dbErrorMessage, onViewPoExceptions, selectedMonth }: DashboardViewProps) {
  const TODAY = new Date();
  TODAY.setHours(0,0,0,0);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => selectedMonth === 'All' || (p.date && p.date.startsWith(selectedMonth)));
  }, [purchases, selectedMonth]);

  const filteredApvs = useMemo(() => {
    return apvs.filter(a => selectedMonth === 'All' || (a.invoiceDate && a.invoiceDate.startsWith(selectedMonth)));
  }, [apvs, selectedMonth]);

  // Computations
  const stats = useMemo(() => {
    let totalPurchases = 0;
    let totalSavings = 0;
    let totalOutstanding = 0;
    let totalPendingChecks = 0;
    let totalChecksCreated = 0;
    let totalProcessingDays = 0;
    let processedCount = 0;
    let withinTargetCount = 0;
    let totalDelayDays = 0;
    let contractCount = 0;
    let latePRs = 0;

    filteredPurchases.forEach(p => {
      totalPurchases += p.amount || 0;
      totalSavings += p.discountAmount || 0;

      if (p.prReceivedDate && p.date) {
        const diff = getDaysDiff(p.prReceivedDate, p.date);
        if (diff !== null && diff >= 0) {
          totalProcessingDays += diff;
          processedCount++;
          if (diff <= 3) withinTargetCount++;
        }
      }

      if (p.prReceivedDate && p.contractDate) {
        const delayDays = getDaysDiff(p.contractDate, p.prReceivedDate);
        if (delayDays !== null) {
          contractCount++;
          if (delayDays > 0) {
            latePRs++;
            totalDelayDays += delayDays;
          }
        }
      }
    });

    filteredApvs.forEach(apv => {
      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
      if (!isCollected && !apv.funded) {
        totalOutstanding += apv.amount || 0;

        if (apv.checkNumber || apv.checkStatus === 'Check Created') {
          totalChecksCreated += apv.amount || 0;
        } else {
          totalPendingChecks += apv.amount || 0;
        }
      }
    });

    const averageProcessing = processedCount > 0 ? (totalProcessingDays / processedCount).toFixed(1) : '0';
    const withinTargetPercent = processedCount > 0 ? Math.round((withinTargetCount / processedCount) * 100) : 0;
    const rateOfLate = contractCount > 0 ? Math.round((latePRs / contractCount) * 100) : 0;
    const averageDelay = latePRs > 0 ? (totalDelayDays / latePRs).toFixed(1) : '0';

    // Find Overdue APVs
    const priorityApvs = filteredApvs.filter(apv => {
      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
      if (isCollected || apv.funded) return false;
      const due = safeParseDate(apv.dueDate);
      if (!due) return false;
      return due < TODAY;
    }).sort((a, b) => {
      const dateA = safeParseDate(a.dueDate)?.getTime() || 0;
      const dateB = safeParseDate(b.dueDate)?.getTime() || 0;
      return dateA - dateB;
    });

    return {
      totalPurchases,
      totalSavings,
      totalOutstanding,
      totalPendingChecks,
      totalChecksCreated,
      averageProcessing,
      withinTargetPercent,
      rateOfLate,
      averageDelay,
      priorityApvs,
      latePRs
    };
  }, [filteredPurchases, filteredApvs]);

  const poExceptions = useMemo(() => {
    return filteredPurchases
      .filter(p => !filteredApvs.some(a => a.poId === p.id))
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [filteredPurchases, filteredApvs]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {dbError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-md">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-sm">Database Sync Limited</h4>
            <p className="text-xs mt-0.5 text-red-700">{dbErrorMessage || 'Unable to connect to live Firestore references.'}</p>
          </div>
        </div>
      )}

      {/* Main Stats Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { title: "Total Purchases", val: stats.totalPurchases, desc: "Cumulative ordered sum", icon: ShoppingCart, bg: "bg-blue-50 text-blue-600" },
          { title: "Cost Savings", val: stats.totalSavings, desc: "Total price cuts saved", icon: PiggyBank, bg: "bg-emerald-50 text-emerald-600" },
          { 
            title: "Unfunded Payables", 
            val: stats.totalOutstanding, 
            desc: `Pending: ${formatCurrency(stats.totalPendingChecks)}`, 
            icon: DollarSign, 
            bg: "bg-rose-50 text-rose-600" 
          },
          { 
            title: "Past Due Payables", 
            val: stats.priorityApvs.reduce((acc, a) => acc + a.amount, 0), 
            desc: `${stats.priorityApvs.length} late payables active`, 
            icon: AlertCircle, 
            bg: "bg-amber-50 text-amber-600" 
          }
        ].map((card, i) => (
          <motion.div 
            key={i} 
            variants={itemVariants}
            whileHover={{ y: -3, transition: { duration: 0.1 } }}
            className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase tracking-wider">{card.title}</span>
              <div className={`p-1.5 rounded-lg ${card.bg}`}><card.icon size={16} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-800 font-mono truncate">{formatCurrency(card.val)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytical Insight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <motion.div variants={itemVariants} className="bg-white p-4 md:p-5 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-sm md:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Activity className="text-indigo-600" size={18} /> PR to PO Sourcing Speed
          </h3>
          <div className="flex items-end justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-3xl font-black text-slate-800 font-mono">{stats.averageProcessing}</span>
              <span className="text-[10px] font-bold text-slate-400 ml-1">avg. days</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Average wait to create PO</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-600 font-mono">{stats.withinTargetPercent}%</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Target reached (≤3 days)</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>Sourcing targets ensure stable agency fulfillment.</span>
            <ArrowUpRight size={14} className="text-slate-300" />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-4 md:p-5 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-sm md:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Timer className="text-amber-500" size={18} /> Contract Timing Latency
          </h3>
          <div className="flex items-end justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-3xl font-black text-rose-600 font-mono">{stats.averageDelay}</span>
              <span className="text-[10px] font-bold text-slate-400 ml-1">days overdue</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Avg PR delay from contracts</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-700 font-mono">{stats.rateOfLate}%</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Late PR submission rate</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>Latent pipeline triggers delayed service schedules.</span>
            <ArrowUpRight size={14} className="text-slate-300" />
          </div>
        </motion.div>
      </div>

      {/* Double Column Alerts and Exceptions Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Overdue alert panel */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 bg-red-50/20 flex items-center justify-between">
              <h3 className="text-sm md:text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-rose-500 animate-pulse" size={18} /> High-Priority Past Due payables
              </h3>
              <span className="text-[10px] font-bold bg-rose-150 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">
                CRITICAL ({stats.priorityApvs.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">APV Ref</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3 text-center">Days Overdue</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {stats.priorityApvs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                        Great! There are no unpaid past-due payables.
                      </td>
                    </tr>
                  ) : (
                    stats.priorityApvs.map(apv => {
                      const due = safeParseDate(apv.dueDate);
                      const diffDays = due ? Math.ceil((TODAY.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      return (
                        <tr key={apv.id} className="hover:bg-rose-50/10 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{apv.id}</td>
                          <td className="p-3 text-slate-700 font-semibold">{apv.vendor}</td>
                          <td className="p-3 text-slate-500 font-mono">{apv.dueDate}</td>
                          <td className="p-3 text-center">
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] inline-block font-bold">
                              {diffDays} days
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-rose-600 font-mono">
                            {formatCurrency(apv.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* PO exceptions panel */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 bg-amber-50/20 flex items-center justify-between">
              <h3 className="text-sm md:text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-amber-500 animate-pulse" size={18} /> PO exceptions (No Associated APVs)
              </h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                PENDING APV ({poExceptions.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">PO Ref</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">PO Date</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {poExceptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        Great! Zero exceptions. All POs possess associated APV vouchers.
                      </td>
                    </tr>
                  ) : (
                    poExceptions.slice(0, 10).map(po => {
                      return (
                        <tr key={po.id} className="hover:bg-amber-50/10 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{po.id}</td>
                          <td className="p-3 text-slate-700 font-semibold">{po.vendor}</td>
                          <td className="p-3 text-slate-500 font-mono">{po.date}</td>
                          <td className="p-3 text-right font-black text-indigo-600 font-mono">
                            {formatCurrency(po.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {poExceptions.length > 0 && onViewPoExceptions && (
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={onViewPoExceptions}
                className="text-xs text-indigo-650 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer transition"
              >
                Inspect all filtration exceptions <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
