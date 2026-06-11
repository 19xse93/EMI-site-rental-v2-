import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Landmark, 
  FileSignature, 
  Check, 
  AlertCircle, 
  Filter 
} from 'lucide-react';
import { APV, UserPermissions } from '../types';
import { formatCurrency } from '../utils';

interface TreasuryViewProps {
  apvs: APV[];
  permissions: UserPermissions;
  globalSearch: string;
  selectedMonth: string;
  onOpenFundModal: (apv?: APV) => void;
  onOpenCheckModal: (apv?: APV) => void;
  onUnfund: (apv: APV) => void;
}

export default function TreasuryView({
  apvs,
  permissions,
  globalSearch,
  selectedMonth,
  onOpenFundModal,
  onOpenCheckModal,
  onUnfund
}: TreasuryViewProps) {
  const [treasuryFilter, setTreasuryFilter] = useState<'All' | 'Pending Check' | 'Check Created' | 'Funded' | 'Collected'>('All');

  const query = globalSearch.toLowerCase().trim();

  // Filter list
  const filteredTreasury = useMemo(() => {
    return apvs.filter(apv => {
      const matchMonth = selectedMonth === 'All' || (apv.invoiceDate && apv.invoiceDate.startsWith(selectedMonth));
      
      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
      const isFunded = !isCollected && apv.funded;
      const isCreated = !isCollected && !apv.funded && (!!apv.checkNumber || apv.checkStatus === 'Check Created');
      const isPending = !isCollected && !apv.funded && !isCreated;

      let matchFilter = true;
      if (treasuryFilter === 'Collected') matchFilter = isCollected;
      else if (treasuryFilter === 'Funded') matchFilter = isFunded;
      else if (treasuryFilter === 'Check Created') matchFilter = isCreated;
      else if (treasuryFilter === 'Pending Check') matchFilter = isPending;

      const matchSearch = !query ||
        (apv.id && apv.id.toLowerCase().includes(query)) ||
        (apv.vendor && apv.vendor.toLowerCase().includes(query)) ||
        (apv.checkNumber && apv.checkNumber.toLowerCase().includes(query));

      return matchMonth && matchFilter && matchSearch;
    });
  }, [apvs, selectedMonth, treasuryFilter, query]);

  // Aggregate stats
  const aggregates = useMemo(() => {
    let pendingCheckAmt = 0;
    let createdNeedsFundAmt = 0;
    let fundedReadyAmt = 0;
    let releasedAmt = 0;

    apvs.forEach(apv => {
      const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
      const amt = apv.amount || 0;

      if (isCollected) {
        releasedAmt += amt;
      } else if (apv.funded) {
        fundedReadyAmt += amt;
      } else if (apv.checkNumber || apv.checkStatus === 'Check Created') {
        createdNeedsFundAmt += amt;
      } else {
        pendingCheckAmt += amt;
      }
    });

    return { pendingCheckAmt, createdNeedsFundAmt, fundedReadyAmt, releasedAmt };
  }, [apvs]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Mini Dashboard for Cash Positions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { title: "Pending Checks", val: aggregates.pendingCheckAmt, desc: "Awaiting Check registration", color: "text-rose-600 border-rose-100 bg-rose-50/10" },
          { title: "Created Checks", val: aggregates.createdNeedsFundAmt, desc: "Awaiting Fund clearance", color: "text-amber-600 border-amber-100 bg-amber-50/10" },
          { title: "Clear / Funded", val: aggregates.fundedReadyAmt, desc: "Awaiting Vendor pick-up", color: "text-indigo-600 border-indigo-100 bg-indigo-50/10" },
          { title: "Cleared (Collected)", val: aggregates.releasedAmt, desc: "Archived paid transfers", color: "text-emerald-600 border-emerald-100 bg-emerald-50/10" }
        ].map((card, idx) => (
          <div key={idx} className={`bg-white p-4 rounded-xl border ${card.color} shadow-sm`}>
            <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">{card.title}</span>
            <h3 className="text-sm sm:text-base md:text-lg font-black font-mono truncate">{formatCurrency(card.val)}</h3>
            <p className="text-[9px] text-slate-400 mt-0.5 truncate">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Main Board Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="text-indigo-600" size={18} />
            <span className="font-bold text-slate-800 text-sm md:text-base">Check Desk Operations</span>
          </div>

          <div className="flex flex-wrap items-center w-full sm:w-auto gap-2">
            <div className="relative">
              <select 
                value={treasuryFilter}
                onChange={e => setTreasuryFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-xs py-1.5 pl-2 pr-7 rounded-lg outline-none cursor-pointer appearance-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Operations</option>
                <option value="Pending Check">Awaiting Check</option>
                <option value="Check Created">Created (Unfunded)</option>
                <option value="Funded">Funded (Ready)</option>
                <option value="Collected">Collected</option>
              </select>
              <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {permissions.manageTreasury && (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => onOpenCheckModal()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-2 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <FileSignature size={12} /> Set Check
                </button>
                <button 
                  onClick={() => onOpenFundModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-2 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <Landmark size={12} /> Allocate Funds
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">APV Ref</th>
                <th className="p-4">Vendor</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4">Check parameters</th>
                <th className="p-3 text-center">Desk Status</th>
                {permissions.manageTreasury && <th className="p-3 text-center">Sourcing Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredTreasury.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">No payables available inside current operations scope.</td>
                </tr>
              ) : (
                filteredTreasury.map(apv => {
                  const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
                  return (
                    <tr key={apv.id} className="hover:bg-slate-50/50 transition-all align-middle">
                      <td className="p-4 font-bold text-slate-800 font-mono tracking-tight">{apv.id}</td>
                      <td className="p-4 text-slate-700 font-bold">{apv.vendor}</td>
                      <td className="p-4 text-right font-black font-mono text-slate-850">{formatCurrency(apv.amount)}</td>
                      <td className="p-4">
                        {apv.checkNumber ? (
                          <div className="text-[10px] space-y-0.5 font-mono text-slate-600">
                            <div><span className="text-slate-450 uppercase font-semibold">CHK #:</span> <span className="font-bold text-slate-800">{apv.checkNumber}</span></div>
                            <div><span className="text-slate-450 uppercase font-semibold">DATE:</span> {apv.checkDate}</div>
                            {apv.releaseDate && (
                              <div><span className="text-emerald-500 uppercase font-bold text-[9px]">RELEASED:</span> {apv.releaseDate}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-500 italic font-mono uppercase font-black">No Check Allocated</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {(() => {
                          let statusText = 'Pending Check';
                          let colors = 'bg-rose-50 text-rose-700 border-rose-200';
                          if (isCollected) {
                            statusText = 'Collected';
                            colors = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          } else if (apv.funded) {
                            statusText = 'Funded / Ready';
                            colors = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                          } else if (apv.checkNumber || apv.checkStatus === 'Check Created') {
                            statusText = 'Check Created';
                            colors = 'bg-amber-50 text-amber-700 border-amber-200';
                          }
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block border ${colors}`}>
                              {statusText}
                            </span>
                          );
                        })()}
                      </td>
                      {permissions.manageTreasury && (
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => apv.funded ? onUnfund(apv) : onOpenFundModal(apv)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                apv.funded 
                                  ? 'bg-slate-150 text-slate-700 border-slate-200 hover:bg-slate-200' 
                                  : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700'
                              }`}
                            >
                              <Landmark size={10} className="inline mr-1" /> {apv.funded ? 'Funded' : 'Fund'}
                            </button>

                            <button 
                              onClick={() => onOpenCheckModal(apv)}
                              className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 py-1 px-2.5 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Check
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
