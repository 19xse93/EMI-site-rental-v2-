import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  FileText, 
  Wallet, 
  CalendarDays, 
  Clock, 
  Users, 
  History, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  Shield, 
  ChevronRight, 
  Search, 
  Download,
  Upload,
  Trash2,
  Paperclip,
  Check,
  AlertTriangle,
  FileSignature,
  Landmark,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';

// Types & Config
import { Purchase, APV, AppUser, AuditLog, UserPermissions } from './types';
import { auth, db } from './firebase';
import { 
  formatCurrency, 
  mapAccessLevelToPermissions, 
  standardizeDate, 
  getAgingCategory 
} from './utils';

// Subcomponents
import AuthPage from './components/AuthPage';
import DashboardView from './components/DashboardView';
import RecordsView from './components/RecordsView';
import TreasuryView from './components/TreasuryView';
import ReportsView from './components/ReportsView';
import AdminPane from './components/AdminPane';

// Database modular operations
import { 
  onSnapshot, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  writeBatch 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const APP_ID = 'emi-site-monitoring';

// -------------------------------------------------------------
// DEFAULT MOCK FALLBACK DATA
// (Ensures the dashboard is instantly loaded even on fresh boot)
// -------------------------------------------------------------
const MOCK_PURCHASES: Purchase[] = [
  { id: 'EMI-PO-2026-001', prReceivedDate: '2026-05-10', date: '2026-05-12', contractDate: '2026-05-09', prRequestor: 'Arthur Pendragon', processorName: 'Gwen Stacy', vendor: 'Global Signage Corp', description: 'Procurement of ultra-bright LED billboards for Pasay Bypass site', amount: 450000, grossAmount: 500000, discountAmount: 50000, paymentTerms: 'Standard Terms (30 days)', remarks: 'Urgent placement target before rainy season' },
  { id: 'EMI-PO-2026-002', prReceivedDate: '2026-05-14', date: '2026-05-15', contractDate: '2026-05-14', prRequestor: 'Tony Stark', processorName: 'Bruce Banner', vendor: 'Meralco Power Systems', description: 'Commercial grid connectivity linkage and transformer setup at QC central hub', amount: 820000, grossAmount: 820000, discountAmount: 0, paymentTerms: 'COD', remarks: 'Needs cash release proof on delivery' },
  { id: 'EMI-PO-2026-003', prReceivedDate: '2026-05-20', date: '2026-05-22', contractDate: '2026-05-18', prRequestor: 'Wanda Maximoff', processorName: 'Gwen Stacy', vendor: 'BuildMax Steel works', description: 'Structural steel columns and framing assembly for EDSA billboard mount', amount: 125000, grossAmount: 140000, discountAmount: 15000, paymentTerms: 'PDC', remarks: 'Check delivery scheduled upon erection milestone' },
  { id: 'EMI-PO-2026-004', prReceivedDate: '2026-06-01', date: '2026-06-03', contractDate: '2026-06-02', prRequestor: 'Stephen Strange', processorName: 'Gwen Stacy', vendor: 'FiberNet Telecom Ph', description: 'Fiber-optic backhaul dynamic link setup for remote monitoring telemetry', amount: 75000, grossAmount: 75000, discountAmount: 0, paymentTerms: 'Standard Terms (30 days)' }
];

const MOCK_APVS: APV[] = [
  { id: 'EMI-APV-2026-001', poId: 'EMI-PO-2026-001', vendor: 'Global Signage Corp', invoiceDate: '2026-05-15', dueDate: '2026-06-15', amount: 450000, funded: false, paymentTerms: 'Standard Terms (30 days)', status: 'Unpaid', checkStatus: 'Pending Check' },
  { id: 'EMI-APV-2026-002', poId: 'EMI-PO-2026-003', vendor: 'BuildMax Steel works', invoiceDate: '2026-05-24', dueDate: '2026-06-23', amount: 125000, funded: true, fundedDate: '2026-06-05', paymentTerms: 'PDC', status: 'Unpaid', checkNumber: 'PDC-CHK-99120', checkDate: '2026-06-20', checkStatus: 'Check Created' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'purchases' | 'apvs' | 'treasury' | 'funding' | 'aging' | 'users' | 'logs'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // Core entities listings
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [apvs, setApvs] = useState<APV[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Search & Global periods
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [poSpecialFilter, setPoSpecialFilter] = useState<'All' | 'No APV' | 'No Amount'>('All');

  // Load Statuses
  const [authChecking, setAuthChecking] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [dataErrorMessage, setDataErrorMessage] = useState('');

  // -------------------------------------------------------------
  // DIALOG MODAL STATE MANAGEMENTS
  // -------------------------------------------------------------
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isApvModalOpen, setIsApvModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState<string | null>(null);

  // Selected details for edits or deletes
  const [selectedPo, setSelectedPo] = useState<Purchase | null>(null);
  const [selectedApv, setSelectedApv] = useState<APV | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<{ id: string; type: 'PO' | 'APV' | 'USER' } | null>(null);

  // Trigger fund allocators
  const [fundAllocDetails, setFundAllocDetails] = useState({ apvId: '', date: new Date().toISOString().split('T')[0] });
  const [checkDetails, setCheckDetails] = useState({ apvId: '', checkNumber: '', date: new Date().toISOString().split('T')[0], status: 'Check Created' as 'Pending Check' | 'Check Created' | 'Collected' });

  // -------------------------------------------------------------
  // USER PERMISSIONS DERIVATIONS
  // -------------------------------------------------------------
  const permissions = useMemo<UserPermissions>(() => {
    if (!currentUser) return mapAccessLevelToPermissions([0]); // Default guests view
    return currentUser.permissions || mapAccessLevelToPermissions(currentUser.accessLevels);
  }, [currentUser]);

  // Dynamic Month Listing selections
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    purchases.forEach(p => {
      if (p.date && p.date.match(/^\d{4}-\d{2}/)) list.add(p.date.substring(0, 7));
    });
    apvs.forEach(a => {
      if (a.invoiceDate && a.invoiceDate.match(/^\d{4}-\d{2}/)) list.add(a.invoiceDate.substring(0, 7));
    });
    return Array.from(list).sort().reverse();
  }, [purchases, apvs]);

  // Prepopulate form field states
  const [poForm, setPoForm] = useState<Omit<Purchase, 'status'>>({ id: '', vendor: '', description: '', amount: 0, grossAmount: 0, discountAmount: 0, paymentTerms: 'Standard Terms (30 days)', date: new Date().toISOString().split('T')[0], prReceivedDate: '', contractDate: '', prRequestor: '', processorName: '', remarks: '', attachmentData: '' });
  const [apvForm, setApvForm] = useState<APV>({ id: '', poId: '', vendor: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], amount: 0, funded: false, paymentTerms: 'Standard Terms (30 days)', status: 'Unpaid' });
  const [userForm, setUserForm] = useState<{ email: string; name: string; department: string; accessLevels: number[] }>({ email: '', name: '', department: 'Purchasing', accessLevels: [13] });

  // Auditing logger dispatcher
  const dispatchAuditLog = async (action: string, type: string, id: string, msg: string) => {
    try {
      const entry: AuditLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user: userEmail || 'System Administrator',
        action,
        entityType: type,
        entityId: id,
        details: msg
      };
      await setDoc(doc(db, "artifacts", APP_ID, "public", "data", "audit_logs", entry.id), entry);
    } catch (e) {
      console.warn("Audit trace failed to write:", e);
    }
  };

  // 1. Authenticate checkups
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        setIsLoggedIn(true);

        // Maintain listeners for current user profile
        const userDocRef = doc(db, "artifacts", APP_ID, "public", "data", "appUsers", user.email.toLowerCase());
        const unsubUser = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCurrentUser({
              id: snap.id,
              email: data.email || snap.id,
              name: data.name || 'System User',
              department: data.department || 'AP',
              accessLevels: data.accessLevels || [0]
            });
          } else {
            // Unregistered users get superuser on first setup loop to allow administration
            setCurrentUser({
              id: user.email!,
              email: user.email!,
              name: 'Super Admin',
              department: 'Treasury',
              accessLevels: [3]
            });
          }
        }, (err) => {
          console.warn("User fetch block, using direct Admin authorization:", err);
          setCurrentUser({
            id: user.email!,
            email: user.email!,
            name: 'Workspace Auditor',
            department: 'Sourcing Dept',
            accessLevels: [3]
          });
        });

        setAuthChecking(false);
        return () => unsubUser();
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setAuthChecking(false);
      }
    });
    return () => unsub();
  }, []);

  // 2. Continuous real-time synchronization with Firestore
  useEffect(() => {
    if (!isLoggedIn) return;

    // Subscribes to Purchases
    const unsubPo = onSnapshot(collection(db, "artifacts", APP_ID, "public", "data", "purchases"), (snap) => {
      if (snap.empty) {
        // If Firestore subcollections are fresh/empty, bootstrap them from local mocks!
        setPurchases(MOCK_PURCHASES);
      } else {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
        setPurchases(list.sort((a,b) => a.id.localeCompare(b.id)));
      }
    }, (err) => {
      console.warn("Firestore Purchases read restricted, loading local cache:", err);
      setDataError(true);
      setDataErrorMessage("Live cloud permissions limited. Operating inside offline Sandbox environment.");
      setPurchases(MOCK_PURCHASES);
    });

    // Subscribes to APVs
    const unsubApv = onSnapshot(collection(db, "artifacts", APP_ID, "public", "data", "apvs"), (snap) => {
      if (snap.empty) {
        setApvs(MOCK_APVS);
      } else {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as APV));
        setApvs(list.sort((a,b) => a.id.localeCompare(b.id)));
      }
    }, (err) => {
      console.warn("Firestore APVs read restricted, loading local cache:", err);
      setApvs(MOCK_APVS);
    });

    // Subscribes to Registered profiles
    const unsubUsers = onSnapshot(collection(db, "artifacts", APP_ID, "public", "data", "appUsers"), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
        setAppUsers(list);
      }
    }, (err) => console.log("User listing restricted:", err));

    // Subscribes to logs
    const unsubLogs = onSnapshot(collection(db, "artifacts", APP_ID, "public", "data", "audit_logs"), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
        setAuditLogs(list.sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
      }
    }, (err) => console.log("Audit log listing restricted:", err));

    return () => {
      unsubPo();
      unsubApv();
      unsubUsers();
      unsubLogs();
    };
  }, [isLoggedIn]);

  // -------------------------------------------------------------
  // ACTION DISPATCHERS
  // -------------------------------------------------------------
  const handleSavePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.managePo) return;

    try {
      const derivedStatus = selectedPo ? selectedPo.status : 'Pending';
      const record = {
        ...poForm,
        amount: Number(poForm.amount),
        grossAmount: Number(poForm.grossAmount || poForm.amount),
        discountAmount: Number(poForm.discountAmount || 0),
        status: derivedStatus
      };

      await setDoc(doc(db, "artifacts", APP_ID, "public", "data", "purchases", poForm.id), record);
      await dispatchAuditLog(
        selectedPo ? 'UPDATE' : 'CREATE',
        'PO',
        poForm.id,
        `${selectedPo ? 'Updated' : 'Registered'} PO details for ${poForm.vendor} totaling ${formatCurrency(poForm.amount)}.`
      );

      setIsPoModalOpen(false);
      setSelectedPo(null);
    } catch (err: any) {
      alert("PO transaction restricted: " + err.message);
    }
  };

  const handleSaveAPV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.manageApv) return;

    try {
      const isPaid = apvForm.status === 'Paid';
      const record: APV = {
        ...apvForm,
        amount: Number(apvForm.amount),
        funded: isPaid ? true : apvForm.funded,
        fundedDate: isPaid ? (apvForm.fundedDate || apvForm.settledDate || new Date().toISOString().split('T')[0]) : (apvForm.fundedDate || null),
        settledDate: isPaid ? (apvForm.settledDate || new Date().toISOString().split('T')[0]) : null
      };

      await setDoc(doc(db, "artifacts", APP_ID, "public", "data", "apvs", apvForm.id), record);
      
      // Auto-update PO status cascade
      if (apvForm.poId) {
        await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "purchases", apvForm.poId), {
          status: isPaid ? 'Paid' : 'Invoiced'
        }).catch(() => {});
      }

      await dispatchAuditLog(
        selectedApv ? 'UPDATE' : 'CREATE',
        'APV',
        apvForm.id,
        `${selectedApv ? 'Updated' : 'Created'} voucher linking PO ref ${apvForm.poId}.`
      );

      setIsApvModalOpen(false);
      setSelectedApv(null);
    } catch (err: any) {
      alert("APV transaction restricted: " + err.message);
    }
  };

  const handleApplyFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.manageTreasury) return;

    try {
      const match = apvs.find(a => a.id === fundAllocDetails.apvId);
      if (!match) return;

      await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "apvs", match.id), {
        funded: true,
        fundedDate: fundAllocDetails.date
      });

      await dispatchAuditLog('FUND', 'APV', match.id, `Allocated funds clearing APV target of ${formatCurrency(match.amount)}.`);
      setIsFundModalOpen(false);
    } catch (err: any) {
      alert("Clearance refused: " + err.message);
    }
  };

  const handleUnfundAPV = async (apv: APV) => {
    if (!permissions.manageTreasury) return;
    try {
      await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "apvs", apv.id), {
        funded: false,
        fundedDate: null
      });

      await dispatchAuditLog('UNFUND', 'APV', apv.id, `Removed funding state from document.`);
    } catch (err: any) {
      alert("Action refused: " + err.message);
    }
  };

  const handleSaveCheckDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.manageTreasury) return;

    try {
      const match = apvs.find(a => a.id === checkAllocId);
      if (!match) return;

      const isCollected = checkDetails.status === 'Collected';

      await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "apvs", match.id), {
        checkNumber: checkDetails.checkNumber,
        checkDate: checkDetails.date,
        releaseDate: isCollected ? checkDetails.date : null,
        checkStatus: checkDetails.status,
        status: isCollected ? 'Paid' : 'Unpaid',
        settledDate: isCollected ? checkDetails.date : null
      });

      // Maintain cascade logic
      if (match.poId) {
        await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "purchases", match.poId), {
          status: isCollected ? 'Paid' : 'Invoiced'
        }).catch(() => {});
      }

      await dispatchAuditLog('UPDATE_CHECK', 'APV', match.id, `Registered Check details ${checkDetails.checkNumber} with status: ${checkDetails.status}`);
      setIsCheckModalOpen(false);
    } catch (err: any) {
      alert("Check details transaction restricted: " + err.message);
    }
  };

  const handleSaveUserAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.systemAdmin) return;

    try {
      const trimmed = userForm.email.trim().toLowerCase();
      await setDoc(doc(db, "artifacts", APP_ID, "public", "data", "appUsers", trimmed), {
        email: trimmed,
        name: userForm.name.trim(),
        department: userForm.department,
        accessLevels: userForm.accessLevels
      }, { merge: true });

      await dispatchAuditLog('UPDATE_ACCESS', 'USER', trimmed, `Set role categories to: [${userForm.accessLevels.join(', ')}]`);
      setIsUserModalOpen(false);
    } catch (err: any) {
      alert("Role changes blocked: " + err.message);
    }
  };

  const handleExecuteDeletion = async () => {
    if (!deletionTarget) return;
    const { id, type } = deletionTarget;

    try {
      if (type === 'PO') {
        if (!permissions.deleteRecords) return;
        await deleteDoc(doc(db, "artifacts", APP_ID, "public", "data", "purchases", id));
        await dispatchAuditLog('DELETE', 'PO', id, `Removed Purchase Order document.`);
      } else if (type === 'APV') {
        if (!permissions.deleteRecords) return;
        const target = apvs.find(a => a.id === id);
        await deleteDoc(doc(db, "artifacts", APP_ID, "public", "data", "apvs", id));
        await dispatchAuditLog('DELETE', 'APV', id, `Removed APV voucher.`);

        // Revert PO status if empty
        if (target && target.poId) {
          const others = apvs.filter(a => a.poId === target.poId && a.id !== id);
          if (others.length === 0) {
            await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "purchases", target.poId), {
              status: 'Pending'
            }).catch(() => {});
          }
        }
      } else if (type === 'USER') {
        if (!permissions.systemAdmin) return;
        await deleteDoc(doc(db, "artifacts", APP_ID, "public", "data", "appUsers", id));
        await dispatchAuditLog('REMOVE_ACCESS', 'USER', id, `Revoked specific client security access.`);
      }
      setDeletionTarget(null);
    } catch (err: any) {
      alert("Remove transaction failed: " + err.message);
    }
  };

  const handleClearDatabase = async () => {
    if (!permissions.systemAdmin) return;
    try {
      // Clear purchases in batches
      const batch = writeBatch(db);
      purchases.forEach(p => {
        batch.delete(doc(db, "artifacts", APP_ID, "public", "data", "purchases", p.id));
      });
      apvs.forEach(a => {
        batch.delete(doc(db, "artifacts", APP_ID, "public", "data", "apvs", a.id));
      });
      await batch.commit();
      await dispatchAuditLog('CLEAR_ALL', 'SYSTEM', 'DATABASE', `Wiped database records.`);
      setPurchases([]);
      setApvs([]);
      setIsClearModalOpen(false);
    } catch (e: any) {
      alert("Clean batch execution restricted: " + e.message);
    }
  };

  // Image base64 compression file upload
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Exceeds 10MB document threshold.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let w = img.width;
        let h = img.height;

        if (w > h && w > MAX) {
          h *= MAX / w;
          w = MAX;
        } else if (h > MAX) {
          w *= MAX / h;
          h = MAX;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setPoForm(prev => ({ ...prev, attachmentData: compressed }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // CSV Import implementation
  const [importType, setImportType] = useState<'purchases' | 'apvs' | 'checks'>('purchases');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStatusMsg, setCsvStatusMsg] = useState('');

  const executeCsvImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !permissions.systemAdmin) return;

    setCsvStatusMsg('Processing dynamic structures...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("Incorrect structure layout.");
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const batch = writeBatch(db);

        let recordsAdded = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          const entry: any = {};
          headers.forEach((hdr, idx) => {
            const val = cols[idx] ? cols[idx].trim().replace(/^"|"$/g, '') : '';
            entry[hdr] = val;
          });

          if (!entry.id && !entry.apvId) continue;

          // Numeric conversions
          if (entry.amount !== undefined) {
            entry.amount = Number(String(entry.amount).replace(/[^0-9.-]+/g, "") || 0);
          }

          if (importType === 'purchases') {
            entry.prReceivedDate = standardizeDate(entry.prReceivedDate);
            entry.date = standardizeDate(entry.date) || new Date().toISOString().split('T')[0];
            entry.contractDate = standardizeDate(entry.contractDate);
            entry.grossAmount = Number(String(entry.grossAmount).replace(/[^0-9.-]+/g, "") || entry.amount);
            entry.discountAmount = Number(String(entry.discountAmount).replace(/[^0-9.-]+/g, "") || 0);
            entry.paymentTerms = entry.paymentTerms || 'Standard Terms (30 days)';
            entry.status = 'Pending';
            
            const docRef = doc(db, "artifacts", APP_ID, "public", "data", "purchases", entry.id);
            batch.set(docRef, entry);
            recordsAdded++;
          } else if (importType === 'apvs') {
            entry.invoiceDate = standardizeDate(entry.invoiceDate) || new Date().toISOString().split('T')[0];
            entry.dueDate = standardizeDate(entry.dueDate) || new Date().toISOString().split('T')[0];
            entry.settledDate = standardizeDate(entry.settledDate) || null;
            entry.fundedDate = standardizeDate(entry.fundedDate) || null;
            entry.status = entry.status || 'Unpaid';
            entry.paymentTerms = entry.paymentTerms || 'Standard Terms (30 days)';
            entry.funded = entry.status === 'Paid' ? true : (String(entry.funded).toLowerCase() === 'true');

            const docRef = doc(db, "artifacts", APP_ID, "public", "data", "apvs", entry.id);
            batch.set(docRef, entry);
            recordsAdded++;
          } else if (importType === 'checks') {
            const targetApvId = entry.apvId || entry.id;
            if (!targetApvId) continue;

            const checkNum = entry.checkNumber || entry.checkNum || '';
            const checkDt = standardizeDate(entry.checkDate || entry.date || '') || new Date().toISOString().split('T')[0];
            const checkSt = entry.checkStatus || 'Check Created';
            const isColl = checkSt === 'Collected';

            const docRef = doc(db, "artifacts", APP_ID, "public", "data", "apvs", targetApvId);
            batch.set(docRef, {
              checkNumber: checkNum,
              checkDate: checkDt,
              checkStatus: checkSt,
              releaseDate: isColl ? checkDt : null,
              settledDate: isColl ? checkDt : null,
              funded: isColl ? true : false,
              status: isColl ? 'Paid' : 'Unpaid'
            }, { merge: true });
            recordsAdded++;
          }
        }

        await batch.commit();
        await dispatchAuditLog('IMPORT', 'BATCH', importType.toUpperCase(), `Imported ${recordsAdded} elements.`);
        setCsvStatusMsg(`Success! Imported ${recordsAdded} rows.`);
        setTimeout(() => {
          setIsImportModalOpen(false);
          setCsvFile(null);
          setCsvStatusMsg('');
        }, 1500);
      } catch (err: any) {
        setCsvStatusMsg('Format mismatch. Validate column headers.');
      }
    };
    reader.readAsText(csvFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    if (!file) {
      setCsvStatusMsg('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
          
          let detected: 'purchases' | 'apvs' | 'checks' = 'purchases';
          
          if (headers.includes('apvid') || headers.includes('checknumber') || headers.includes('checkstatus') || headers.includes('checkdate')) {
            detected = 'checks';
          } else if (headers.includes('poid') || headers.includes('invoicedate') || headers.includes('duedate')) {
            detected = 'apvs';
          } else if (headers.includes('prreceiveddate') || headers.includes('grossamount') || headers.includes('discountamount') || headers.includes('description')) {
            detected = 'purchases';
          } else {
            if (headers.some(h => h.includes('poid') || h.includes('due'))) {
              detected = 'apvs';
            } else if (headers.some(h => h.includes('check') || h.includes('apv'))) {
              detected = 'checks';
            }
          }
          
          setImportType(detected);
          setCsvStatusMsg(`Auto-detected Format: ${
            detected === 'purchases' ? 'Purchase Orders Registry (POs)' : 
            detected === 'apvs' ? 'Accounts Payable Vouchers (APVs)' : 
            'Check Particulars & Treasury details'
          }`);
        }
      } catch (err) {
        console.error("Format detection error", err);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = (type: 'purchases' | 'apvs' | 'checks') => {
    let headers = '';
    let content = '';
    let filename = '';
    
    if (type === 'purchases') {
      headers = 'id,vendor,date,description,amount,grossAmount,discountAmount,prReceivedDate,contractDate,prRequestor,processorName,remarks';
      content = 'EMI-PO-2026-601,Apex Tech Solutions,2026-06-01,Hardware Supply for Server Room Upgrade,150000,160000,10000,2026-05-20,2026-05-28,John Doe,Alice Smith,Approved by VP Finance\nEMI-PO-2026-602,Prime Logistics,2026-06-02,Air Freight Handling,85000,85000,0,2025-05-22,2025-05-29,Mark Johnson,Alice Smith,Urgent dispatch';
      filename = 'PO_Upload_Template.csv';
    } else if (type === 'apvs') {
      headers = 'id,poId,vendor,invoiceDate,dueDate,amount,paymentTerms,status';
      content = 'EMI-APV-2026-601,EMI-PO-2026-601,Apex Tech Solutions,2026-06-05,2026-07-05,150000,Standard Terms (30 days),Unpaid\nEMI-APV-2026-602,EMI-PO-2026-601,Apex Tech Solutions,2026-06-10,2026-07-10,10000,PDC,Paid';
      filename = 'APV_Upload_Template.csv';
    } else if (type === 'checks') {
      headers = 'apvId,checkNumber,checkDate,checkStatus';
      content = 'EMI-APV-2026-601,CHK-99101,2026-07-01,Check Created\nEMI-APV-2026-602,CHK-99102,2026-06-12,Collected';
      filename = 'Check_Details_Upload_Template.csv';
    }
    
    const csvStr = `${headers}\n${content}`;
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Complete export
  const triggerCsvExport = () => {
    if (!permissions.exportData) return;
    
    let csvData = [
      ["PO Ref", "PR Received Date", "PO Created Date", "Contract Settle", "PO Vendor", "Net Price (PHP)", "PO Status", "APV Number", "Invoice Date", "APV Due Date", "Check Tag", "Check Status", "Settled Date"].join(",")
    ];

    purchases.forEach(p => {
      const linked = apvs.filter(a => a.poId === p.id);
      if (linked.length > 0) {
        linked.forEach(a => {
          csvData.push([
            p.id, p.prReceivedDate || '', p.date, p.contractDate || '', `"${p.vendor}"`, p.amount, p.status || 'Pending',
            a.id, a.invoiceDate, a.dueDate, a.checkNumber || '', a.checkStatus || 'Pending Check', a.settledDate || ''
          ].join(","));
        });
      } else {
        csvData.push([
          p.id, p.prReceivedDate || '', p.date, p.contractDate || '', `"${p.vendor}"`, p.amount, p.status || 'Pending',
          '', '', '', '', 'Awaiting APV', ''
        ].join(","));
      }
    });

    const blob = new Blob([csvData.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `EMI_Report_Portfolio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  // State checks for Check allocations target IDs
  const [checkAllocId, setCheckAllocId] = useState('');

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white">
        <Loader2 size={40} className="animate-spin text-indigo-500 mb-3" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Authenticating System...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AuthPage onSuccess={(em) => { setUserEmail(em); setIsLoggedIn(true); }} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      {/* Mobile Drawer Backdrops */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Desktop sleek sidebar navigation panel */}
      <aside className={`fixed inset-y-0 left-0 bg-slate-900 text-slate-350 z-50 w-64 flex flex-col transform transition-transform duration-300 lg:translate-x-0 lg:relative ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow">EMI</div>
            <div>
              <h2 className="text-sm font-black text-white tracking-widest">EMI MONITORING</h2>
              <p className="text-[9px] text-slate-500">Corporate Portal Panel</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Modular Access Categories */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 smooth-scroll">
          {[
            { id: 'dashboard', label: 'Monitor Dashboard', icon: LayoutDashboard, view: permissions.viewReports },
            { id: 'purchases', label: 'Purchase Orders', icon: ShoppingCart, view: permissions.viewPo },
            { id: 'apvs', label: 'Accounts Payable', icon: FileText, view: permissions.viewApv },
            { id: 'treasury', label: 'Treasury Desk', icon: Wallet, view: permissions.viewTreasury },
            { id: 'funding', label: 'Cash Positions', icon: CalendarDays, view: permissions.viewReports },
            { id: 'aging', label: 'Aging Matrix', icon: Clock, view: permissions.viewReports }
          ].filter(item => item.view).map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white font-black' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}

          {/* System settings and admin utilities */}
          {permissions.systemAdmin && (
            <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-1">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3.5 block mb-1">Superuser space</span>
              <button
                onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                  activeTab === 'users' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users size={16} /> User Management
              </button>
              <button
                onClick={() => { setActiveTab('logs'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                  activeTab === 'logs' ? 'bg-purple-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <History size={16} /> Audit Journals
              </button>
            </div>
          )}
        </nav>

        {/* Bottom bar profile & CSV operations */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800/50 space-y-2.5 shrink-0 text-xs">
          {permissions.exportData && (
            <button 
              onClick={triggerCsvExport}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition text-[11px] font-bold cursor-pointer"
            >
              <Download size={13} /> Complete Export
            </button>
          )}

          {permissions.systemAdmin && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-900/40 hover:bg-emerald-800 text-emerald-400 rounded-lg transition text-[11px] font-bold cursor-pointer"
              >
                <Upload size={13} /> Import CSV file
              </button>
              <button 
                onClick={() => setIsClearModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/30 hover:bg-red-800 text-red-300 rounded-lg transition text-[11px] font-bold cursor-pointer"
              >
                <Trash2 size={13} /> Clear Board Data
              </button>
            </>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 text-slate-400">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] block opacity-60">OPERATOR UID</span>
              <span className="text-[11px] font-bold text-white truncate block font-mono" title={userEmail}>{userEmail}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 hover:text-red-400 transition cursor-pointer"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container workspace */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-4 shrink-0">
          <div className="flex items-center gap-3 truncate">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-600 p-1 rounded-md hover:bg-slate-100">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight capitalize truncate">
                {activeTab === 'apvs' ? 'Accounts Payable' : activeTab.replace('-', ' ')}
              </h1>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest hidden sm:block">EMI Enterprise workspace system</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full max-w-xs sm:max-w-md ml-auto justify-end">
            <div className="relative w-full max-w-xs">
              <input 
                type="text" 
                placeholder="Global Search records..." 
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 text-xs py-1.5 pl-8 pr-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-semibold focus:bg-white"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            <select 
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-250 text-slate-700 text-[10px] sm:text-xs py-1.5 pl-2 pr-7 rounded-lg outline-none cursor-pointer hidden sm:block focus:bg-white focus:ring-1"
            >
              <option value="All">All Period</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Primary View Router */}
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6 smooth-scroll relative pb-20 lg:pb-6 bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: 0.15 }}
              className="max-w-7xl mx-auto w-full"
            >
              {activeTab === 'dashboard' && (
                <DashboardView 
                  purchases={purchases} 
                  apvs={apvs} 
                  dbError={dataError} 
                  dbErrorMessage={dataErrorMessage} 
                  onViewPoExceptions={() => {
                    setPoSpecialFilter('No APV');
                    setActiveTab('purchases');
                  }}
                />
              )}

              {(activeTab === 'purchases' || activeTab === 'apvs') && (
                <RecordsView 
                  purchases={purchases}
                  apvs={apvs}
                  activeSubTab={activeTab}
                  permissions={permissions}
                  globalSearch={globalSearch}
                  selectedMonth={selectedMonth}
                  poSpecialFilter={poSpecialFilter}
                  onChangePoSpecialFilter={setPoSpecialFilter}
                  onAddPo={() => {
                    setSelectedPo(null);
                    setPoForm({ id: '', vendor: '', description: '', amount: 0, grossAmount: 0, discountAmount: 0, paymentTerms: 'Standard Terms (30 days)', date: new Date().toISOString().split('T')[0], prReceivedDate: '', contractDate: '', prRequestor: '', processorName: '', remarks: '', attachmentData: '' });
                    setIsPoModalOpen(true);
                  }}
                  onEditPo={(po) => {
                    setSelectedPo(po);
                    setPoForm({ ...po, remarks: po.remarks || '', attachmentData: po.attachmentData || '' });
                    setIsPoModalOpen(true);
                  }}
                  onDeletePo={(id) => setDeletionTarget({ id, type: 'PO' })}
                  onAddApv={() => {
                    setSelectedApv(null);
                    setApvForm({ id: '', poId: '', vendor: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], amount: 0, funded: false, paymentTerms: 'Standard Terms (30 days)', status: 'Unpaid' });
                    setIsApvModalOpen(true);
                  }}
                  onEditApv={(apv) => {
                    setSelectedApv(apv);
                    setApvForm(apv);
                    setIsApvModalOpen(true);
                  }}
                  onDeleteApv={(id) => setDeletionTarget({ id, type: 'APV' })}
                  onViewAttachment={(url) => setViewingAttachmentUrl(url)}
                />
              )}

              {activeTab === 'treasury' && (
                <TreasuryView 
                  apvs={apvs}
                  permissions={permissions}
                  globalSearch={globalSearch}
                  selectedMonth={selectedMonth}
                  onOpenFundModal={(apv) => {
                    setFundAllocDetails({ apvId: apv ? apv.id : '', date: new Date().toISOString().split('T')[0] });
                    setIsFundModalOpen(true);
                  }}
                  onOpenCheckModal={(apv) => {
                    setCheckAllocId(apv ? apv.id : '');
                    setCheckDetails({
                      apvId: apv ? apv.id : '',
                      checkNumber: apv?.checkNumber || '',
                      date: apv?.checkDate || new Date().toISOString().split('T')[0],
                      status: apv?.checkStatus || 'Check Created'
                    });
                    setIsCheckModalOpen(true);
                  }}
                  onUnfund={handleUnfundAPV}
                />
              )}

              {(activeTab === 'funding' || activeTab === 'aging') && (
                <ReportsView 
                  purchases={purchases}
                  apvs={apvs}
                  activeSubTab={activeTab}
                  permissions={permissions}
                  globalSearch={globalSearch}
                />
              )}

              {(activeTab === 'users' || activeTab === 'logs') && (
                <AdminPane 
                  appUsers={appUsers}
                  auditLogs={auditLogs}
                  activeSubTab={activeTab}
                  onEditUserAccess={(usr) => {
                    setSelectedUser(usr);
                    setUserForm({ email: usr.email, name: usr.name || '', department: usr.department || 'Purchasing', accessLevels: usr.accessLevels || [] });
                    setIsUserModalOpen(true);
                  }}
                  onDeleteUser={(em) => setDeletionTarget({ id: em, type: 'USER' })}
                  onAddUserManually={() => {
                    setSelectedUser(null);
                    setUserForm({ email: '', name: '', department: 'Purchasing', accessLevels: [13] });
                    setIsUserModalOpen(true);
                  }}
                  globalSearch={globalSearch}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Elegant mobile-fluent quick thumb navigation bar on bottom viewports */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 shadow-lg flex items-center justify-around px-2 lg:hidden z-30">
          {[
            { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard, view: permissions.viewReports },
            { id: 'purchases', label: 'POs', icon: ShoppingCart, view: permissions.viewPo },
            { id: 'apvs', label: 'APVs', icon: FileText, view: permissions.viewApv },
            { id: 'treasury', label: 'Treasury', icon: Wallet, view: permissions.viewTreasury }
          ].filter(item => item.view).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors ${
                activeTab === item.id ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <item.icon size={18} />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------
          MODALS & OVERLAY STRUCTURES
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {/* Attachment Image Modal Viewer */}
        {viewingAttachmentUrl && (
          <div 
            onClick={() => setViewingAttachmentUrl(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl w-full h-full max-h-[85vh] bg-white rounded-xl overflow-hidden p-2 flex flex-col justify-center items-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <img src={viewingAttachmentUrl} alt="Attached Document" className="max-w-full max-h-[75vh] object-contain rounded" />
              <button 
                onClick={() => setViewingAttachmentUrl(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </motion.div>
          </div>
        )}

        {/* PO Form Modal */}
        {isPoModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-slate-150 flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="font-extrabold text-slate-800 text-sm">{selectedPo ? 'Update' : 'Register'} Purchase Order</span>
                <button onClick={() => setIsPoModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-250/20"><X size={18} /></button>
              </div>

              <form onSubmit={handleSavePurchaseOrder} className="p-5 space-y-4 overflow-y-auto smooth-scroll flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">PO Link Reference/ID *</label>
                    <input 
                      required 
                      type="text" 
                      value={poForm.id} 
                      onChange={e => setPoForm({ ...poForm, id: e.target.value })} 
                      disabled={!!selectedPo}
                      placeholder="e.g. EMI-PO-2026-009"
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-bold disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vendor name *</label>
                    <input 
                      required 
                      type="text" 
                      value={poForm.vendor} 
                      onChange={e => setPoForm({ ...poForm, vendor: e.target.value })} 
                      placeholder="Corporate supplier Ltd"
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Product Description details *</label>
                  <textarea 
                    required 
                    value={poForm.description} 
                    onChange={e => setPoForm({ ...poForm, description: e.target.value })} 
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                    placeholder="Provide description..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-indigo-50/20 rounded-xl border border-indigo-150/20">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gross pricing (₱)</label>
                    <input 
                      type="number" 
                      value={poForm.grossAmount || ''} 
                      onChange={e => {
                        const gross = Number(e.target.value);
                        const discount = Number(poForm.discountAmount || 0);
                        setPoForm({ ...poForm, grossAmount: gross, amount: Math.max(0, gross - discount) });
                      }}
                      className="w-full bg-white border border-slate-200 text-xs py-2 px-2.5 rounded-lg font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 text-emerald-600">Discounts (₱)</label>
                    <input 
                      type="number" 
                      value={poForm.discountAmount || ''} 
                      onChange={e => {
                        const disc = Number(e.target.value);
                        const gross = Number(poForm.grossAmount || 0);
                        setPoForm({ ...poForm, discountAmount: disc, amount: Math.max(0, gross - disc) });
                      }}
                      className="w-full bg-white border border-slate-200 text-xs py-2 px-2.5 rounded-lg font-mono outline-none text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">Net Charge (₱)</label>
                    <input 
                      required 
                      type="number" 
                      readOnly
                      value={poForm.amount || ''} 
                      className="w-full bg-slate-100 border border-slate-200 text-xs py-2 px-2.5 rounded-lg font-bold font-mono outline-none text-indigo-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment terms</label>
                    <select 
                      value={poForm.paymentTerms} 
                      onChange={e => setPoForm({ ...poForm, paymentTerms: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none cursor-pointer"
                    >
                      <option value="Standard Terms (30 days)">Standard Terms (30 days)</option>
                      <option value="15 Days">15 Days</option>
                      <option value="COD">COD</option>
                      <option value="PDC">PDC</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">PR Received on</label>
                    <input 
                      type="date" 
                      value={poForm.prReceivedDate || ''} 
                      onChange={e => setPoForm({ ...poForm, prReceivedDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">PO Generation date *</label>
                    <input 
                      required
                      type="date" 
                      value={poForm.date} 
                      onChange={e => setPoForm({ ...poForm, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Schedules contract date</label>
                    <input 
                      type="date" 
                      value={poForm.contractDate || ''} 
                      onChange={e => setPoForm({ ...poForm, contractDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sourcing Personnel</label>
                    <input 
                      type="text" 
                      placeholder="Processor name..."
                      value={poForm.processorName || ''} 
                      onChange={e => setPoForm({ ...poForm, processorName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Attachment files (Max 10MB)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleAttachmentUpload}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Remarks</label>
                  <textarea 
                    value={poForm.remarks || ''} 
                    onChange={e => setPoForm({ ...poForm, remarks: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none min-h-[50px]"
                    placeholder="Enter special remarks..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button type="button" onClick={() => setIsPoModalOpen(false)} className="px-4 py-2 text-xs font-semibold hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer">Save Order</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* APV Form Modal */}
        {isApvModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-auto border border-slate-150"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="font-extrabold text-slate-800 text-sm">{selectedApv ? 'Update' : 'Create'} APV Record</span>
                <button onClick={() => setIsApvModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full"><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveAPV} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">APV Voucher Number *</label>
                  <input 
                    required 
                    type="text" 
                    value={apvForm.id} 
                    onChange={e => setApvForm({ ...apvForm, id: e.target.value })} 
                    disabled={!!selectedApv}
                    placeholder="e.g. EMI-APV-2026-101"
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-bold disabled:opacity-60"
                  />
                </div>

                <div className="relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Associated Purchase Order ref *</label>
                  <input 
                    required 
                    list="apv-po-list"
                    value={apvForm.poId} 
                    onChange={e => {
                      const val = e.target.value;
                      setApvForm(prev => ({ ...prev, poId: val }));
                      const matchedPo = purchases.find(p => p.id === val);
                      if (matchedPo && !selectedApv) {
                        setApvForm(prev => ({ 
                          ...prev, 
                          vendor: matchedPo.vendor, 
                          amount: matchedPo.amount, 
                          paymentTerms: matchedPo.paymentTerms || 'Standard Terms (30 days)' 
                        }));
                      }
                    }}
                    placeholder="Select or enter PO Number..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                  />
                  <datalist id="apv-po-list">
                    {purchases.map(p => <option key={p.id} value={p.id}>{p.vendor}</option>)}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vendor name *</label>
                  <input 
                    required 
                    type="text" 
                    value={apvForm.vendor} 
                    onChange={e => setApvForm({ ...apvForm, vendor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">APV Charge amount *</label>
                    <input 
                      required 
                      type="number" 
                      value={apvForm.amount || ''} 
                      onChange={e => setApvForm({ ...apvForm, amount: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none font-bold font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment terms</label>
                    <input 
                      type="text" 
                      value={apvForm.paymentTerms} 
                      onChange={e => setApvForm({ ...apvForm, paymentTerms: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Invoice Generation date *</label>
                    <input 
                      required 
                      type="date" 
                      value={apvForm.invoiceDate} 
                      onChange={e => {
                        const inv = e.target.value;
                        let due = apvForm.dueDate;
                        if (inv && apvForm.paymentTerms === 'Standard Terms (30 days)') {
                          const date = new Date(inv);
                          date.setDate(date.getDate() + 30);
                          due = date.toISOString().split('T')[0];
                        }
                        setApvForm(prev => ({ ...prev, invoiceDate: inv, dueDate: due }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Effective Due date *</label>
                    <input 
                      required 
                      type="date" 
                      value={apvForm.dueDate} 
                      onChange={e => setApvForm({ ...apvForm, dueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Action Status Override</label>
                  <select 
                    value={apvForm.status} 
                    onChange={e => setApvForm({ ...apvForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none bg-white cursor-pointer"
                  >
                    <option value="Unpaid">Unpaid / Open</option>
                    <option value="Paid">Paid / Settled</option>
                  </select>
                </div>

                {apvForm.status === 'Paid' && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-150 relative animate-in fade-in">
                    <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block mb-1">Settlement confirmation date *</label>
                    <input 
                      required 
                      type="date" 
                      value={apvForm.settledDate || ''} 
                      onChange={e => setApvForm({ ...apvForm, settledDate: e.target.value })}
                      className="w-full bg-white border border-emerald-300 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setIsApvModalOpen(false)} className="px-4 py-2 text-xs font-semibold hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer">Save Voucher</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Bulk CSV Import Modal */}
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden text-xs"
            >
              <div className="p-4 border-b border-rose-100 flex justify-between items-center bg-rose-50/25">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-bold text-[9px] uppercase tracking-wider">Bulk Sync</div>
                  <span className="font-extrabold text-slate-800 text-sm">Automated CSV Data Importer</span>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"><X size={18} /></button>
              </div>

              <form onSubmit={executeCsvImport} className="p-5 space-y-4">
                
                {/* 1. DOWNLOAD THE TEMPLATE */}
                <div>
                  <label className="font-bold text-slate-700 block mb-2 uppercase tracking-wider text-[10px] text-indigo-600">
                    1. Download sample CSV format templates
                  </label>
                  <p className="text-slate-500 mb-2.5 text-[11px] leading-relaxed">
                    Download any required model structure layout below, input your records, and upload the file.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button 
                      type="button" 
                      onClick={() => downloadTemplate('purchases')}
                      className="p-2.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 rounded-lg text-left transition duration-150 flex flex-col justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-700 text-[11px] group-hover:text-indigo-900">Purchase Orders</div>
                        <div className="text-slate-450 text-[9px] mt-0.5 leading-snug">Configure PO numbers, vendors, isPR and amounts</div>
                      </div>
                      <div className="mt-2 text-indigo-650 hover:text-indigo-800 font-extrabold text-[9px] flex items-center gap-1">
                        <Download size={11} /> Grab PO CSV
                      </div>
                    </button>

                    <button 
                      type="button" 
                      onClick={() => downloadTemplate('apvs')}
                      className="p-2.5 bg-slate-50 hover:bg-fuchsia-50 hover:border-fuchsia-200 border border-slate-200 rounded-lg text-left transition duration-150 flex flex-col justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-700 text-[11px] group-hover:text-fuchsia-900">APV Vouchers</div>
                        <div className="text-slate-450 text-[9px] mt-0.5 leading-snug">Vouchers, invoices, aging categories and dues</div>
                      </div>
                      <div className="mt-2 text-fuchsia-650 hover:text-fuchsia-800 font-extrabold text-[9px] flex items-center gap-1">
                        <Download size={11} /> Grab APV CSV
                      </div>
                    </button>

                    <button 
                      type="button" 
                      onClick={() => downloadTemplate('checks')}
                      className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-lg text-left transition duration-150 flex flex-col justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-700 text-[11px] group-hover:text-amber-900">Check Details</div>
                        <div className="text-slate-450 text-[9px] mt-0.5 leading-snug">Map check number, date & status directly to APVs</div>
                      </div>
                      <div className="mt-2 text-amber-650 hover:text-amber-800 font-extrabold text-[9px] flex items-center gap-1">
                        <Download size={11} /> Grab Check CSV
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. FILE UPLOAD & AUTO-DECTECT INDICATOR */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block mb-1 uppercase tracking-wider text-[10px] text-fuchsia-600">
                    2. Upload CSV & Auto-Detect System
                  </label>
                  <p className="text-slate-500 mb-2.5 text-[11px]">
                    Drop or pick your file. The system automatically inspects headers and routes the records to PO, APV, or Check Details models.
                  </p>

                  <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50/50 transition-colors">
                    <input 
                      required 
                      type="file" 
                      id="csv-file-picker"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <Upload size={24} className="mx-auto text-slate-400" />
                      <div className="text-[11px] font-bold text-slate-700">
                        {csvFile ? csvFile.name : 'Click to browse or drop CSV file'}
                      </div>
                      <div className="text-[9px] text-slate-400">Allowed extension format: .csv only</div>
                    </div>
                  </div>
                </div>

                {/* target destination check/override */}
                <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-600 uppercase text-[9px] tracking-wider">Manual Destination Override:</span>
                    <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-150 capitalize">
                      {importType === 'purchases' ? 'Purchase Orders' : importType === 'apvs' ? 'APV Vouchers' : 'Checks & Treasury'}
                    </span>
                  </div>
                  
                  <select 
                    value={importType} 
                    onChange={e => setImportType(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="purchases">Force Target: Purchase Orders (POs)</option>
                    <option value="apvs">Force Target: Accounts Payable (APVs)</option>
                    <option value="checks">Force Target: Check Details (Direct Mapping)</option>
                  </select>

                  <div className="text-slate-450 text-[9px] leading-normal font-mono break-all bg-white p-2 rounded border border-slate-100">
                    <span className="font-bold text-slate-700">Required Header: </span>
                    {importType === 'purchases' 
                      ? 'id, vendor, date, description, amount, grossAmount, discountAmount, prReceivedDate, contractDate, Remarks'
                      : importType === 'apvs'
                      ? 'id, poId, vendor, invoiceDate, dueDate, amount, paymentTerms, status'
                      : 'apvId, checkNumber, checkDate, checkStatus'
                    }
                  </div>
                </div>

                {csvStatusMsg && (
                  <div className={`p-2.5 rounded-lg text-center font-bold font-mono text-[10px] border shadow-xs ${csvStatusMsg.includes('Success') ? 'bg-emerald-50 text-emerald-800 border-emerald-250 animate-pulse' : csvStatusMsg.includes('Auto-detected') ? 'bg-indigo-50 text-indigo-900 border-indigo-150 font-bold' : 'bg-rose-50 text-rose-800 border-rose-150'}`}>
                    {csvStatusMsg}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
                  <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-3.5 py-2 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-600 font-semibold">Cancel</button>
                  <button type="submit" className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer hover:shadow transition">Execute Data Load</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deletionTarget && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border-t-4 border-red-600 max-w-sm w-full shadow-2xl p-5 text-center"
            >
              <AlertTriangle className="text-red-600 mx-auto mb-3" size={32} />
              <h3 className="font-black text-slate-800 text-base">Confirm Permanent Deletion?</h3>
              <p className="text-xs text-slate-500 mt-1">Are you sure you want to permanently delete {deletionTarget.type} identifier <b>{deletionTarget.id}</b>?</p>
              <p className="text-xs text-red-600 font-extrabold mt-2 bg-red-50 p-2 rounded">This action will trigger an irreversible event log.</p>

              <div className="mt-5 flex gap-2 justify-center">
                <button onClick={() => setDeletionTarget(null)} className="px-4 py-2 hover:bg-slate-150 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
                <button onClick={handleExecuteDeletion} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer">Delete Permanent</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clear Database Dialog */}
        {isClearModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border-t-4 border-red-600 max-w-sm w-full shadow-2xl p-5 text-center"
            >
              <AlertTriangle className="text-red-600 mx-auto mb-3" size={32} />
              <h3 className="font-black text-slate-800 text-base">WIPE EVERYTHING?</h3>
              <p className="text-xs text-slate-500 mt-1">This will permanently flush all POs and APVs inside the system.</p>

              <div className="mt-5 flex gap-2 justify-center">
                <button onClick={() => setIsClearModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
                <button onClick={handleClearDatabase} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer">Wipe Board</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Budget Funding Allocation Modal */}
        {isFundModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 15, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 font-bold text-slate-800">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><Landmark size={14} className="text-indigo-600" /> Fund Clearance allocation</span>
                <button onClick={() => setIsFundModalOpen(false)} className="text-slate-400 p-1"><X size={14} /></button>
              </div>

              <form onSubmit={handleApplyFunding} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target APV Number *</label>
                  <input 
                    required 
                    list="fund-apv-list"
                    value={fundAllocDetails.apvId} 
                    onChange={e => setFundAllocDetails({ ...fundAllocDetails, apvId: e.target.value })}
                    placeholder="Search/Enter APV Number..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                  <datalist id="fund-apv-list">
                    {apvs.filter(a => !a.funded && a.status !== 'Paid').map(a => (
                      <option key={a.id} value={a.id}>{a.vendor} ({formatCurrency(a.amount)})</option>
                    ))}
                  </datalist>
                </div>

                {(() => {
                  const match = apvs.find(a => a.id === fundAllocDetails.apvId);
                  return match ? (
                    <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-150/20 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">VENDOR:</span>
                        <span className="font-extrabold text-slate-800 truncate max-w-[150px]">{match.vendor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">NET AMOUNT:</span>
                        <span className="font-black text-indigo-700 font-mono">{formatCurrency(match.amount)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Clearing Allocation date *</label>
                  <input 
                    required 
                    type="date" 
                    value={fundAllocDetails.date} 
                    onChange={e => setFundAllocDetails({ ...fundAllocDetails, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
                  <button type="button" onClick={() => setIsFundModalOpen(false)} className="px-3.5 py-1.5 bg-slate-150 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!apvs.some(a => a.id === fundAllocDetails.apvId)} className="px-4.5 py-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition cursor-pointer">Allocate Clearance</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Check Assignment Modal */}
        {isCheckModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 text-slate-800 font-bold text-slate-800">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><FileSignature size={14} className="text-indigo-600" /> Assign Corporate Check params</span>
                <button onClick={() => setIsCheckModalOpen(false)} className="text-slate-400 p-1"><X size={14} /></button>
              </div>

              <form onSubmit={handleSaveCheckDetails} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target APV code *</label>
                  <input 
                    required 
                    list="check-apv-list"
                    value={checkAllocId} 
                    onChange={e => {
                      const val = e.target.value;
                      setCheckAllocId(val);
                      const matched = apvs.find(a => a.id === val);
                      if (matched) {
                        setCheckDetails({
                          apvId: matched.id,
                          checkNumber: matched.checkNumber || '',
                          date: matched.checkDate || new Date().toISOString().split('T')[0],
                          status: matched.checkStatus || 'Check Created'
                        });
                      }
                    }}
                    placeholder="Search/Enter APV ID..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none text-slate-800 font-extrabold font-mono"
                  />
                  <datalist id="check-apv-list">
                    {apvs.map(a => (
                      <option key={a.id} value={a.id}>{a.vendor} ({formatCurrency(a.amount)})</option>
                    ))}
                  </datalist>
                </div>

                {(() => {
                  const match = apvs.find(a => a.id === checkAllocId);
                  return match ? (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-150 text-[11px] space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">BENEFICIARY:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[180px]" title={match.vendor}>{match.vendor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">LIABILITY:</span>
                        <span className="font-extrabold text-indigo-700">{formatCurrency(match.amount)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Check Serial Number *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. CHK-1192"
                      value={checkDetails.checkNumber} 
                      onChange={e => setCheckDetails({ ...checkDetails, checkNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 font-mono">Drawing Date *</label>
                    <input 
                      required
                      type="date" 
                      value={checkDetails.date} 
                      onChange={e => setCheckDetails({ ...checkDetails, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Check Desk Status *</label>
                  <select 
                    value={checkDetails.status} 
                    onChange={e => setCheckDetails({ ...checkDetails, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none cursor-pointer bg-white font-semibold"
                  >
                    <option value="Check Created">Check Created (Unfunded/Awaiting pick-up)</option>
                    <option value="Collected">Collected / Released (Resolves APV to paid status)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsCheckModalOpen(false)} className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-250 text-slate-650 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!apvs.some(a => a.id === checkAllocId)} className="px-5 py-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer">Save check particulars</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* User Roles Management Modal */}
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 text-slate-800 font-bold text-slate-800">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><Shield size={14} className="text-emerald-600" /> Edit User Role particulars</span>
                <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 p-1"><X size={14} /></button>
              </div>

              <form onSubmit={handleSaveUserAccess} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Staff Account email *</label>
                  <input 
                    required 
                    type="email" 
                    value={userForm.email} 
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })} 
                    disabled={!!selectedUser}
                    placeholder="user@emi-management.com"
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 font-mono">Staff Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={userForm.name} 
                    onChange={e => setUserForm({ ...userForm, name: e.target.value })} 
                    placeholder="Associate name"
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
                  <select 
                    value={userForm.department} 
                    onChange={e => setUserForm({ ...userForm, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg bg-white outline-none cursor-pointer"
                  >
                    <option value="Purchasing">Purchasing</option>
                    <option value="AP">AP</option>
                    <option value="Treasury">Treasury</option>
                    <option value="Business Development">Business Development</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Access authorizations map</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {[
                      { l: 3, txt: 'Admin / Owner: Absolute credentials view/write' },
                      { l: 4, txt: 'Treasury Desk: Manage cash positions & check serials' },
                      { l: 2, txt: 'Procurement Desk: Configure and edit Purchase Orders (POs)' },
                      { l: 5, txt: 'Accounts Payable (AP) Desk: Configure and edit APV vouchers (APVs)' },
                      { l: 1, txt: 'Export Permission: Access CSV structure extraction' },
                      { l: 10, txt: 'View POs subcategory' },
                      { l: 11, txt: 'View APVs subcategory' },
                      { l: 12, txt: 'View Treasury subcategory' },
                      { l: 13, txt: 'View Reports subcategory' },
                    ].map(node => {
                      const active = (userForm.accessLevels || []).includes(node.l);
                      return (
                        <label key={node.l} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded border border-slate-150 cursor-pointer text-[10px] hover:bg-slate-100 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={active}
                            onChange={(e) => {
                              let copy = [...(userForm.accessLevels || [])];
                              if (e.target.checked) {
                                if (!copy.includes(node.l)) copy.push(node.l);
                              } else {
                                copy = copy.filter(i => i !== node.l);
                              }
                              setUserForm({ ...userForm, accessLevels: copy });
                            }}
                            className="text-indigo-650 rounded border-slate-300"
                          />
                          <span className="font-semibold text-slate-700 leading-tight">{node.txt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
                  <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm cursor-pointer">Save Role Config</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
