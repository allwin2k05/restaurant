import React, { useState } from "react";
import { Layout } from "@/screens/partials/layout.tsx";
import { Printersettings } from "@/components/user_settings/printers.tsx";
import { ServiceChargesSettings } from "@/components/user_settings/service_charges.tsx";
import { CacheSettings } from "@/components/user_settings/cache.tsx";
import { TouchSettings } from "@/components/user_settings/touch.tsx";
import { TableSelectionSettings } from "@/components/user_settings/table_selection.tsx";
import { MenusSettings } from "@/components/user_settings/menus.tsx";
import { AutoCheckCloseSettingsCard } from "@/components/user_settings/auto_check_close.tsx";
import { ClosingCycleSettingsCard } from "@/components/user_settings/closing_cycle.tsx";
import { LanguageSettings } from "@/components/user_settings/language.tsx";
import { CustomerSettings } from "@/components/user_settings/customer-settings.tsx";
import { DeliverySettings } from "@/screens/delivery/settings.tsx";
import { cn } from "@/lib/utils.ts";

type SettingGroup = 'display' | 'calculations' | 'print' | 'customer' | 'online_config' | 'billing_system';

export const Settings = () => {
  const [activeGroup, setActiveGroup] = useState<SettingGroup>('display');

  const menuGroups = [
    {
      title: "Billing Screen",
      items: [
        { id: 'display', label: 'Display Settings' },
        { id: 'calculations', label: 'Calculations & Charges' },
        { id: 'print', label: 'Print Rules' },
        { id: 'customer', label: 'Customer Configuration' }
      ]
    },
    {
      title: "Online / Advance Order",
      items: [
        { id: 'online_config', label: 'Online / Advance Order' }
      ]
    },
    {
      title: "System Setting",
      items: [
        { id: 'billing_system', label: 'Billing System Sync' }
      ]
    }
  ];

  const renderActiveSetting = () => {
    switch (activeGroup) {
      case 'display':
        return (
          <div className="flex flex-col gap-6 max-w-4xl">
            <LanguageSettings />
            <TouchSettings />
            <TableSelectionSettings />
            <MenusSettings />
          </div>
        );
      case 'calculations':
        return (
          <div className="max-w-4xl">
            <ServiceChargesSettings />
          </div>
        );
      case 'print':
        return (
          <div className="max-w-4xl">
            <Printersettings />
          </div>
        );
      case 'customer':
        return (
          <div className="max-w-4xl">
            <CustomerSettings />
          </div>
        );
      case 'online_config':
        return (
          <div className="max-w-4xl bg-white p-6 rounded-lg shadow-sm border border-neutral-100">
            <DeliverySettings />
          </div>
        );
      case 'billing_system':
        return (
          <div className="flex flex-col gap-6 max-w-4xl">
            <CacheSettings />
            <ClosingCycleSettingsCard />
            <AutoCheckCloseSettingsCard />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout overflowHidden>
      <div className="flex h-screen bg-neutral-50/50">
        {/* Left Settings Navigation Sidebar */}
        <div className="w-[300px] border-r border-neutral-200 bg-white p-5 flex flex-col gap-6 select-none overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-neutral-800 tracking-tight">POS Settings</h1>
            <p className="text-xs text-neutral-400 font-medium">Configure terminal rules and features</p>
          </div>

          <div className="flex flex-col gap-5">
            {menuGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest px-2 mb-1">
                  {group.title}
                </span>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive = activeGroup === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveGroup(item.id as SettingGroup)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150",
                          isActive
                            ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Dynamic Form Panel */}
        <div className="flex-1 overflow-y-auto p-8 bg-neutral-50/50">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-800 uppercase tracking-tight">
              {menuGroups
                .flatMap((g) => g.items)
                .find((i) => i.id === activeGroup)?.label}
            </h2>
            <p className="text-xs text-neutral-400">
              Configure items related to{" "}
              {menuGroups
                .flatMap((g) => g.items)
                .find((i) => i.id === activeGroup)?.label.toLowerCase()}
            </p>
          </div>
          <div className="pb-12">{renderActiveSetting()}</div>
        </div>
      </div>
    </Layout>
  );
};
