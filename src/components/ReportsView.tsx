import { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  Clock, 
  Calendar,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { APV, Purchase, UserPermissions } from '../types';
import { 
  formatCurrency, 
  getAgingCategory, 
  getAgingBgColor, 
  getWeekRange, 
  safeParseDate 
} from '../utils';

interface ReportsViewProps {
  purchases: Purchase[];
  apvs: APV[];
  activeSubTab: 'funding' | 'aging';
  permissions: UserPermissions;
  globalSearch: string;
}

export default function ReportsView({
  purchases,
  apvs,
  activeSubTab,
  permissions,
  globalSearch
}: ReportsViewProps) {
  const TODAY = new Date();
  TODAY.setHours(0,0,0,0);

  const query = globalSearch.toLowerCase().trim();

  // Find Week boundary details
  const currentDay = TODAY.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const startOfWeek = new Date(TODAY);
  startOfWeek.setDate(TODAY.getDate() + diffToMonday);
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4);
  endOfWeek.setHours(23, 59, 59, 999);

  // 1. Group funded items by computed weeks
  const weeklyFundedBuckets = useMemo(() => {
    const table: Record<string, { weekLabel: string; sortKey: number; total: number; list: APV[] }> = {};

    apvs.filter(a => {
      const isCollected = a.status === 'Paid' || a.checkStatus === 'Collected';
      const isFunded = a.funded || isCollected;
      if (!isFunded) return false;

      const matchesSearch = !query ||
        (a.id && a.id.toLowerCase().includes(query)) ||
        (a.vendor && a.vendor.toLowerCase().includes(query)) ||
        (a.checkNumber && a.checkNumber.toLowerCase().includes(query));

      return matchesSearch;
    }).forEach(apv => {
      const dateString = apv.fundedDate || apv.settledDate || apv.dueDate || TODAY.toISOString().split('T')[0];
      const weekLabel = getWeekRange(dateString);
      const parseVal = safeParseDate(dateString)?.getTime() || 0;

      if (!table[weekLabel]) {
        table[weekLabel] = { weekLabel, sortKey: parseVal, total: 0, list: [] };
      }
      table[weekLabel].total += apv.amount;
      table[weekLabel].list.push(apv);
    });

    return Object.values(table).sort((a,b) => b.sortKey - a.sortKey);
  }, [apvs, query]);

  // 2. Compute Aging calculations for Unfunded & Uncollected APVs
  const agingCalculations = useMemo(() => {
    let currentSum = 0;
    let sum1_30 = 0;
    let sum31_60 = 0;
    let sum61_90 = 0;
    let sumOver90 = 0;
    let grandOutstanding = 0;

    let weeklyNeededTotal = 0;
    const weeklyNeed: Record<string, number> = {
      'Current': 0,
      '1-30 Days': 0,
      '31-60 Days': 0,
      '61-90 Days': 0,
      '> 90 Days': 0
    };

    const vendorMap: Record<string, { 
      name: string; 
      current: number; 
      days1_30: number; 
      days31_60: number; 
      days61_90: number; 
      over90: number; 
      total: number;
    }> = {};

    apvs.forEach(apv => {
      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
      // Only unpaid and unfunded APVs go into aging calculations
      if (!isCollected && !apv.funded) {
        
        const matchesSearch = !query ||
          (apv.id && apv.id.toLowerCase().includes(query)) ||
          (apv.vendor && apv.vendor.toLowerCase().includes(query));

        if (!matchesSearch) return;

        const category = getAgingCategory(apv.dueDate, 'Unpaid');
        const amt = apv.amount || 0;
        grandOutstanding += amt;

        if (category === 'Current') currentSum += amt;
        else if (category === '1-30 Days') sum1_30 += amt;
        else if (category === '31-60 Days') sum31_60 += amt;
        else if (category === '61-90 Days') sum61_90 += amt;
        else if (category === '> 90 Days') sumOver90 += amt;

        // Trace weekly need metrics
        const dueObj = safeParseDate(apv.dueDate);
        if (dueObj && dueObj <= endOfWeek) {
          weeklyNeededTotal += amt;
          weeklyNeed[category] = (weeklyNeed[category] || 0) + amt;
        }

        // Aggregate by Vendor
        if (!vendorMap[apv.vendor]) {
          vendorMap[apv.vendor] = { name: apv.vendor, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0, total: 0 };
        }
        vendorMap[apv.vendor].total += amt;
        if (category === 'Current') vendorMap[apv.vendor].current += amt;
        else if (category === '1-30 Days') vendorMap[apv.vendor].days1_30 += amt;
        else if (category === '31-60 Days') vendorMap[apv.vendor].days31_60 += amt;
        else if (category === '61-90 Days') vendorMap[apv.vendor].days61_90 += amt;
        else if (category === '> 90 Days') vendorMap[apv.vendor].over90 += amt;
      }
    });

    const vendorAgingList = Object.values(vendorMap).sort((a,b) => b.total - a.total);

    return {
      currentSum,
      sum1_30,
      sum31_60,
      sum61_90,
      sumOver90,
      grandOutstanding,
      weeklyNeededTotal,
      weeklyNeed,
      vendorAgingList
    };
  }, [apvs, query, endOfWeek]);

  if (activeSubTab === 'funding') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-600 font-bold" size={20} /> Corporate Cash Position History
            </h3>
            <p className="text-xs text-slate-500 mt-1">Audit log of corporate cash holdings grouped strictly by funded fiscal weeks.</p>
          </div>
        </div>

        {weeklyFundedBuckets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 italic shadow-sm">
            No processed payables available inside this period scope.
          </div>
        ) : (
          weeklyFundedBuckets.map(group => (
            <div key={group.weekLabel} className="bg-white rounded-xl border border-slate-150 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-150 bg-slate-50/70 flex justify-between items-center">
                <span className="font-extrabold text-slate-800 text-[11px] sm:text-xs uppercase tracking-wider font-mono">Fiscal Week: {group.weekLabel}</span>
                <span className="font-black text-indigo-700 font-mono text-sm sm:text-base">{formatCurrency(group.total)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50/10 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3 font-semibold">APV ID</th>
                      <th className="p-3 font-semibold">Vendor Company</th>
                      <th className="p-3 font-semibold">Effective Action Date</th>
                      <th className="p-3 font-semibold">Release Metrics</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {group.list.map(apv => {
                      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
                      return (
                        <tr key={apv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold font-mono text-slate-800">{apv.id}</td>
                          <td className="p-3 font-bold text-slate-800">{apv.vendor}</td>
                          <td className="p-3 text-slate-500 font-mono">{apv.fundedDate || apv.settledDate || 'Legacy'}</td>
                          <td className="p-3">
                            {isCollected ? (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center">
                                <CheckCircle size={10} className="mr-0.5" /> Collected ({apv.releaseDate || apv.settledDate})
                              </span>
                            ) : apv.checkNumber ? (
                              <span className="text-amber-700 bg-amber-50 border border-amber-100 text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center">
                                Check: {apv.checkNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">Awaiting Desk Print</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-black font-mono text-slate-850">{formatCurrency(apv.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </motion.div>
    );
  } else {
    // Aging reports matrices
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="text-indigo-600 font-bold" size={20} /> AP Aging Audit Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-1">Outstanding liabilities mapped against overdue dates. Excludes funded items.</p>
          </div>
        </div>

        {/* Weekly Needs liquidity helper */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Fiscal Week Liabilities</span>
            <span className="text-lg md:text-xl font-extrabold text-slate-800 font-mono block">
              {formatCurrency(agingCalculations.weeklyNeededTotal)}
            </span>
            <p className="text-[9px] text-slate-400 mt-0.5">Payables due by {endOfWeek.toLocaleDateString('en-US', {month: 'short', day:'numeric'})}</p>
          </div>

          <div className="md:col-span-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-2">Liquidity Breakdowns by Aging thresholds</span>
            {agingCalculations.weeklyNeededTotal === 0 ? (
              <span className="text-xs text-slate-400 italic block py-1.5">No fiscal requirements active.</span>
            ) : (
              <div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden mb-2">
                  {['Current', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days'].map(cat => {
                    const sum = agingCalculations.weeklyNeed[cat] || 0;
                    if (sum === 0) return null;
                    const percent = Math.round((sum / agingCalculations.weeklyNeededTotal) * 100);
                    return (
                      <div 
                        key={cat} 
                        style={{ width: `${percent}%` }} 
                        className={getAgingBgColor(cat)} 
                        title={`${cat}: ${percent}%`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                  {['Current', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days'].map(cat => {
                    const sum = agingCalculations.weeklyNeed[cat] || 0;
                    return (
                      <div key={cat} className="min-w-0">
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${getAgingBgColor(cat)}`} />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate">{cat}</span>
                        </div>
                        <span className={`text-[10px] font-bold font-mono ${sum > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{formatCurrency(sum)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Master Vendor Aging Matrix */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs md:text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-150 text-[10px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <th className="p-4 text-left">Vendor Name</th>
                  <th className="p-3 text-emerald-800">Current</th>
                  <th className="p-3 text-yellow-800">1-30 Days</th>
                  <th className="p-3 text-orange-800">31-60 Days</th>
                  <th className="p-3 text-red-800">61-90 Days</th>
                  <th className="p-3 text-rose-800">&gt; 90 Days</th>
                  <th className="p-4 bg-slate-100 text-slate-800 font-extrabold text-right">Sum Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {agingCalculations.vendorAgingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">No unfunded liabilities registered.</td>
                  </tr>
                ) : (
                  agingCalculations.vendorAgingList.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-left font-bold text-slate-800 max-w-[150px] truncate flex items-center gap-1.5">
                        <Building size={12} className="text-slate-300 shrink-0" />
                        <span className="truncate">{row.name}</span>
                      </td>
                      <td className={`p-3 font-mono ${row.current > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{formatCurrency(row.current)}</td>
                      <td className={`p-3 font-mono ${row.days1_30 > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{formatCurrency(row.days1_30)}</td>
                      <td className={`p-3 font-mono ${row.days31_60 > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{formatCurrency(row.days31_60)}</td>
                      <td className={`p-3 font-mono ${row.days61_90 > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{formatCurrency(row.days61_90)}</td>
                      <td className={`p-3 font-mono ${row.over90 > 0 ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{formatCurrency(row.over90)}</td>
                      <td className="p-4 font-black font-mono text-slate-800 bg-slate-50/30 text-right">{formatCurrency(row.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50/70 font-black border-t-2 border-slate-200">
                <tr className="font-bold text-xs sm:text-sm">
                  <td className="p-4 text-left text-slate-800 font-extrabold uppercase">Aggregation Sums</td>
                  <td className="p-3 text-emerald-800 font-mono">{formatCurrency(agingCalculations.currentSum)}</td>
                  <td className="p-3 text-yellow-800 font-mono">{formatCurrency(agingCalculations.sum1_30)}</td>
                  <td className="p-3 text-orange-850 font-mono">{formatCurrency(agingCalculations.sum31_60)}</td>
                  <td className="p-3 text-red-800 font-mono">{formatCurrency(agingCalculations.sum61_90)}</td>
                  <td className="p-3 text-rose-800 font-mono">{formatCurrency(agingCalculations.sumOver90)}</td>
                  <td className="p-4 font-black text-indigo-700 bg-slate-100 text-right font-mono text-xs sm:text-base">{formatCurrency(agingCalculations.grandOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }
}
