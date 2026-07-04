import React, { useEffect, useState, useMemo, useRef } from "react";
import { Layout } from "@/screens/partials/layout.tsx";
import { useDB } from "@/api/db/db.ts";
import { Tables } from "@/api/db/tables.ts";
import { Order, OrderStatus } from "@/api/model/order.ts";
import { User } from "@/api/model/user.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPhone,
  faUser,
  faComments,
  faInfoCircle,
  faSearch,
  faBiking,
  faCheckCircle,
  faUtensils,
  faMotorcycle,
  faPlus,
  faSyncAlt,
  faPaperPlane,
  faClipboardList,
  faMicrophone,
  faMicrophoneSlash,
  faRobot,
  faVolumeUp,
  faVolumeMute,
  faPhoneSlash,
  faPlay,
  faHeadset
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Modal } from "@/components/common/react-aria/modal.tsx";
import { RecordId, StringRecordId } from "surrealdb";
import { cn } from "@/lib/utils.ts";
import { useAtom } from "jotai";
import { appPage } from "@/store/jotai.ts";
import { getUserModules } from "@/lib/access.rules.ts";
import { Navigate } from "react-router";
import { MENU } from "@/routes/posr.ts";

export const OnlineOrders = () => {
  const [pageState] = useAtom(appPage);
  const userModules = getUserModules(pageState.user);

  if (!userModules.includes('Delivery') && !userModules.includes('Admin')) {
    return <Navigate to={MENU} replace />;
  }

  const db = useDB();
  const [activeMainTab, setActiveMainTab] = useState<'current' | 'online' | 'advance'>('online');
  const [activeChannel, setActiveChannel] = useState<'all' | 'direct'>('all');
  
  const [searchText, setSearchText] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [sortBy, setSortBy] = useState<'latest' | 'amount'>('latest');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isRiderOpen, setIsRiderOpen] = useState(false);

  // Riders state
  const [riders, setRiders] = useState<User[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");

  // Fetch orders from SurrealDB
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const [allOrders] = await db.query(
        `SELECT * FROM ${Tables.orders} ORDER BY created_at DESC FETCH customer, user, items, items.item`
      );
      setOrders(allOrders as Order[]);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // Fetch riders
  const fetchRiders = async () => {
    try {
      const [result] = await db.query(
        `SELECT * FROM ${Tables.users} WHERE deleted_at = none AND array::find(user_role.roles, 'Riders') != None ORDER BY first_name ASC`
      );
      setRiders(result as User[]);
    } catch (error) {
      console.error("Failed to fetch riders:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRiders();

    // Listen to order updates
    let liveSub: any;
    db.live(Tables.orders, () => {
      fetchOrders();
    }).then(sub => {
      liveSub = sub;
    });

    return () => {
      if (liveSub) liveSub.kill();
    };
  }, []);

  // Filter orders based on active tabs, channel filters, search text
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const delivery = order.delivery || {};
      const channel = delivery.channel || "";
      const isOnlineOrder = channel.toLowerCase() === 'direct' || order.tags?.includes('Online');
      const isAdvanceOrder = order.tags?.includes('Advance');

      // 1. Tab Filter
      if (activeMainTab === 'online') {
        if (!isOnlineOrder) return false;
      } else if (activeMainTab === 'advance') {
        if (!isAdvanceOrder) return false;
      } else {
        // Current orders (dine-in table orders or general delivery that aren't online/advance aggregators)
        if (isOnlineOrder || isAdvanceOrder) return false;
      }

      // 2. Channel Filter (only applies on online orders tab)
      if (activeMainTab === 'online') {
        if (activeChannel === 'direct' && channel.toLowerCase() !== 'direct') return false;
      }

      // 3. Search text filters
      if (searchText) {
        const query = searchText.toLowerCase();
        const customerName = order.customer?.name?.toLowerCase() || "";
        const customerPhone = order.customer?.phone ? String(order.customer.phone).toLowerCase() : "";
        const orderId = delivery.order_id || order.id.toString();
        const invoiceNum = order.invoice_number?.toString() || "";
        if (!customerName.includes(query) && !customerPhone.includes(query) && !orderId.toLowerCase().includes(query) && !invoiceNum.includes(query)) {
          return false;
        }
      }

      // 4. Order ID Filter input
      if (orderIdFilter) {
        const orderId = delivery.order_id || "";
        if (!orderId.includes(orderIdFilter)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'amount') {
        const totalA = (a.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalB = (b.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return totalB - totalA;
      }
      // default: latest date
      const dateA = new Date(a.created_at as any).getTime();
      const dateB = new Date(b.created_at as any).getTime();
      return dateB - dateA;
    });
  }, [orders, activeMainTab, activeChannel, searchText, orderIdFilter, sortBy]);

  // Color mappings based on status
  const getStatusColorConfig = (status: string) => {
    switch (status) {
      case 'Pending':
        return {
          bg: 'bg-cyan-50 border-cyan-200 text-cyan-700',
          indicator: 'bg-cyan-400',
          actionBg: 'bg-cyan-500 hover:bg-cyan-600 text-white'
        };
      case 'Cancelled':
        return {
          bg: 'bg-red-50 border-red-200 text-red-700',
          indicator: 'bg-red-500',
          actionBg: 'bg-red-500 hover:bg-red-600 text-white'
        };
      case 'Food Ready':
      case 'Ready':
        return {
          bg: 'bg-green-50 border-green-200 text-green-700',
          indicator: 'bg-green-500',
          actionBg: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'Dispatched':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          indicator: 'bg-amber-400',
          actionBg: 'bg-amber-500 hover:bg-amber-600 text-white'
        };
      case 'Delivered':
      case 'Paid':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          indicator: 'bg-emerald-600',
          actionBg: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        };
      default:
        return {
          bg: 'bg-neutral-50 border-neutral-200 text-neutral-600',
          indicator: 'bg-neutral-400',
          actionBg: 'bg-neutral-500 hover:bg-neutral-600 text-white'
        };
    }
  };

  // Mark currently selected or first pending order as food ready
  const markFoodReady = async (orderId?: string) => {
    const targetOrderId = orderId || selectedOrder?.id?.toString() || filteredOrders.find(o => o.status === 'Pending')?.id?.toString();
    if (!targetOrderId) {
      toast.error("No pending order selected or available.");
      return;
    }

    try {
      await db.merge(targetOrderId, {
        status: 'Food Ready',
        delivery: {
          ...orders.find(o => o.id.toString() === targetOrderId)?.delivery,
          state: 'food_ready',
          status: 'Food Ready'
        }
      });
      toast.success("Order marked as Food Ready!");
      fetchOrders();
      if (selectedOrder && selectedOrder.id.toString() === targetOrderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'Food Ready' } : null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    }
  };



  // Update rider
  const updateRider = async () => {
    if (!selectedOrder || !selectedRiderId) return;
    try {
      const rider = riders.find(r => r.id.toString() === selectedRiderId) as any;
      if (!rider) return;

      await db.merge(selectedOrder.id, {
        status: 'Dispatched',
        delivery: {
          ...selectedOrder.delivery,
          state: 'rider_assigned',
          status: 'Dispatched',
          rider: {
            first_name: rider.first_name,
            last_name: rider.last_name || "",
            phone: rider.phone || "+91 99887 76655"
          }
        }
      });
      toast.success("Rider details updated and order dispatched!");
      setIsRiderOpen(false);
      fetchOrders();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update rider");
    }
  };

  // Simulate test orders
  const generateMock = async () => {
    try {
      const [floors] = await db.query(`SELECT id FROM floor LIMIT 1`);
      const [tables] = await db.query(`SELECT id FROM floor_table LIMIT 1`);
      const [users] = await db.query(`SELECT id FROM user LIMIT 1`);
      const [orderTypes] = await db.query(`SELECT id FROM order_type WHERE name = 'Delivery' LIMIT 1`);

      if (!floors.length || !tables.length || !users.length) {
        toast.error("Basic DB seeding (floors, tables, users) is required first!");
        return;
      }

      const randomId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const randomInvoice = Math.floor(1000 + Math.random() * 9000);
      const randomBill = Math.floor(10 + Math.random() * 90);
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      const customerName = ["Amit Verma", "Sanjay Dutt", "Kapil Dev", "Rita Roy", "Pawan Kalyan", "Rishabh Pant", "M.S. Dhoni", "Sunil Chhetri"][Math.floor(Math.random() * 8)];

      const [customer] = await db.create(Tables.customers, {
        name: customerName,
        phone: "+91 99112 " + Math.floor(10000 + Math.random() * 90000),
        address: "restaurant delivery address, Hyderabad, India",
      });

      // Fetch sample menu item
      const [menuItems] = await db.query(`SELECT id, price, name FROM menu_item LIMIT 1`);
      let items: any[] = [];
      let itemPrice = 250;
      if (menuItems.length > 0) {
        const [orderItem] = await db.create(Tables.order_items, {
          item: new RecordId('menu_item', menuItems[0].id.id),
          price: menuItems[0].price,
          quantity: 1,
          created_at: new Date(),
        });
        items.push(orderItem.id);
        itemPrice = menuItems[0].price;
      }

      const orderData = {
        floor: floors[0].id,
        covers: 1,
        tags: ['Direct', 'Online'],
        customer: customer.id,
        order_type: orderTypes.length ? orderTypes[0].id : new RecordId('order_type', 'delivery'),
        status: 'Pending',
        invoice_number: randomInvoice,
        auto_id: randomInvoice,
        items: items,
        table: tables[0].id,
        user: users[0].id,
        created_at: new Date(),
        delivery: {
          channel: "Direct",
          order_id: randomId,
          bill_no: randomBill,
          otp: otp,
          status: 'Pending',
          state: 'pending',
          instructions: "Please make it spicy and deliver hot.",
          rider: null
        },
        tax_amount: Math.round(itemPrice * 0.05),
        discount_amount: 0,
        service_charge_amount: 0
      };

      await db.create(Tables.orders, orderData);
      toast.success(`Mock Direct order #${randomId} generated!`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate mock order");
    }
  };

  return (
    <Layout overflowHidden>
      <div className="flex flex-col h-screen bg-[#0e0d0c] text-[#a6a6a6]">
        
        {/* Top Header Section */}
        <div className="bg-[#141515] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#e4c590]/15">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#e4c590]/40 flex items-center justify-center bg-white">
                <img src="/logo.jpg" alt="Sai Silver Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-lg font-black leading-none tracking-wider text-[#e4c590] font-serif-luxury uppercase">Sai Silver Dum Biryani POSS</h1>
                <span className="text-[9px] text-[#e4c590]/60 font-bold uppercase tracking-[0.2em] font-serif-luxury">Online / Delivery Orders</span>
              </div>
            </div>
            
            {/* New Order / Menu Button */}
            <a href="/menu" className="grilli-btn grilli-btn-filled text-[10px] px-3.5 py-1.5 rounded uppercase tracking-wider transition-colors ml-4">
              + New Order
            </a>
          </div>

          {/* Search Bars */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 text-xs">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input 
                type="text" 
                placeholder="Search Bill No."
                className="bg-[#0e0d0c] border border-white/10 rounded text-xs text-white pl-8 pr-3 py-1.5 w-36 focus:outline-none focus:border-[#e4c590]"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 text-xs">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input 
                type="text" 
                placeholder="Search KOT No."
                className="bg-[#0e0d0c] border border-white/10 rounded text-xs text-white pl-8 pr-3 py-1.5 w-36 focus:outline-none focus:border-[#e4c590]"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            
            <button onClick={fetchOrders} className="bg-[#161718] border border-white/5 hover:bg-[#1b1c1d] hover:text-[#e4c590] p-2 px-3 rounded text-xs transition-colors">
              <FontAwesomeIcon icon={faSyncAlt} /> Refresh
            </button>
          </div>
        </div>

        {/* Dashboard Tabs Bar */}
        <div className="bg-[#141515] border-b border-[#e4c590]/15 px-5 flex items-center justify-between select-none">
          <div className="flex">
            <button
              onClick={() => setActiveMainTab('current')}
              className={cn(
                "py-3.5 px-6 font-bold text-sm border-b-4 uppercase tracking-wider transition-all font-serif-luxury",
                activeMainTab === 'current' ? "border-[#e4c590] text-[#e4c590]" : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              Current Order
            </button>
            <button
              onClick={() => setActiveMainTab('online')}
              className={cn(
                "py-3.5 px-6 font-bold text-sm border-b-4 uppercase tracking-wider transition-all font-serif-luxury",
                activeMainTab === 'online' ? "border-[#e4c590] text-[#e4c590]" : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              Online Order
            </button>
            <button
              onClick={() => setActiveMainTab('advance')}
              className={cn(
                "py-3.5 px-6 font-bold text-sm border-b-4 uppercase tracking-wider transition-all font-serif-luxury",
                activeMainTab === 'advance' ? "border-[#e4c590] text-[#e4c590]" : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              Advance Order
            </button>
          </div>

          {/* Food Ready Action */}
          {activeMainTab === 'online' && (
            <button 
              onClick={() => markFoodReady()}
              className="grilli-btn grilli-btn-filled text-[10px] px-5 py-2"
            >
              Food Ready
            </button>
          )}
        </div>

        {/* Filter & Sub-Header Controls */}
        <div className="bg-[#0e0d0c] border-b border-[#e4c590]/10 px-5 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
          {activeMainTab === 'online' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveChannel('all')}
                className={cn(
                  "grilli-pill",
                  activeChannel === 'all' && "active"
                )}
              >
                All
              </button>
              <button
                onClick={() => setActiveChannel('direct')}
                className={cn(
                  "grilli-pill",
                  activeChannel === 'direct' && "active"
                )}
              >
                Direct Delivery
              </button>

              <span className="h-6 w-[1px] bg-white/10 mx-2"></span>

              {/* Quick simulation buttons */}
              <button onClick={() => generateMock()} className="grilli-btn text-[9px] py-1 px-3 border-[#e4c590]/35 text-[#e4c590]">
                + Simulate Direct Order
              </button>
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-serif-luxury">
              {activeMainTab === 'current' ? "Active Dine-in Table Sessions" : "Future Dated Booking Orders"}
            </div>
          )}

          {/* Sorting and Filter Fields */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-serif-luxury">Sort:</span>
              <select
                className="bg-[#161718] border border-white/10 rounded text-xs px-2.5 py-1 text-slate-300 font-semibold focus:outline-none focus:border-[#e4c590]"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="latest">Latest Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Filter by Order ID..."
              className="bg-[#161718] border border-white/10 rounded text-xs px-3 py-1 w-44 text-white placeholder-slate-600 focus:outline-none focus:border-[#e4c590]"
              value={orderIdFilter}
              onChange={(e) => setOrderIdFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Legend row */}
        {activeMainTab === 'online' && (
          <div className="bg-[#141515] border-b border-[#e4c590]/10 px-5 py-2.5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 select-none">
            <span className="text-[10px] text-[#e4c590]/60 uppercase tracking-widest font-extrabold mr-1 font-serif-luxury">Status Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Pending
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Cancelled
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Food is Ready
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Dispatched
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Delivered / Finished
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1b1c1d] border border-white/10"></span> KOT / Bill Created
            </div>
          </div>
        )}

        {/* Orders List Container */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-neutral-500 text-sm font-semibold">Loading aggregator orders...</span>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredOrders.map(order => {
                const delivery = order.delivery || {};
                const channel = delivery.channel || "Direct";
                const isDirect = channel.toLowerCase() === 'direct' || channel.toLowerCase() === 'online';
                const statusColors = getStatusColorConfig(order.status);
                const orderTotal = (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                return (
                  <div key={order.id.toString()} className="grilli-card flex transition-all duration-150 relative overflow-hidden">
                    
                    {/* Left Column: Channel info */}
                    <div className="p-4 flex flex-col justify-between border-r border-[#e4c590]/10 min-w-[180px] bg-[#161718]/45">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "w-7 h-7 rounded-full text-slate-950 flex items-center justify-center font-bold text-sm select-none",
                            isDirect ? "bg-[#e4c590]" : "bg-slate-400"
                          )}>
                            {isDirect ? 'D' : 'O'}
                          </span>
                          <span className="text-xs font-bold text-white uppercase tracking-wider font-serif-luxury">{channel}</span>
                        </div>
                        <span className="text-[9px] bg-[#e4c590]/10 text-[#e4c590] font-bold px-2.5 py-0.5 rounded-full select-none uppercase border border-[#e4c590]/20">
                          {order.status === 'Pending' ? 'Delivery' : order.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase leading-none font-serif-luxury">Order ID</p>
                        <p className="text-sm font-extrabold text-white tracking-tight leading-tight">{delivery.order_id || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Middle Column: Order Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1 font-serif-luxury">Customer</p>
                          <p className="text-sm font-bold text-white leading-tight font-serif-luxury">{order.customer?.name || "Aggregator Customer"}</p>
                          <a 
                            href={`tel:${order.customer?.phone || ""}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#e4c590] font-bold hover:underline mt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FontAwesomeIcon icon={faPhone} className="text-[9px]" /> Call Customer
                          </a>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1 font-serif-luxury">Order Placed At</p>
                          <p className="text-xs font-semibold text-slate-300">
                            {order.created_at ? new Date(order.created_at as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                            <span className="text-slate-500 ml-1.5">| {order.created_at ? new Date(order.created_at as any).toLocaleDateString([], { day: '2-digit', month: 'short' }) : ""}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 border-t border-[#e4c590]/10 pt-3">
                        <span>Bill No: <span className="text-white">{delivery.bill_no || order.invoice_number}</span></span>
                        <span className="w-1.5 h-1.5 bg-[#e4c590]/20 rounded-full"></span>
                        <span>OTP: <span className="bg-[#0e0d0c] border border-[#e4c590]/15 px-2 py-0.5 rounded font-black text-[#e4c590] tracking-wider text-[11px]">{delivery.otp || "N/A"}</span></span>
                        {delivery.instructions && (
                          <>
                            <span className="w-1.5 h-1.5 bg-[#e4c590]/20 rounded-full"></span>
                            <span className="text-slate-400 font-medium italic truncate max-w-sm">Inst: "{delivery.instructions}"</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Pricing Column */}
                    <div className="p-4 flex flex-col justify-center items-end border-l border-r border-[#e4c590]/10 w-36 bg-[#161718]/45">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1 font-serif-luxury">Total Pay</p>
                      <p className="text-lg font-black text-[#e4c590]">₹{orderTotal + (order.tax_amount || 0)}</p>
                      <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Paid Online</span>
                    </div>

                    {/* Actions Column */}
                    <div className="p-4 flex flex-col gap-1.5 justify-center w-52 border-l border-[#e4c590]/10 bg-[#141515]/30">
                      <div className="flex items-center gap-1.5 mb-1.5 px-1">
                        <span className={cn("w-2 h-2 rounded-full", statusColors.indicator)}></span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{order.status}</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsDetailsOpen(true);
                        }}
                        className="bg-[#0e0d0c] hover:bg-[#161718] border border-[#e4c590]/25 text-[#e4c590] hover:text-white font-bold text-xs py-1.5 px-3 rounded flex justify-between items-center transition-colors w-full text-left"
                      >
                        <span>View Details</span>
                        <FontAwesomeIcon icon={faClipboardList} className="text-[#e4c590]/60 text-[10px]" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsStatusOpen(true);
                        }}
                        className="bg-[#0e0d0c] hover:bg-[#161718] border border-[#e4c590]/25 text-[#e4c590] hover:text-white font-bold text-xs py-1.5 px-3 rounded border border-[#e4c590]/25 transition-colors w-full text-left flex justify-between items-center"
                      >
                        <span>Delivery Status</span>
                        <FontAwesomeIcon icon={faBiking} className="text-[#e4c590]/60 text-[10px]" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setSelectedRiderId(order.delivery?.rider?.id?.toString() || "");
                          setIsRiderOpen(true);
                        }}
                        className="bg-[#0e0d0c] hover:bg-[#161718] border border-[#e4c590]/25 text-[#e4c590] hover:text-white font-bold text-xs py-1.5 px-3 rounded border border-[#e4c590]/25 transition-colors w-full text-left flex justify-between items-center"
                      >
                        <span>Update Rider Details</span>
                        <FontAwesomeIcon icon={faUser} className="text-[#e4c590]/60 text-[10px]" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-white rounded-xl border border-neutral-200 text-center select-none shadow-sm">
              <FontAwesomeIcon icon={faMotorcycle} className="text-neutral-300 text-5xl" />
              <div>
                <h3 className="text-lg font-bold text-neutral-800">No Orders Found</h3>
                <p className="text-sm text-neutral-500 max-w-sm mt-1">
                  There are no orders matching the search criteria or active filters currently. Try generating mock orders to test!
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => generateMock()} className="btn btn-secondary font-semibold text-xs py-2 px-4 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded">
                  + Mock Direct Order
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 1. Modal: View Details */}
      <Modal
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={`Online Order Details`}
        size="md"
      >
        {selectedOrder && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="flex justify-between font-bold border-b border-neutral-100 pb-2 mb-2">
                <span className="text-neutral-500 uppercase text-xs tracking-wider">Item Name</span>
                <span className="text-neutral-500 uppercase text-xs tracking-wider">Qty × Price</span>
              </div>
              <div className="flex flex-col gap-3">
                {selectedOrder.items && selectedOrder.items.length > 0 && typeof selectedOrder.items[0] === 'object' ? (
                  selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-neutral-800">{item.item?.name || 'Unknown Item'}</p>
                        {item.comments && <span className="text-xs text-neutral-400">"{item.comments}"</span>}
                      </div>
                      <span className="font-bold text-neutral-700">{item.quantity} × ₹{item.price}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-neutral-800">Special Dum Biryani Combo (Online)</span>
                    <span className="font-bold text-neutral-700">1 × ₹250</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-neutral-200 flex flex-col gap-2 font-semibold text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-neutral-800">₹{(selectedOrder.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (GST 5%)</span>
                <span className="text-neutral-800">₹{selectedOrder.tax_amount || 0}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-2 font-bold text-base text-neutral-800">
                <span>Final Amount</span>
                <span className="text-primary-700">₹{(selectedOrder.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) + (selectedOrder.tax_amount || 0)}</span>
              </div>
            </div>

            {selectedOrder.delivery?.instructions && (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-900">
                <p className="font-bold text-xs uppercase tracking-wider mb-1">Rider Instructions</p>
                <p className="italic">"{selectedOrder.delivery.instructions}"</p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              {selectedOrder.status === 'Pending' && (
                <button
                  onClick={() => {
                    markFoodReady(selectedOrder.id.toString());
                    setIsDetailsOpen(false);
                  }}
                  className="btn btn-primary bg-green-600 hover:bg-green-700 text-white border-transparent py-2 px-4 text-xs font-bold rounded uppercase tracking-wider"
                >
                  Mark Food Ready
                </button>
              )}
              <button onClick={() => setIsDetailsOpen(false)} className="btn btn-secondary border border-neutral-300 py-2 px-4 text-xs font-bold rounded uppercase tracking-wider">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Modal: Delivery Status Tracking */}
      <Modal
        open={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        title="Aggregator Delivery Progress Tracker"
        size="md"
      >
        {selectedOrder && (
          <div className="p-4 flex flex-col gap-6 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-lg">
                <FontAwesomeIcon icon={faBiking} />
              </div>
              <div>
                <h4 className="font-bold text-neutral-800">Order ID: #{selectedOrder.delivery?.order_id}</h4>
                <p className="text-xs text-neutral-400 font-medium">Channel: {selectedOrder.delivery?.channel} | Rider: {selectedOrder.delivery?.rider?.first_name || "Unassigned"}</p>
              </div>
            </div>

            {/* Stepper timeline */}
            <div className="flex flex-col gap-4 pl-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-200">
              
              {/* Step 1: Placed */}
              <div className="flex gap-4 relative">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold z-10">
                  <FontAwesomeIcon icon={faCheckCircle} />
                </span>
                <div>
                  <h5 className="font-bold text-neutral-800">Order Received & Accepted</h5>
                  <p className="text-xs text-neutral-400">Order logged successfully into POSS.</p>
                </div>
              </div>

              {/* Step 2: Preparing */}
              <div className="flex gap-4 relative">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
                  ['Food Ready', 'Dispatched', 'Delivered'].includes(selectedOrder.status)
                    ? "bg-emerald-600 text-white" 
                    : "bg-primary-500 text-white animate-pulse"
                )}>
                  {['Food Ready', 'Dispatched', 'Delivered'].includes(selectedOrder.status) ? <FontAwesomeIcon icon={faCheckCircle} /> : <FontAwesomeIcon icon={faUtensils} />}
                </span>
                <div>
                  <h5 className="font-bold text-neutral-800">Preparing Food</h5>
                  <p className="text-xs text-neutral-400">Kitchen staff is preparing items.</p>
                </div>
              </div>

              {/* Step 3: Food Ready */}
              <div className="flex gap-4 relative">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
                  ['Dispatched', 'Delivered'].includes(selectedOrder.status)
                    ? "bg-emerald-600 text-white" 
                    : selectedOrder.status === 'Food Ready'
                      ? "bg-primary-500 text-white"
                      : "bg-neutral-200 text-neutral-500"
                )}>
                  {['Dispatched', 'Delivered'].includes(selectedOrder.status) ? <FontAwesomeIcon icon={faCheckCircle} /> : '3'}
                </span>
                <div>
                  <h5 className="font-bold text-neutral-800">Food Ready & Packed</h5>
                  <p className="text-xs text-neutral-400">Food is waiting to be handed over to rider.</p>
                </div>
              </div>

              {/* Step 4: Dispatched */}
              <div className="flex gap-4 relative">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
                  selectedOrder.status === 'Delivered'
                    ? "bg-emerald-600 text-white" 
                    : selectedOrder.status === 'Dispatched'
                      ? "bg-primary-500 text-white animate-pulse"
                      : "bg-neutral-200 text-neutral-500"
                )}>
                  {selectedOrder.status === 'Delivered' ? <FontAwesomeIcon icon={faCheckCircle} /> : '4'}
                </span>
                <div>
                  <h5 className="font-bold text-neutral-800">Rider Dispatched (On the Way)</h5>
                  <p className="text-xs text-neutral-400">Rider has picked up food and is traveling to customer.</p>
                </div>
              </div>

              {/* Step 5: Delivered */}
              <div className="flex gap-4 relative">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
                  selectedOrder.status === 'Delivered' ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-500"
                )}>
                  {selectedOrder.status === 'Delivered' ? <FontAwesomeIcon icon={faCheckCircle} /> : '5'}
                </span>
                <div>
                  <h5 className="font-bold text-neutral-800">Delivered Successfully</h5>
                  <p className="text-xs text-neutral-400">Rider confirmed food delivery at doorstep.</p>
                </div>
              </div>

            </div>

            <div className="flex justify-end mt-2">
              <button onClick={() => setIsStatusOpen(false)} className="btn btn-secondary border border-neutral-300 py-2 px-4 text-xs font-bold rounded uppercase tracking-wider">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 4. Modal: Update Rider Details */}
      <Modal
        open={isRiderOpen}
        onClose={() => setIsRiderOpen(false)}
        title="Update Rider Assignment"
        size="sm"
      >
        {selectedOrder && (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider font-extrabold block mb-1">Current Assigned Rider</label>
              <p className="font-bold text-neutral-800 bg-neutral-100 p-2.5 rounded-lg">
                {selectedOrder.delivery?.rider 
                  ? `${selectedOrder.delivery.rider.first_name} ${selectedOrder.delivery.rider.last_name || ""}` 
                  : "No rider assigned yet"}
              </p>
            </div>

            <div>
              <label className="text-xs text-neutral-400 uppercase tracking-wider font-extrabold block mb-1">Select New Rider</label>
              <select
                className="w-full bg-white border border-neutral-300 p-2.5 rounded-lg font-semibold text-neutral-800 focus:outline-none"
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
              >
                <option value="">-- Select Rider --</option>
                {riders.map((r: any) => (
                  <option key={r.id.toString()} value={r.id.toString()}>
                    {r.first_name} {r.last_name || ""} {r.phone ? `(${r.phone})` : ""}
                  </option>
                ))}
                {/* Fallbacks if db is not seeded */}
                {riders.length === 0 && (
                  <>
                    <option value="user:rider1">Suresh Kumar (Aggregator Fleet)</option>
                    <option value="user:rider2">Ramesh Sharma (Aggregator Fleet)</option>
                    <option value="user:rider3">John Doe (In-house Rider)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-neutral-100">
              <button onClick={() => setIsRiderOpen(false)} className="btn btn-secondary border border-neutral-300 py-2 px-4 text-xs font-bold rounded uppercase tracking-wider">
                Cancel
              </button>
              <button 
                onClick={updateRider}
                className="btn btn-primary bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 text-xs font-bold rounded uppercase tracking-wider"
              >
                Assign & Dispatch
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
