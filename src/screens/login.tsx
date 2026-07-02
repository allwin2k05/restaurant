import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace, faCircle, faClock } from "@fortawesome/free-solid-svg-icons";
import {faCircle as circleRegular} from '@fortawesome/free-regular-svg-icons';
import {useEffect, useLayoutEffect, useState} from "react";
import { useAtom } from "jotai";
import { appPage } from "@/store/jotai.ts";
import { cn } from "@/lib/utils.ts";
import { useDB } from "@/api/db/db.ts";
import { User } from "@/api/model/user.ts";
import {useNavigate} from "react-router";
import {MENU, HOME} from "@/routes/posr.ts";
import { Modal } from "@/components/common/react-aria/modal.tsx";
import { Button } from "@/components/common/input/button.tsx";
import { Tables } from "@/api/db/tables.ts";
import { toast } from "sonner";
import { getUserModules } from "@/lib/access.rules.ts";
import { UserRole } from "@/api/model/user_role.ts";
import { Input } from "@/components/common/input/input.tsx";
import { nowSurrealDateTime } from "@/lib/datetime.ts";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n.ts";

export const Login = () => {
  const db = useDB();
  const { t } = useTranslation('auth');

  const [code, setCode] = useState('');
  const [loginMethod, setLoginMethod] = useState<'pin'|'form'>('pin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [page, setPage] = useAtom(appPage);
  const [error, setError] = useState(false);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const navigation = useNavigate();

  const onClear = () => {
    setCode('');
  }

  const onBack = () => {
    setCode(prev => prev.slice(0, prev.length - 1));
  }

  const onKey = (key: string) => {
    if(code.trim().length <= 3){
      setCode(code + key);
    }
  }

  const checkLogin = async (login: string, pass: string) => {
    if (login.trim().length === 4) {
      const query = `SELECT * from ${Tables.users} where login = $login and deleted_at = none and (login_method = 'pin' OR login_method = NONE) and crypto::bcrypt::compare(password, $password) = true fetch user_role, user_shift`;

      const record: any = await db.query(query, {
        login: login,
        password: pass,
      });

      if(record[0].length > 0){
        const loggedInUser = record[0][0];
        const roleId = typeof loggedInUser.user_role === "object" ? loggedInUser.user_role?.id : loggedInUser.user_role;
        let fetchedRole: UserRole | undefined;

        if (roleId) {
          const [roleRecords]: any = await db.query(`SELECT * FROM ${Tables.user_roles} WHERE id = $roleId AND deleted_at = none LIMIT 1`, {
            roleId,
          });
          fetchedRole = roleRecords?.[0];
        }

        const normalizedUser = {
          ...loggedInUser,
          user_role: fetchedRole || loggedInUser.user_role,
          roles: fetchedRole
            ? [...new Set(fetchedRole.roles || [])]
            : getUserModules(loggedInUser),
        };

        if(page.locked && page.lockedBy?.login !== record[0][0].login){
          denyLogin();
          return false;
        }

        // Check for active time entry
        const timeEntryCheck: any = await db.query(`SELECT * from ${Tables.time_entries} where user = $userId and clock_out = NONE and platform = $platform`, {
          userId: record[0][0].id,
          platform: 'web'
        });

        if(timeEntryCheck[0].length === 0){
          // No active time entry, show clock-in modal
          setPendingUser(normalizedUser);
          setShowClockInModal(true);
        } else {
          // Active time entry exists, proceed with login
          allowLogin(normalizedUser);
        }
      }else{
        denyLogin();
      }
    }
  }

  const allowLogin = (user: User) => {
    setPage(prev => ({
      ...prev,
      page: 'Menu',
      locked: false,
      lockedBy: undefined,
      user: user
    }));

    setCode('');
    setUsername('');
    setPassword('');
    setShowClockInModal(false);
    setPendingUser(null);

    // redirect to menu
    navigation(MENU);
  }

  const handleClockIn = async () => {
    if(!pendingUser) return;

    try {
      const now = nowSurrealDateTime();
      await db.create(Tables.time_entries, {
        clock_in: now,
        user: (pendingUser.id),
        platform: 'web'
      });

      toast.success(i18n.t('auth:clockIn.success'));
      allowLogin(pendingUser);
    } catch (error) {
      toast.error(i18n.t('auth:clockIn.failed'));
      console.error(error);
    }
  }

  const denyLogin = () => {
    setCode('');
    setPassword('');
    setError(true);
  }

  useEffect(() => {
    if (loginMethod === 'pin') {
      checkLogin(code, code);
    }
  }, [code]);

  useEffect(() => {
    if(error){
      setTimeout(() => setError(false), 400);
    }
  }, [error]);

  useLayoutEffect(() => {
    if(page.user && !page.locked){
      navigation(MENU);
    }
  }, [page.user]);

  return (
    <div className="relative">
      <div 
        className="flex justify-center items-center h-screen flex-col gap-6 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "linear-gradient(rgba(14, 13, 12, 0.88), rgba(14, 13, 12, 0.92)), url('/grilli/hero-slider-1.jpg')" }}
      >
        {/* Brand Logo & Title Header */}
        <div className="flex flex-col items-center gap-1 text-center select-none mb-2 cursor-pointer" onClick={() => navigation(HOME)}>
          <div className="w-24 h-24 rounded-full overflow-hidden border border-[#e4c590]/40 flex items-center justify-center bg-white shadow-[0_4px_24px_rgba(228,197,144,0.25)] mb-3 hover:scale-105 transition-transform duration-300">
            <img src="/logo.jpg" alt="Sai Silver Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl text-[#e4c590] tracking-widest font-serif-luxury uppercase">Sai Silver Dum Biryani</h1>
          <span className="text-[11px] uppercase font-bold tracking-[0.25em] text-[#e4c590]/60 mt-1">Point of Sale System</span>
          <div className="grilli-separator w-48"><span></span></div>
        </div>
        
        {page.locked && (
          <div className="bg-amber-950/40 border border-[#e4c590]/20 text-[#e4c590] font-bold text-xs uppercase px-4 py-2 rounded-lg tracking-wider mb-2">
            {t('login.systemLocked', {
              name: `${page?.lockedBy?.first_name ?? ''} ${page?.lockedBy?.last_name ?? ''}`.trim()
            })}
          </div>
        )}
        
        {/* Passcode dots with golden glow */}
        <div className={
          cn(
            "flex gap-4 text-[#e4c590]/25 my-2",
            error && 'login-error'
          )
        }>
          <FontAwesomeIcon size="sm" icon={code.trim().length >= 1 ? faCircle : circleRegular} className={code.trim().length >= 1 ? "text-[#e4c590] drop-shadow-[0_0_8px_rgba(228,197,144,0.8)]" : ""} />
          <FontAwesomeIcon size="sm" icon={code.trim().length >= 2 ? faCircle : circleRegular} className={code.trim().length >= 2 ? "text-[#e4c590] drop-shadow-[0_0_8px_rgba(228,197,144,0.8)]" : ""} />
          <FontAwesomeIcon size="sm" icon={code.trim().length >= 3 ? faCircle : circleRegular} className={code.trim().length >= 3 ? "text-[#e4c590] drop-shadow-[0_0_8px_rgba(228,197,144,0.8)]" : ""} />
          <FontAwesomeIcon size="sm" icon={code.trim().length === 4 ? faCircle : circleRegular} className={code.trim().length === 4 ? "text-[#e4c590] drop-shadow-[0_0_8px_rgba(228,197,144,0.8)]" : ""} />
        </div>
        
        {/* PIN Keyboard */}
        <div className="wrapper w-[320px] sm:w-[360px]">
          <div className="grid grid-cols-3 gap-4 place-items-center">
            <button type="button" onClick={() => onKey('1')} className="btn-login">1</button>
            <button type="button" onClick={() => onKey('2')} className="btn-login">2</button>
            <button type="button" onClick={() => onKey('3')} className="btn-login">3</button>
            <button type="button" onClick={() => onKey('4')} className="btn-login">4</button>
            <button type="button" onClick={() => onKey('5')} className="btn-login">5</button>
            <button type="button" onClick={() => onKey('6')} className="btn-login">6</button>
            <button type="button" onClick={() => onKey('7')} className="btn-login">7</button>
            <button type="button" onClick={() => onKey('8')} className="btn-login">8</button>
            <button type="button" onClick={() => onKey('9')} className="btn-login">9</button>
            <button type="button" onClick={onBack} className="btn-login danger"><FontAwesomeIcon icon={faBackspace}/></button>
            <button type="button" onClick={() => onKey('0')} className="btn-login">0</button>
            <button type="button" onClick={onClear} className="btn-login danger">C</button>
          </div>
        </div>

        {error && (
          <div className="text-red-400 font-bold text-xs uppercase tracking-wider bg-red-950/30 border border-red-500/25 px-4 py-2.5 rounded-lg mt-2 animate-bounce">
            Access Denied: Invalid PIN.
          </div>
        )}
      </div>

      {/* Gold Ambient Radial Glow */}
      <div className="size-[300px] bg-[#e4c590]/5 absolute top-10 right-[15%] rounded-full pointer-events-none transition-all blur-3xl"></div>
      <div className="size-[400px] bg-[#e4c590]/3 absolute bottom-10 left-[10%] rounded-full pointer-events-none transition-all blur-3xl"></div>

      {showClockInModal && (
        <Modal
          open={showClockInModal}
          onClose={() => {
            setShowClockInModal(false);
            setPendingUser(null);
            setCode('');
          }}
          title={t('clockIn.title')}
          shouldCloseOnOverlayClick={false}
          shouldCloseOnEsc={false}
        >
          <div className="flex flex-col gap-6 items-center p-4 bg-[#0e0d0c] text-slate-300 rounded-2xl border border-[#e4c590]/20 max-w-sm">
            <h4 className="text-xl font-bold font-serif-luxury text-[#e4c590] tracking-wider uppercase">{t('clockIn.title')}</h4>
            <div className="text-sm font-semibold text-center text-red-400 bg-red-950/20 border border-red-500/20 p-4 rounded-xl leading-relaxed">
              {t('clockIn.message')}
            </div>
            <button
              onClick={handleClockIn}
              className="grilli-btn grilli-btn-filled w-full font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faClock} />
              {t('clockIn.action')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
