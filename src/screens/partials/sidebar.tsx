import { useAtom } from "jotai";
import { appPage } from "@/store/jotai.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClipboardList,
  faMotorcycle,
  faUtensils,
  faUsers,
  faPowerOff
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils.ts";
import { useNavigate } from "react-router";
import {
  DELIVERY,
  ONLINE_ORDERS,
  LOGIN,
  MENU,
  ORDERS,
  HOME
} from "@/routes/posr.ts";
import { getUserModules } from "@/lib/access.rules.ts";
import logoImage from "@/assets/images/logo.jpg";

export const Sidebar = () => {
  const [page, setPage] = useAtom(appPage);
  const pathInfo = location.pathname;
  const navigation = useNavigate();

  const logout = () => {
    setPage(prev => ({
      ...prev,
      page: 'Login',
      user: undefined
    }));
    navigation(LOGIN);
  };

  const userModules = getUserModules(page.user);

  const sidebarItems = [
    { title: "Browse Menu", icon: <FontAwesomeIcon icon={faUtensils} size="lg"/>, link: MENU, module: "Menu" },
    { title: "Track Orders", icon: <FontAwesomeIcon icon={faClipboardList} size="lg"/>, link: ORDERS, module: "Orders" },
    { title: "Online Orders", icon: <FontAwesomeIcon icon={faMotorcycle} size="lg"/>, link: ONLINE_ORDERS, module: "Delivery" },
    { title: "Customer Hub", icon: <FontAwesomeIcon icon={faUsers} size="lg"/>, link: DELIVERY, module: "Delivery" },
  ].filter(item => !item.module || userModules.includes(item.module));


  return (
    <div className="flex flex-col justify-between h-screen items-center py-6 border-r border-[#e4c590]/15 bg-[#0e0d0c]/95 backdrop-blur-xl text-white shadow-[4px_0_24px_rgba(0,0,0,0.7)]">
      <div className="w-full flex flex-col items-center gap-8">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center justify-center cursor-pointer select-none" onClick={() => navigation(HOME)}>
          <img src={logoImage} alt="Sai Silver Logo" className="w-16 h-16 object-contain hover:scale-105 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(228,197,144,0.25)]" />
        </div>

        {/* Navigation Items */}
        <div className="w-full px-3 flex flex-col gap-3">
          {sidebarItems.map(item => {
            const isActive = pathInfo === item.link;
            return (
              <button
                onClick={() => navigation(item.link)}
                className={cn(
                  'flex flex-col items-center justify-center text-center cursor-pointer py-3.5 px-2 gap-1.5 rounded-2xl transition-all duration-300 border border-transparent w-full relative group',
                  isActive 
                    ? 'bg-gradient-to-tr from-[#e4c590]/15 to-[#c8a973]/5 border-[#e4c590]/25 text-[#e4c590] shadow-[0_8px_16px_rgba(228,197,144,0.1)]' 
                    : 'text-slate-400 hover:text-[#e4c590] hover:bg-white/5'
                )}
                key={item.title}
              >
                {/* Glowing bar for active state */}
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r bg-[#e4c590] shadow-[0_0_8px_#e4c590]"></div>
                )}
                <span className={cn(
                  "transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-[#e4c590]" : "text-slate-400"
                )}>
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold tracking-wide">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Area with Logout */}
      <div className="w-full px-4 flex flex-col items-center gap-4">
        {page.user && (
          <div className="flex flex-col items-center text-center px-1">
            <div className="w-8 h-8 rounded-full bg-[#1b1c1d] border border-[#e4c590]/30 flex items-center justify-center font-bold text-sm text-[#e4c590]">
              {page.user.first_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-[10px] text-slate-300 font-bold mt-1.5 truncate max-w-[80px]">
              {page.user.first_name}
            </span>
          </div>
        )}
        <button 
          onClick={logout} 
          className="w-10 h-10 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-600 hover:border-transparent flex items-center justify-center transition-all duration-300 hover:shadow-[0_4px_16px_rgba(239,68,68,0.2)]"
          title="Logout"
        >
          <FontAwesomeIcon icon={faPowerOff} />
        </button>
      </div>
    </div>
  );
};
