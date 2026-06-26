import React, { useEffect, useMemo, useState, useRef } from "react";
import { useAtom } from "jotai";
import { appSettings, appState, appPage } from "@/store/jotai.ts";
import { useDB } from "@/api/db/db.ts";
import { Tables } from "@/api/db/tables.ts";
import { OrderStatus } from "@/api/model/order.ts";
import { Layout } from "@/screens/partials/layout.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faShoppingBag,
  faPlus,
  faMinus,
  faTrash,
  faXmark,
  faCheckCircle,
  faMapMarkerAlt,
  faPhone,
  faUser
} from "@fortawesome/free-solid-svg-icons";
import { nanoid } from "nanoid";
import { RecordId, StringRecordId } from "surrealdb";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ORDERS } from "@/routes/posr.ts";

// Import 3D Assets
import biryaniImage from "@/assets/images/3d_biryani_pot.png";
import sodaImage from "@/assets/images/3d_soda_can.png";
import foodBagImage from "@/assets/images/3d_food_bag.png";
// Helper to handle raw SurrealDB RecordId class instances vs plain objects from IndexedDB/JSON serialization
const getRecordIdString = (id: any): string => {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object") {
    const tb = id.tb || (id as any).table;
    const idVal = id.id;
    if (tb && idVal) {
      return `${tb}:${idVal}`;
    }
  }
  return id.toString();
};
export const Menu = () => {
  const db = useDB();
  const navigate = useNavigate();
  const [state, setState] = useAtom(appState);
  const [settings, setSettings] = useAtom(appSettings);
  const [page] = useAtom(appPage);

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);


  // 1. Auto Cache Loading on Mount
  useEffect(() => {
    const autoLoadCache = async () => {
      setLoading(true);
      try {
        const [orderTypes, categories, dishes, floors, tables, paymentTypes] = await Promise.all([
          db.query(`SELECT * FROM ${Tables.order_types} WHERE deleted_at = none ORDER BY priority ASC`),
          db.query(`SELECT * FROM ${Tables.categories} WHERE deleted_at = none ORDER BY priority ASC`),
          db.query(`SELECT * FROM ${Tables.dishes} WHERE deleted_at = none ORDER BY priority ASC`),
          db.query(`SELECT * FROM ${Tables.floors} WHERE deleted_at = none ORDER BY priority ASC`),
          db.query(`SELECT * FROM ${Tables.tables} WHERE deleted_at = none ORDER BY priority ASC`),
          db.query(`SELECT * FROM ${Tables.payment_types} WHERE deleted_at = none ORDER BY priority ASC`)
        ]);

        setSettings(prev => ({
          ...prev,
          order_types: orderTypes?.[0] || [],
          categories: categories?.[0] || [],
          dishes: dishes?.[0] || [],
          floors: floors?.[0] || [],
          tables: tables?.[0] || [],
          payment_types: paymentTypes?.[0] || [],
        }));
      } catch (e) {
        console.error("Failed to load DB settings", e);
        toast.error("Failed to fetch menu items from database.");
      } finally {
        setLoading(false);
      }
    };
    void autoLoadCache();
  }, [db, setSettings]);

  // Checkout Fields
  const [custName, setCustName] = useState("Delivery Guest");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("Hyderabad, Telangana, India");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  // Set default category on load
  useEffect(() => {
    if (settings.categories.length > 0 && !state.category) {
      setState(prev => ({ ...prev, category: settings.categories[0] }));
    }
  }, [settings.categories, state.category, setState]);

  // Cart operations
  const addToCart = (dish: any) => {
    setState(prev => {
      const existing = prev.cart.find(i => getRecordIdString(i.dish.id) === getRecordIdString(dish.id));
      if (existing) {
        return {
          ...prev,
          cart: prev.cart.map(i => getRecordIdString(i.dish.id) === getRecordIdString(dish.id) ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return {
        ...prev,
        cart: [...prev.cart, {
          id: nanoid(),
          dish: dish,
          quantity: 1,
          price: dish.price,
          seat: prev.seat || "Seat 1",
          level: 0,
          newOrOld: 'new' as any,
          category: state.category?.name || "Main",
          selectedGroups: []
        }]
      };
    });
    toast.success(`${dish.name} added to cart!`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setState(prev => {
      return {
        ...prev,
        cart: prev.cart.map(i => {
          if (i.id === id) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        }).filter(Boolean) as any
      };
    });
  };

  // Calculations
  const subtotal = useMemo(() => {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [state.cart]);

  const tax = useMemo(() => Math.round(subtotal * 0.05), [subtotal]); // 5% GST
  const deliveryFee = subtotal > 0 ? 30 : 0;
  const grandTotal = subtotal + tax + deliveryFee;

  // Filter Dishes
  const filteredDishes = useMemo(() => {
    let list = settings.dishes;
    if (state.category) {
      list = list.filter(item =>
        item.categories?.some(cat => getRecordIdString(cat) === getRecordIdString(state.category?.id))
      );
    }
    if (searchTerm.trim() !== "") {
      list = list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [settings.dishes, state.category, searchTerm]);

  // Checkout submission to SurrealDB
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    if (!custPhone.trim()) {
      toast.error("Phone number is required!");
      return;
    }

    setLoading(true);
    try {
      // 1. Create/Retrieve Customer
      const [customer] = await db.create(Tables.customers, {
        name: custName,
        phone: custPhone,
        address: custAddress
      });

      // 2. Create Order Items
      const itemRecordIds: any[] = [];
      for (const cartItem of state.cart) {
        const [orderItem] = await db.create(Tables.order_items, {
          item: new StringRecordId(cartItem.dish.id.toString()),
          price: cartItem.price,
          quantity: cartItem.quantity,
          created_at: new Date()
        });
        itemRecordIds.push(orderItem.id);
      }

      // 3. Create Main Order linked to Customer
      const randomInvoice = Math.floor(1000 + Math.random() * 9000);
      const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

      await db.create(Tables.orders, {
        customer: customer.id,
        covers: 1,
        tags: ["Direct Delivery", "Delivery"],
        order_type: new RecordId('order_type', 'delivery'),
        status: "Pending",
        invoice_number: randomInvoice,
        auto_id: randomInvoice,
        items: itemRecordIds,
        user: page.user?.id || new RecordId('user', 'admin_5555'),
        created_at: new Date(),
        delivery: {
          channel: "Direct",
          order_id: "DR-" + randomInvoice,
          bill_no: randomInvoice,
          otp: randomOtp,
          status: "Pending",
          delivery_charge: deliveryFee,
          instructions: "Leave at door, ring bell",
          rider: {
            first_name: "Suresh",
            last_name: "Kumar",
            phone: "+91 98765 43210"
          }
        }
      });

      toast.success("Order Placed Successfully 🛵!");
      setState(prev => ({ ...prev, cart: [] }));
      setIsCheckoutOpen(false);
      navigate(ORDERS);
    } catch (err) {
      console.error(err);
      toast.error("Database check-out failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout overflowHidden>
      <div className="grid grid-cols-[1fr_400px] h-screen bg-[#0e0d0c] text-[#a6a6a6] overflow-hidden font-sans">
        
        {/* Main Content Area */}
        <div className="flex flex-col h-full overflow-y-auto p-6 relative border-r border-[#e4c590]/10">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#e4c590] to-[#c8a973] font-serif-luxury uppercase tracking-wider">
                Sai Silver Dum Biryani
              </h1>
              <p className="text-[11px] text-[#e4c590]/70 font-bold uppercase tracking-[0.25em] mt-1 font-serif-luxury">
                Premium Culinary Experience
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-80">
              <input
                type="text"
                placeholder="Search Biryanis, Drinks..."
                className="w-full bg-[#161718] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#e4c590] transition-all text-white placeholder-slate-500 font-semibold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3.5 text-slate-500 text-sm" />
            </div>
          </div>

          {/* Categories Horizontal Banner */}
          <div className="mb-8">
            <h3 className="text-xs uppercase tracking-[0.18em] font-extrabold text-[#e4c590]/60 mb-4 font-serif-luxury">
              Special Selection
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              {settings.categories.map((cat, idx) => {
                const isSelected = getRecordIdString(state.category?.id) === getRecordIdString(cat?.id);
                // Assign 3D Graphics based on name
                let asset = biryaniImage;
                let shadowColor = "rgba(228,197,144,0.2)";
                if (cat.name.toLowerCase().includes("drink") || cat.name.toLowerCase().includes("beverage")) {
                  asset = sodaImage;
                  shadowColor = "rgba(59,130,246,0.2)";
                } else if (cat.name.toLowerCase().includes("starter") || cat.name.toLowerCase().includes("appetizer")) {
                  asset = foodBagImage;
                  shadowColor = "rgba(239,68,68,0.2)";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setState(prev => ({ ...prev, category: cat }))}
                    className={`flex-shrink-0 relative group h-24 w-44 rounded-3xl overflow-hidden transition-all duration-300 ${
                      isSelected
                        ? "bg-gradient-to-br from-[#e4c590] to-[#c8a973] text-slate-950 shadow-[0_8px_24px_rgba(228,197,144,0.25)] scale-105"
                        : "bg-[#1b1c1d]/60 border border-white/10 text-slate-300 hover:border-[#e4c590]/30"
                    }`}
                  >
                    {/* Floating 3D image element */}
                    <img
                      src={asset}
                      alt={cat.name}
                      style={{ filter: `drop-shadow(0 6px 12px ${shadowColor})` }}
                      className="absolute -right-2 -bottom-2 w-20 h-20 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 pointer-events-none"
                    />
                    <div className="absolute left-4 top-4 font-extrabold text-base text-left tracking-wide leading-tight max-w-[80px] font-serif-luxury">
                      {cat.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid of Dishes with mouse tilt effects */}
          <div className="flex-1">
            <h3 className="text-xs uppercase tracking-[0.18em] font-extrabold text-[#e4c590]/60 mb-6 font-serif-luxury">
              Popular Dishes in {state.category?.name || "Menu"}
            </h3>

            {loading ? (
              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-44 bg-slate-900/50 animate-pulse rounded-3xl border border-white/5"></div>
                ))}
              </div>
            ) : filteredDishes.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed">
                <p className="text-slate-400 font-bold">No dishes found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filteredDishes.map((dish, idx) => {
                  let dishImg = biryaniImage;
                  if (dish.name.toLowerCase().includes("sprite") || dish.name.toLowerCase().includes("coke") || dish.name.toLowerCase().includes("drink") || dish.name.toLowerCase().includes("beverage")) {
                    dishImg = sodaImage;
                  } else if (state.category?.name?.toLowerCase()?.includes("starter") || dish.name.toLowerCase().includes("starter") || (dish.categories && dish.categories.some((c: any) => c.toString().includes("starter") || c.name?.toLowerCase().includes("starter")))) {
                    dishImg = foodBagImage;
                  }

                  const activeCount = state.cart.find(i => getRecordIdString(i.dish.id) === getRecordIdString(dish.id))?.quantity || 0;

                  return (
                    <div
                      key={idx}
                      style={{
                        transform: 'perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
                        transition: 'transform 0.15s ease, box-shadow 0.3s ease',
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const rx = ((y - rect.height / 2) / rect.height) * -12;
                        const ry = ((x - rect.width / 2) / rect.width) * 12;
                        e.currentTarget.style.setProperty('--rx', `${rx}deg`);
                        e.currentTarget.style.setProperty('--ry', `${ry}deg`);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.setProperty('--rx', '0deg');
                        e.currentTarget.style.setProperty('--ry', '0deg');
                      }}
                      className="group grilli-card p-5 flex flex-col justify-between h-48 transition-all duration-300 relative shadow-lg"
                    >
                      <div className="flex gap-4">
                        {/* 3D Asset rendering for food item */}
                        <div className="w-20 h-20 rounded-2xl bg-slate-950 flex items-center justify-center relative overflow-hidden flex-shrink-0 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                          <img
                            src={dishImg}
                            alt={dish.name}
                            className="w-16 h-16 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                          />
                        </div>

                        {/* Dish Meta */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] bg-[#e4c590]/10 text-[#e4c590] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#e4c590]/25">
                            Chef's Special
                          </span>
                          <h4 className="text-base font-bold text-white mt-1.5 truncate group-hover:text-[#e4c590] transition-colors font-serif-luxury tracking-wide">
                            {dish.name}
                          </h4>
                          <span className="text-lg font-black text-[#e4c590] mt-1 block">
                            ₹{dish.price}
                          </span>
                        </div>
                      </div>

                      {/* Quantity or Add Button */}
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-serif-luxury">Signature Recipe</span>
                        
                        {activeCount > 0 ? (
                          <div className="flex items-center bg-slate-950 border border-[#e4c590]/20 rounded-2xl px-2 py-1 gap-3">
                            <button
                              onClick={() => {
                                const cartItem = state.cart.find(i => getRecordIdString(i.dish.id) === getRecordIdString(dish.id));
                                if (cartItem) updateQuantity(cartItem.id, -1);
                              }}
                              className="text-xs text-slate-400 hover:text-[#e4c590] w-5 h-5 flex items-center justify-center transition-colors"
                            >
                              <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <span className="text-xs font-bold text-white">{activeCount}</span>
                            <button
                              onClick={() => {
                                const cartItem = state.cart.find(i => getRecordIdString(i.dish.id) === getRecordIdString(dish.id));
                                if (cartItem) updateQuantity(cartItem.id, 1);
                              }}
                              className="text-xs text-slate-400 hover:text-[#e4c590] w-5 h-5 flex items-center justify-center transition-colors"
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(dish)}
                            className="grilli-btn grilli-btn-filled text-[10px] py-1.5 px-4 flex items-center gap-1.5 active:scale-95"
                          >
                            <FontAwesomeIcon icon={faPlus} /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Cart Sidebar (Hotel Style) */}
        <div className="h-full bg-[#141515] border-l border-[#e4c590]/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#e4c590]/10 text-[#e4c590] border border-[#e4c590]/25 flex items-center justify-center">
                <FontAwesomeIcon icon={faShoppingBag} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-serif-luxury uppercase tracking-wider">Your Selection</h2>
                <p className="text-xs text-slate-400 font-bold">{state.cart.length} Items Selected</p>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="max-h-[calc(100vh_-_350px)] overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-none">
              {state.cart.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <img
                    src={foodBagImage}
                    alt="Empty Cart"
                    className="w-24 h-24 object-contain animate-bounce drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                  />
                  <p className="text-[#e4c590]/60 font-extrabold text-xs uppercase tracking-wider font-serif-luxury">
                    No items selected
                  </p>
                </div>
              ) : (
                state.cart.map((item, idx) => (
                  <div key={idx} className="bg-[#161718]/60 border border-[#e4c590]/10 rounded-2xl p-3 flex justify-between items-center transition-all hover:bg-[#1b1c1d]/60">
                    <div className="min-w-0 pr-2">
                      <h4 className="text-sm font-bold text-white truncate max-w-[160px] font-serif-luxury tracking-wide">
                        {item.dish.name}
                      </h4>
                      <span className="text-xs text-[#e4c590] font-semibold">
                        ₹{item.price} each
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Counter */}
                      <div className="flex items-center bg-[#0e0d0c] rounded-xl border border-[#e4c590]/15 px-1.5 py-0.5 gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="text-[10px] text-slate-400 hover:text-[#e4c590] w-4 h-4 flex items-center justify-center"
                        >
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <span className="text-xs font-extrabold text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="text-[10px] text-slate-400 hover:text-[#e4c590] w-4 h-4 flex items-center justify-center"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                      
                      {/* Total */}
                      <span className="text-sm font-black text-[#e4c590] w-14 text-right">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pricing & Checkout Summary */}
          {state.cart.length > 0 && (
            <div className="border-t border-[#e4c590]/10 pt-4 bg-[#141515]">
              <div className="flex flex-col gap-2 text-xs font-semibold text-slate-400 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white">₹{subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span className="text-white">₹{tax}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Partner Fee</span>
                  <span className="text-white">₹{deliveryFee}</span>
                </div>
                <div className="h-[1px] bg-[#e4c590]/10 my-1"></div>
                <div className="flex justify-between text-sm font-black text-white">
                  <span>Grand Total</span>
                  <span className="text-[#e4c590] text-base font-bold font-serif-luxury">₹{grandTotal}</span>
                </div>
              </div>

              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="grilli-btn grilli-btn-filled w-full font-bold py-3.5 uppercase tracking-wider flex items-center justify-center gap-2"
              >
                Proceed to Checkout 🛵
              </button>
            </div>
          )}
        </div>
      </div>



      {/* Direct Delivery Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-[#0e0d0c]/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141515] border border-[#e4c590]/15 rounded-3xl p-6 w-full max-w-lg shadow-[0_24px_50px_rgba(0,0,0,0.7)]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#e4c590] font-serif-luxury uppercase tracking-wider flex items-center gap-2">
                🛵 Delivery Details
              </h2>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-[#e4c590] transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} className="text-lg" />
              </button>
            </div>

            {/* Checkout Form */}
            <form onSubmit={handlePlaceOrder} className="flex flex-col gap-4 text-sm font-semibold text-slate-300">
              
              <div>
                <label className="text-[10px] text-[#e4c590]/65 uppercase tracking-widest block mb-1">Customer Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full bg-[#0e0d0c] border border-white/10 focus:border-[#e4c590] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                  />
                  <FontAwesomeIcon icon={faUser} className="absolute left-3.5 top-3.5 text-slate-500 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#e4c590]/65 uppercase tracking-widest block mb-1">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="+91 99887 76655"
                    className="w-full bg-[#0e0d0c] border border-white/10 focus:border-[#e4c590] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                  />
                  <FontAwesomeIcon icon={faPhone} className="absolute left-3.5 top-3.5 text-slate-500 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#e4c590]/65 uppercase tracking-widest block mb-1">Delivery Address</label>
                <div className="relative">
                  <textarea
                    required
                    rows={2}
                    className="w-full bg-[#0e0d0c] border border-white/10 focus:border-[#e4c590] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none"
                    value={custAddress}
                    onChange={e => setCustAddress(e.target.value)}
                  />
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute left-3.5 top-4.5 text-slate-500 text-xs" />
                </div>
              </div>

              {/* Payment Methods selector */}
              <div>
                <label className="text-[10px] text-[#e4c590]/65 uppercase tracking-widest block mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      paymentMethod === "cod"
                        ? "border-[#e4c590] bg-[#e4c590]/10 text-[#e4c590] shadow-[0_4px_12px_rgba(228,197,144,0.15)]"
                        : "border-white/10 bg-[#0e0d0c] text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    <span className="font-bold text-xs text-white font-serif-luxury tracking-wide">Cash on Delivery</span>
                    <span className="text-[10px] text-slate-500 font-bold">Pay rider upon delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upi")}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      paymentMethod === "upi"
                        ? "border-[#e4c590] bg-[#e4c590]/10 text-[#e4c590] shadow-[0_4px_12px_rgba(228,197,144,0.15)]"
                        : "border-white/10 bg-[#0e0d0c] text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    <span className="font-bold text-xs text-white font-serif-luxury tracking-wide">UPI / Card Mock</span>
                    <span className="text-[10px] text-slate-500 font-bold">Simulate online gateway payment</span>
                  </button>
                </div>
              </div>

              {/* Bill Details summary */}
              <div className="bg-[#0e0d0c] p-4 rounded-2xl border border-[#e4c590]/10 mt-2 flex flex-col gap-1 text-xs">
                <div className="flex justify-between items-center">
                  <span>Grand Total:</span>
                  <span className="text-[#e4c590] font-black text-base font-serif-luxury">₹{grandTotal}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="flex-1 bg-[#0e0d0c] hover:bg-[#161718] border border-white/10 text-slate-400 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="grilli-btn grilli-btn-filled flex-1 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all"
                >
                  {loading ? "Placing Order..." : "Confirm & Place Order 🛵"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
