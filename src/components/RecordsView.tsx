import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Paperclip, 
  Check, 
  AlertCircle, 
  Filter,
  ShoppingCart,
  FileText
} from 'lucide-react';
import { Purchase, APV, UserPermissions } from '../types';
import { 
  formatCurrency, 
  getAgingCategory, 
  getAgingColor 
} from '../utils';

interface RecordsViewProps {
  purchases: Purchase[];
  apvs: APV[];
  activeSubTab: 'purchases' | 'apvs';
  permissions: UserPermissions;
  globalSearch: string;
  selectedMonth: string;
  poSpecialFilter?: 'All' | 'No APV' | 'No Amount';
  onChangePoSpecialFilter?: (val: 'All' | 'No APV' | 'No Amount') => void;
  onAddPo: () => void;
  onEditPo: (po: Purchase) => void;
  onDeletePo: (id: string) => void;
  onAddApv: () => void;
  onEditApv: (apv: APV) => void;
  onDeleteApv: (id: string) => void;
  onViewAttachment: (base64Img: string) => void;
}

export default function RecordsView({
  purchases,
  apvs,
  activeSubTab,
  permissions,
  globalSearch,
  selectedMonth,
  poSpecialFilter: propPoSpecialFilter,
  onChangePoSpecialFilter,
  onAddPo,
  onEditPo,
  onDeletePo,
  onAddApv,
  onEditApv,
  onDeleteApv,
  onViewAttachment
}: RecordsViewProps) {
  // Filters
  const [poStatusFilter, setPoStatusFilter] = useState<'All' | 'Pending' | 'Invoiced' | 'Paid'>('All');
  const [internalPoSpecialFilter, setInternalPoSpecialFilter] = useState<'All' | 'No APV' | 'No Amount'>('All');
  
  const poSpecialFilter = propPoSpecialFilter !== undefined ? propPoSpecialFilter : internalPoSpecialFilter;
  const setPoSpecialFilter = onChangePoSpecialFilter !== undefined ? onChangePoSpecialFilter : setInternalPoSpecialFilter;

  const [apvStatusFilter, setApvStatusFilter] = useState<'All' | 'Unpaid' | 'Paid'>('All');

  const query = globalSearch.toLowerCase().trim();

  // 1. Process Purchases with dynamic status updates based on real-time APVs
  const processedPurchases = useMemo(() => {
    return purchases.map(po => {
      const linkedApvs = apvs.filter(a => a.poId === po.id);
      let derivedStatus = po.status || 'Pending';
      if (linkedApvs.length > 0) {
        const isPaid = linkedApvs.some(a => a.status === 'Paid' || a.checkStatus === 'Collected');
        derivedStatus = isPaid ? 'Paid' : 'Invoiced';
      } else {
        derivedStatus = 'Pending';
      }
      return { ...po, status: derivedStatus };
    });
  }, [purchases, apvs]);

  // 2. Filter Purchases
  const filteredPurchases = useMemo(() => {
    return processedPurchases.filter(p => {
      const matchMonth = selectedMonth === 'All' || (p.date && p.date.startsWith(selectedMonth));
      const matchStatus = poStatusFilter === 'All' || p.status === poStatusFilter;
      
      let matchSpecial = true;
      if (poSpecialFilter === 'No APV') {
        matchSpecial = !apvs.some(a => a.poId === p.id);
      } else if (poSpecialFilter === 'No Amount') {
        matchSpecial = !p.amount || Number(p.amount) === 0;
      }

      const matchSearch = !query || 
        (p.id && p.id.toLowerCase().includes(query)) ||
        (p.vendor && p.vendor.toLowerCase().includes(query)) ||
        (p.processorName && p.processorName.toLowerCase().includes(query)) ||
        (p.prRequestor && p.prRequestor.toLowerCase().includes(query)) ||
        (p.remarks && p.remarks.toLowerCase().includes(query));

      return matchMonth && matchStatus && matchSpecial && matchSearch;
    });
  }, [processedPurchases, apvs, selectedMonth, poStatusFilter, poSpecialFilter, query]);

  // 3. Filter APVs
  const filteredApvs = useMemo(() => {
    return apvs.filter(a => {
      const matchMonth = selectedMonth === 'All' || (a.invoiceDate && a.invoiceDate.startsWith(selectedMonth));
      
      let matchStatus = true;
      const isCollected = a.status === 'Paid' || a.checkStatus === 'Collected';
      if (apvStatusFilter === 'Paid') {
        matchStatus = isCollected;
      } else if (apvStatusFilter === 'Unpaid') {
        matchStatus = !isCollected;
      }

      const matchSearch = !query ||
        (a.id && a.id.toLowerCase().includes(query)) ||
        (a.poId && a.poId.toLowerCase().includes(query)) ||
        (a.vendor && a.vendor.toLowerCase().includes(query)) ||
        (a.checkNumber && a.checkNumber.toLowerCase().includes(query));

      return matchMonth && matchStatus && matchSearch;
    });
  }, [apvs, selectedMonth, apvStatusFilter, query]);

  // View Render selectors
  if (activeSubTab === 'purchases') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-indigo-600" size={18} />
            <span className="font-bold text-slate-800 text-sm md:text-base">Purchase Orders ({filteredPurchases.length})</span>
          </div>

          <div className="flex flex-wrap items-center w-full sm:w-auto gap-2">
            {/* Direct Status Selector */}
            <div className="relative">
              <select 
                value={poStatusFilter}
                onChange={e => setPoStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-xs py-1.5 pl-2 pr-7 rounded-lg outline-none cursor-pointer appearance-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Paid">Paid</option>
              </select>
              <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Special filters */}
            <div className="relative">
              <select 
                value={poSpecialFilter}
                onChange={e => setPoSpecialFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-xs py-1.5 pl-2 pr-7 rounded-lg outline-none cursor-pointer appearance-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Exceptions</option>
                <option value="No APV">No Linked APV</option>
                <option value="No Amount">Zero Pricing</option>
              </select>
              <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {permissions.managePo && (
              <button 
                onClick={onAddPo}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-sm transition"
              >
                <Plus size={14} /> Add PO
              </button>
            )}
          </div>
        </div>

        {poSpecialFilter !== 'All' && (
          <div className="bg-indigo-50 text-indigo-900 text-[11px] font-semibold px-4 py-2.5 border-b border-indigo-100/60 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-indigo-500" />
              Showing only: <b>{poSpecialFilter === 'No APV' ? 'Purchase Orders with NO Associated APV vouchers (Sourcing Exceptions)' : 'Zero Pricing Records'}</b>
            </span>
            <button 
              onClick={() => setPoSpecialFilter('All')}
              className="text-[10px] bg-white text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 cursor-pointer transition font-extrabold uppercase tracking-wider"
            >
              Show All POs
            </button>
          </div>
        )}

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-1/4">PO Details</th>
                <th className="p-4 w-1/3">Sourcing Meta & Line Parameters</th>
                <th className="p-4 text-right">Net Amount</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 italic">No Purchase Orders matching filters.</td>
                </tr>
              ) : (
                filteredPurchases.map(po => {
                  const hasApv = apvs.some(a => a.poId === po.id);
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-all align-top">
                      <td className="p-4">
                        <div className="font-extrabold text-indigo-600 tracking-tight">{po.id}</div>
                        <div className="flex items-center gap-1.5 mt-1 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            po.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            po.status === 'Invoiced' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {po.status}
                          </span>
                          {po.paymentTerms === 'COD' && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[8px] font-extrabold px-1.5 py-[1px] rounded uppercase font-mono">COD</span>
                          )}
                          {po.paymentTerms === 'PDC' && (
                            <span className="bg-purple-50 border border-purple-200 text-purple-700 text-[8px] font-extrabold px-1.5 py-[1px] rounded uppercase font-mono">PDC</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight line-clamp-3 mb-2 max-w-xs" title={po.description}>
                          {po.description}
                        </div>
                        {po.attachmentData && (
                          <button 
                            onClick={() => onViewAttachment(po.attachmentData!)}
                            className="bg-blue-50 hover:bg-blue-100 transition text-blue-700 text-[9px] font-bold px-2 py-1 rounded inline-flex items-center border border-blue-200 cursor-pointer"
                          >
                            <Paperclip size={10} className="mr-1" /> View Attached files
                          </button>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-[13px]">{po.vendor}</div>
                        
                        <div className="mt-2 bg-slate-50 rounded-lg p-2 border border-slate-100 scale-98 origin-left">
                          <div className="grid grid-cols-2 gap-y-0.5 gap-x-3 text-[10px] text-slate-500 font-mono">
                            <div><span className="font-semibold text-slate-400">PR RECEIVED:</span> {po.prReceivedDate || 'N/A'}</div>
                            <div><span className="font-semibold text-slate-400">PO DATE:</span> {po.date || 'N/A'}</div>
                            <div><span className="font-semibold text-slate-400">CONTRACT:</span> {po.contractDate || 'N/A'}</div>
                            <div className="truncate"><span className="font-semibold text-slate-400">REQUESTOR:</span> {po.prRequestor || 'N/A'}</div>
                          </div>
                        </div>

                        {po.remarks && (
                          <div className="mt-1.5 p-1.5 bg-amber-50/50 rounded text-[10px] text-amber-800 border border-amber-100/40 italic">
                            <b>Remarks:</b> {po.remarks}
                          </div>
                        )}

                        <div className="mt-2">
                          {hasApv ? (
                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black tracking-wide border border-emerald-200 rounded px-1.5 py-0.5 inline-flex items-center">
                              <Check size={10} className="mr-1" /> APV Linked
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-700 text-[9px] font-black tracking-wide border border-rose-200 rounded px-1.5 py-0.5 inline-flex items-center">
                              <AlertCircle size={10} className="mr-1" /> No APV Linked
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="font-black text-slate-800 text-sm sm:text-base font-mono">
                          {formatCurrency(po.amount)}
                        </div>
                        {po.discountAmount > 0 && (
                          <div className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 font-bold rounded px-1.5 py-0.5 inline-block mt-1">
                            Discount Saved: {formatCurrency(po.discountAmount)}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          Gross: {formatCurrency(po.grossAmount)}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2.5">
                          {permissions.managePo && (
                            <button 
                              onClick={() => onEditPo(po)}
                              className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {permissions.deleteRecords && (
                            <button 
                              onClick={() => onDeletePo(po.id)}
                              className="text-slate-400 hover:text-red-500 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  } else {
    // APVs SubTab Render
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="text-indigo-600" size={18} />
            <span className="font-bold text-slate-800 text-sm md:text-base">APV Vouchers ({filteredApvs.length})</span>
          </div>

          <div className="flex flex-wrap items-center w-full sm:w-auto gap-2">
            {/* Direct Status Selector */}
            <div className="relative">
              <select 
                value={apvStatusFilter}
                onChange={e => setApvStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-700 text-xs py-1.5 pl-2 pr-7 rounded-lg outline-none cursor-pointer appearance-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Vouchers</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid Only</option>
              </select>
              <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {permissions.manageApv && (
              <button 
                onClick={onAddApv}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-sm transition"
              >
                <Plus size={14} /> Add APV
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">APV Ref</th>
                <th className="p-4">Vendor & Sourcing Pointer</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Aging Period</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredApvs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No APVs found matching criteria.</td>
                </tr>
              ) : (
                filteredApvs.map(apv => {
                  const isCollected = apv.status === 'Paid' || apv.checkStatus === 'Collected';
                  const aging = getAgingCategory(apv.dueDate, isCollected ? 'Paid' : 'Unpaid');
                  return (
                    <tr key={apv.id} className="hover:bg-slate-50/50 transition-all align-top">
                      <td className="p-4 font-bold text-slate-800 font-mono tracking-tight">{apv.id}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-[13px]">{apv.vendor}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Linked PO: <span className="font-bold text-indigo-500 font-mono">{apv.poId}</span></div>
                        
                        <div className="mt-2 grid grid-cols-2 gap-2 max-w-xs text-[10px] text-slate-500 font-mono">
                          <div><span className="text-slate-400">INVOICED:</span> {apv.invoiceDate}</div>
                          <div><span className="text-slate-400">DUE BY:</span> {apv.dueDate}</div>
                        </div>

                        {/* Payment Check assigned block */}
                        <div className="mt-2.5">
                          {apv.checkNumber ? (
                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black tracking-wide border border-emerald-200 rounded px-1.5 py-0.5 inline-flex items-center shadow-sm">
                              <Check size={10} className="mr-0.5" /> Check: {apv.checkNumber} ({apv.checkStatus})
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 text-[9px] font-black tracking-wide border border-amber-200 rounded px-1.5 py-0.5 inline-flex items-center shadow-sm">
                              <AlertCircle size={10} className="mr-0.5" /> Awaiting Check Setup
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="font-black text-slate-850 text-[14px] sm:text-base font-mono">
                          {formatCurrency(apv.amount)}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${getAgingColor(aging)}`}>
                          {aging}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2.5">
                          {permissions.manageApv && (
                            <button 
                              onClick={() => onEditApv(apv)}
                              className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {permissions.deleteRecords && (
                            <button 
                              onClick={() => onDeleteApv(apv.id)}
                              className="text-slate-400 hover:text-red-500 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }
}
