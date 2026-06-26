import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/screens/partials/layout.tsx";
import { Tables } from "@/api/db/tables.ts";
import { Order as OrderModel, OrderStatus } from "@/api/model/order.ts";
import { useDB } from "@/api/db/db.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMotorcycle,
  faBowlFood,
  faClipboardList,
  faHouse,
  faCheckCircle,
  faUser,
  faMapMarkerAlt,
  faPhone,
  faPlus,
  faPaperPlane,
  faArrowRight
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { RecordId } from "surrealdb";
import { useAtom } from "jotai";
import { appPage } from "@/store/jotai.ts";
import { getUserModules } from "@/lib/access.rules.ts";

// Import 3D Scooter Graphic
import scooterImage from "@/assets/images/3d_delivery_scooter.png";
import foodBagImage from "@/assets/images/3d_food_bag.png";

export const Orders = () => {
  const db = useDB();
  const [pageState] = useAtom(appPage);
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderModel | null>(null);
  const [loading, setLoading] = useState(false);

  const userModules = getUserModules(pageState.user);
  const isCustomer = !userModules.includes('Admin') && !userModules.includes('Kitchen') && !userModules.includes('Delivery') && !userModules.includes('Summary') && !userModules.includes('Reports');


  // Rider Chat Mock logs
  const [riderChat, setRiderChat] = useState<Array<{ sender: 'rider' | 'customer', text: string }>>([
    { sender: 'rider', text: "Hello! I am Suresh Kumar, your delivery partner. I am heading to the restaurant to pick up your order." }
  ]);

  // Fetch orders from SurrealDB
  const fetchOrders = useCallback(async () => {
    try {
      const queryStr = isCustomer
        ? `SELECT *, 
                  customer.* as cust_details, 
                  items.* as order_items,
                  items.item.* as dish_details
           FROM ${Tables.orders} 
           WHERE user = $userId
           ORDER BY created_at DESC 
           LIMIT 30`
        : `SELECT *, 
                  customer.* as cust_details, 
                  items.* as order_items,
                  items.item.* as dish_details
           FROM ${Tables.orders} 
           ORDER BY created_at DESC 
           LIMIT 30`;

      const [list] = await db.query(queryStr, {
        userId: pageState.user?.id
      });
      const ordersList = (list as OrderModel[]) || [];
      setOrders(ordersList);
      
      // Keep selected order in sync
      if (selectedOrder) {
        const updated = ordersList.find(o => o.id.toString() === selectedOrder.id.toString());
        if (updated) setSelectedOrder(updated);
      } else if (ordersList.length > 0) {
        setSelectedOrder(ordersList[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [db, selectedOrder, isCustomer, pageState.user?.id]);

  useEffect(() => {
    void fetchOrders();
  }, []);

  // Real-time live query subscription
  useEffect(() => {
    let subscription: any = null;
    const subscribe = async () => {
      subscription = await db.live(Tables.orders, () => {
        void fetchOrders();
      });
    };
    void subscribe();
    return () => {
      if (subscription) {
        subscription.kill().catch(() => undefined);
      }
    };
  }, [db, fetchOrders]);

  // Advance Order Status in SurrealDB
  const advanceOrderStatus = async () => {
    if (!selectedOrder) return;
    let nextStatus: string = "Pending";
    
    if (selectedOrder.status === "Pending") nextStatus = "In Progress";
    else if (selectedOrder.status === "In Progress") nextStatus = "Paid"; // Represents Out for Delivery / Paid
    else if (selectedOrder.status === "Paid") nextStatus = "Completed";

    try {
      setLoading(true);
      await db.merge(selectedOrder.id, { status: nextStatus });
      toast.success(`Order advanced to: ${nextStatus} 🛵`);
      
      // Update local driver chat
      if (nextStatus === "In Progress") {
        setRiderChat(prev => [...prev, { sender: 'rider', text: "Food is being prepared fresh in the kitchen! Smells delicious." }]);
      } else if (nextStatus === "Paid") {
        setRiderChat(prev => [...prev, { sender: 'rider', text: "I have picked up your food and am traveling to your location now!" }]);
      } else if (nextStatus === "Completed") {
        setRiderChat(prev => [...prev, { sender: 'rider', text: "Delivered successfully! Enjoy your delicious Sai Silver Dum Biryani!" }]);
      }
      
      void fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Delivery Mock Order Generator
  const generateMockOrder = async () => {
    try {
      const [floors] = await db.query(`SELECT id FROM floor LIMIT 1`);
      const [tables] = await db.query(`SELECT id FROM floor_table LIMIT 1`);
      const [users] = await db.query(`SELECT id FROM user LIMIT 1`);

      const randomInvoice = Math.floor(1000 + Math.random() * 9000);
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const mockPhone = "+91 99887 " + Math.floor(10000 + Math.random() * 90000).toString();

      const customerName = ["Rajesh Patel", "Anjali Sharma", "Vikram Singh", "Priya Nair"][Math.floor(Math.random() * 4)];

      // Create guest
      const [customer] = await db.create(Tables.customers, {
        name: customerName,
        phone: mockPhone,
        address: "Hyderabad, Telangana, India",
      });

      // Create item
      const [orderItem] = await db.create(Tables.order_items, {
        item: new RecordId('menu_item', 'chicken_biryani'),
        price: 250,
        quantity: 1,
        created_at: new Date(),
      });

      // Create order
      await db.create(Tables.orders, {
        floor: floors[0]?.id || new RecordId('floor', 'main'),
        covers: 1,
        tags: ["Direct", "Online"],
        customer: customer.id,
        order_type: new RecordId('order_type', 'delivery'),
        status: "Pending",
        invoice_number: randomInvoice,
        auto_id: randomInvoice,
        items: [orderItem.id],
        table: tables[0]?.id || new RecordId('floor_table', 'table1'),
        user: users[0]?.id || new RecordId('user', 'admin_5555'),
        created_at: new Date(),
        delivery: {
          channel: "Direct",
          order_id: `DR-` + randomInvoice,
          bill_no: randomInvoice,
          otp: otp,
          status: "Pending",
          delivery_charge: 30,
          instructions: "Call on arrival",
          rider: {
            first_name: "Suresh",
            last_name: "Kumar",
            phone: "+91 98765 43210"
          }
        }
      });

      toast.success(`Simulated new incoming Direct Order!`);
      void fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate mock order.");
    }
  };

  // Determine Animated Scooter coordinate percentage along timeline
  const scooterLeftPercent = useMemo(() => {
    if (!selectedOrder) return 0;
    if (selectedOrder.status === "Pending") return 5;          // Order Placed
    if (selectedOrder.status === "In Progress") return 35;     // Preparing
    if (selectedOrder.status === "Paid") return 70;            // Out for Delivery (Paid state)
    if (selectedOrder.status === "Completed") return 92;       // Delivered
    return 5;
  }, [selectedOrder]);

  return (
    <Layout containerClassName="overflow-hidden">
      <div className="grid grid-cols-[380px_1fr] h-screen bg-[#0e0d0c] text-[#a6a6a6] overflow-hidden font-sans">
        
        {/* Left Side: Orders List */}
        <div className="flex flex-col border-r border-[#e4c590]/10 h-full p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#e4c590] font-serif-luxury uppercase tracking-wider">Orders Board</h2>
              <p className="text-[9px] text-[#e4c590]/60 font-extrabold uppercase tracking-[0.2em] font-serif-luxury">Active Deliveries</p>
            </div>
            {/* Quick Mock generators */}
            {!isCustomer && (
              <div className="flex gap-1">
                <button
                  onClick={() => generateMockOrder()}
                  className="grilli-btn text-[9px] px-2.5 py-1.5 border-[#e4c590]/35 text-[#e4c590]"
                >
                  + Direct Order
                </button>
              </div>
            )}
          </div>

          {/* Orders Map list */}
          <div className="flex flex-col gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <img src={foodBagImage} className="w-16 h-16 opacity-30 object-contain" />
                <p className="text-xs text-slate-500 font-extrabold uppercase">No active orders</p>
              </div>
            ) : (
              orders.map((ord, idx) => {
                const isSelected = selectedOrder?.id.toString() === ord.id.toString();
                const channel = ord.delivery?.channel || ord.tags?.[0] || "POS";
                const isDirect = channel.toLowerCase() === 'direct' || channel.toLowerCase() === 'online';

                let channelColor = "bg-slate-500/20 text-slate-400 border-slate-500/30";
                if (isDirect) channelColor = "bg-[#e4c590]/15 text-[#e4c590] border-[#e4c590]/25";

                const itemsCount = ord.items?.length || 0;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedOrder(ord);
                      setRiderChat([
                        { sender: 'rider', text: "Hello! I am Suresh Kumar, your delivery partner. I am heading to the restaurant to pick up your order." }
                      ]);
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-2 ${
                      isSelected
                        ? "bg-[#141515] border-[#e4c590]/40 shadow-[0_4px_16px_rgba(228,197,144,0.15)]"
                        : "bg-[#161718]/45 border-white/5 hover:border-[#e4c590]/25"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white">
                        #{ord.invoice_number}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-full ${channelColor}`}>
                        {channel}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">
                        {(ord as any).cust_details?.name || "Guest Call"} ({itemsCount} item)
                      </span>
                      <span className={`font-black uppercase tracking-widest text-[9px] ${
                        ord.status === 'Completed' ? 'text-emerald-400' :
                        ord.status === 'Paid' ? 'text-blue-400' : 'text-amber-400'
                      }`}>
                        {ord.status === 'Paid' ? 'OUT FOR DELIVERY' : ord.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        {/* Right Side: 3D Delivery Tracker Console */}
        {selectedOrder ? (
          <div className="flex flex-col h-full overflow-y-auto p-6 justify-between gap-6">
            
            {/* Header Details */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-white font-serif-luxury uppercase tracking-wider">
                  Order Tracker: #{selectedOrder.invoice_number}
                </h1>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Customer: {(selectedOrder as any).cust_details?.name || "Guest User"} | Phone: {(selectedOrder as any).cust_details?.phone || "No phone"}
                </p>
              </div>

              {/* Status control button */}
              {!isCustomer && (
                <button
                  onClick={advanceOrderStatus}
                  disabled={selectedOrder.status === 'Completed' || loading}
                  className="grilli-btn grilli-btn-filled text-xs py-3 px-5 active:scale-95 shadow-[0_4px_16px_rgba(228,197,144,0.2)]"
                >
                  Advance Status 🛵 <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
            </div>

            {/* Unique 3D Scooter Animated Map/Tracker */}
            <div className="bg-[#141515]/60 border border-[#e4c590]/15 rounded-3xl p-6 relative flex flex-col justify-center h-48 overflow-hidden shadow-inner">
              
              {/* Decorative grid lines */}
              <div className="absolute inset-0 bg-grid-white opacity-5 pointer-events-none"></div>

              {/* Dotted Tracking Road */}
              <div className="w-full h-1 bg-[#1b1c1d] rounded-full relative my-8">
                {/* Active completed track */}
                <div
                  style={{ width: `${scooterLeftPercent}%` }}
                  className="absolute left-0 top-0 h-1 bg-gradient-to-r from-[#e4c590] to-[#c8a973] shadow-[0_0_12px_#e4c590] rounded-full transition-all duration-700"
                ></div>

                {/* Animated 3D Scooter Graphic */}
                <div
                  style={{ left: `${scooterLeftPercent}%` }}
                  className="absolute -top-10 -ml-8 w-16 h-16 transition-all duration-700 pointer-events-none"
                >
                  <img
                    src={scooterImage}
                    alt="Delivery Scooter"
                    className="w-full h-full object-contain animate-float drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                  />
                </div>
              </div>

              {/* Timeline Milestones */}
              <div className="flex justify-between text-center relative z-10 font-serif-luxury">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                    true
                      ? "bg-[#e4c590] border-transparent text-slate-950 shadow-[0_0_10px_rgba(228,197,144,0.5)]"
                      : "bg-[#0e0d0c] border-[#e4c590]/15 text-slate-500"
                  }`}>
                    <FontAwesomeIcon icon={faClipboardList} className="text-xs" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Placed</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                    (selectedOrder.status as any) === 'In Progress' || (selectedOrder.status as any) === 'Paid' || (selectedOrder.status as any) === 'Completed'
                      ? "bg-[#e4c590] border-transparent text-slate-950 shadow-[0_0_10px_rgba(228,197,144,0.5)]"
                      : "bg-[#0e0d0c] border-[#e4c590]/15 text-slate-500"
                  }`}>
                    <FontAwesomeIcon icon={faBowlFood} className="text-xs" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Preparing</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                    (selectedOrder.status as any) === 'Paid' || (selectedOrder.status as any) === 'Completed'
                      ? "bg-[#e4c590] border-transparent text-slate-950 shadow-[0_0_10px_rgba(228,197,144,0.5)]"
                      : "bg-[#0e0d0c] border-[#e4c590]/15 text-slate-500"
                  }`}>
                    <FontAwesomeIcon icon={faMotorcycle} className="text-xs" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">On The Way</span>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                    (selectedOrder.status as any) === 'Completed'
                      ? "bg-[#e4c590] border-transparent text-slate-950 shadow-[0_0_10px_rgba(228,197,144,0.5)]"
                      : "bg-[#0e0d0c] border-[#e4c590]/15 text-slate-500"
                  }`}>
                    <FontAwesomeIcon icon={faHouse} className="text-xs" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Delivered</span>
                </div>
              </div>
            </div>

            {/* Order Items & Summary Card */}
            <div className="grid grid-cols-2 gap-6 flex-1">
              
              {/* Items details list */}
              <div className="bg-[#161718]/45 border border-[#e4c590]/10 rounded-3xl p-5 overflow-y-auto">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 font-serif-luxury">
                  Basket Items
                </h3>
                <div className="flex flex-col gap-3 font-serif-luxury">
                  {(selectedOrder as any).order_items ? (
                    ((selectedOrder as any).order_items as any[]).map((item, idx) => {
                      const dishName = item.item?.name || "Biryani";
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-white">
                            {item.quantity}x {dishName}
                          </span>
                          <span className="text-[#e4c590] font-bold">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-slate-500 text-xs italic font-bold">No item details linked.</div>
                  )}
                </div>
              </div>

              {/* Delivery info & Rider chat logs */}
              <div className="bg-[#161718]/45 border border-[#e4c590]/10 rounded-3xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 font-serif-luxury">
                    Delivery Coordinates
                  </h3>
                  
                  {/* Rider Profile Card */}
                  <div className="flex items-center gap-3 bg-[#0e0d0c] p-3 rounded-2xl border border-[#e4c590]/10 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#e4c590]/10 border border-[#e4c590]/25 text-[#e4c590] flex items-center justify-center">
                      <FontAwesomeIcon icon={faUser} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white font-serif-luxury">Suresh Kumar</h4>
                      <p className="text-[10px] text-slate-500 font-bold">Delivery Partner Assigned</p>
                    </div>
                    <a
                      href="tel:+919876543210"
                      className="ml-auto w-8 h-8 rounded-xl bg-[#0e0d0c] hover:bg-[#161718] flex items-center justify-center text-[#e4c590] text-xs border border-white/5 transition-colors"
                    >
                      <FontAwesomeIcon icon={faPhone} />
                    </a>
                  </div>

                  {/* Mock Driver messaging */}
                  <div className="h-28 overflow-y-auto pr-1 flex flex-col gap-2.5">
                    {riderChat.map((chat, idx) => (
                      <div key={idx} className={`p-2.5 rounded-2xl text-[11px] font-semibold max-w-[90%] ${
                        chat.sender === 'rider'
                          ? "bg-[#0e0d0c] text-slate-300 rounded-tl-none border border-[#e4c590]/10"
                          : "bg-[#e4c590] text-slate-950 rounded-tr-none self-end"
                      }`}>
                        {chat.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send customer input to driver */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement).value;
                    if (input.trim()) {
                      setRiderChat(prev => [...prev, { sender: 'customer', text: input }]);
                      (e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement).value = "";
                      
                      // Mock driver reply
                      setTimeout(() => {
                        setRiderChat(prev => [...prev, { sender: 'rider', text: "Sure! Understood. I will follow your instructions." }]);
                      }, 1000);
                    }
                  }}
                  className="flex gap-2 mt-4 pt-3 border-t border-[#e4c590]/10"
                >
                  <input
                    type="text"
                    name="chatInput"
                    placeholder="Message driver..."
                    className="flex-1 bg-[#0e0d0c] border border-white/10 rounded-xl px-3 text-[11px] font-semibold text-white focus:outline-none focus:border-[#e4c590] placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-xl bg-[#e4c590] hover:bg-[#c8a973] text-slate-950 flex items-center justify-center transition-all"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                  </button>
                </form>

              </div>
            </div>

            {/* Invoice & Metadata Footer */}
            <div className="bg-[#141515]/60 border border-[#e4c590]/10 rounded-3xl p-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-bold uppercase tracking-wider font-serif-luxury">
                  OTP Code: <span className="text-white ml-1 font-black">{selectedOrder.delivery?.otp || "----"}</span>
                </span>
                <span className="text-slate-500 font-bold uppercase tracking-wider font-serif-luxury">
                  Address: <span className="text-white ml-1 font-black truncate max-w-[200px]" title={(selectedOrder as any).cust_details?.address}>
                    {(selectedOrder as any).cust_details?.address || "Hyderabad, India"}
                  </span>
                </span>
              </div>
              <div className="flex gap-2 font-serif-luxury font-bold">
                <span className="text-slate-500">TOTAL AMOUNT:</span>
                <span className="text-[#e4c590] font-black text-sm">
                  ₹{selectedOrder.delivery?.delivery_charge ? (selectedOrder as any).order_items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) + 30 + Math.round((selectedOrder as any).order_items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) * 0.05) : "Pending"}
                </span>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest font-serif-luxury">Select an order to trace progress</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

