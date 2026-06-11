import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Building, 
  Eye, 
  EyeOff, 
  Shield, 
  Loader2, 
  Sparkles 
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface AuthPageProps {
  onSuccess: (email: string) => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Purchasing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (userCredential.user && userCredential.user.email) {
        onSuccess(userCredential.user.email);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message.includes('auth/') ? 'Invalid email or password.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      
      // Default modular access lists based on department choice
      let defaultAccess = [13]; // View-only reports by default
      if (department === 'Purchasing' || department === 'AP') {
        defaultAccess = [2, 10, 11, 13];
      } else if (department === 'Treasury') {
        defaultAccess = [4, 12, 13];
      } else if (department === 'Business Development') {
        defaultAccess = [10, 11, 12, 13];
      }

      await setDoc(doc(db, "artifacts", "emi-site-monitoring", "public", "data", "appUsers", trimmedEmail), {
        email: trimmedEmail,
        name: name.trim(),
        department: department,
        accessLevels: defaultAccess
      });

      if (userCredential.user && userCredential.user.email) {
        onSuccess(userCredential.user.email);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const prefillDemoAdmin = () => {
    setEmail('admin@emi.com');
    setPassword('emi123456');
    setName('Demo Admin');
    setIsRegistering(false);
  };

  const prefillDemoStaff = () => {
    setEmail('procurement@emi.com');
    setPassword('emi123456');
    setName('Demo Staff');
    setIsRegistering(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-900 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 120 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md shadow-indigo-100 mb-3">
            EMI
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            {isRegistering ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 text-center">
            {isRegistering ? 'Register for system access' : 'Sign in to access EMI Site Monitoring panel'}
          </p>
        </div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200 text-center"
          >
            {errorMsg}
          </motion.div>
        )}

        {isRegistering ? (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Full Name</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><UserIcon size={16} /></div>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="Juan Dela Cruz" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Department</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><Building size={16} /></div>
                <select 
                  required 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                >
                  <option value="Purchasing">Purchasing</option>
                  <option value="AP">AP</option>
                  <option value="Treasury">Treasury</option>
                  <option value="Business Development">Business Development</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Email Address</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><Mail size={16} /></div>
                <input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><Lock size={16} /></div>
                <input 
                  required 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  minLength={6} 
                  className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="••••••••" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 text-slate-400 hover:text-slate-600 outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-right">Minimum 6 characters.</p>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition shadow-md disabled:bg-slate-400 flex items-center justify-center cursor-pointer text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : 'Sign Up'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Email Address</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><Mail size={16} /></div>
                <input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="name@company.com" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400"><Lock size={16} /></div>
                <input 
                  required 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="••••••••" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 text-slate-400 hover:text-slate-600 outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition shadow-md disabled:bg-slate-400 flex items-center justify-center cursor-pointer text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button 
            type="button" 
            onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); }} 
            className="text-xs text-indigo-600 font-bold hover:underline"
          >
            {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>

        {/* Demo Prefills Container (Professional UX touch) */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider mb-2">
            Workspace Preview Credentials
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={prefillDemoAdmin}
              type="button" 
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-medium transition cursor-pointer"
            >
              <Sparkles size={11} /> Admin Mock
            </button>
            <button 
              onClick={prefillDemoStaff} 
              type="button" 
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium transition cursor-pointer"
            >
              <UserIcon size={11} /> Staff Mock
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center text-[10px] text-slate-400">
          <Shield size={12} className="mr-1" /> Protected by Firebase IAM
        </div>
      </motion.div>
    </div>
  );
}
