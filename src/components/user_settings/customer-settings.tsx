import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDB } from "@/api/db/db.ts";
import { Tables } from "@/api/db/tables.ts";
import { Checkbox } from "@/components/common/input/checkbox.tsx";
import { Input } from "@/components/common/input/input.tsx";
import { toast } from "sonner";
import { useSecurity } from "@/hooks/useSecurity.ts";
import { useTranslation } from 'react-i18next';

export const CustomerSettings = () => {
  const db = useDB();
  const { protectFormSubmit } = useSecurity();
  const { t } = useTranslation(['settings', 'common', 'toast']);
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      phone_validation_enabled: false,
      min_phone_length: 10,
      max_phone_length: 10,
      allow_dues: false,
      max_dues_limit: 1000,
    }
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [result] = await db.query(
        `SELECT * FROM ${Tables.settings} WHERE key = 'customer_settings' LIMIT 1`
      );

      if (result && result.length > 0) {
        const setting = result[0];
        setSettingsId(setting.id.toString());
        if (setting.values) {
          reset({
            phone_validation_enabled: !!setting.values.phone_validation_enabled,
            min_phone_length: typeof setting.values.min_phone_length === 'number' ? setting.values.min_phone_length : 10,
            max_phone_length: typeof setting.values.max_phone_length === 'number' ? setting.values.max_phone_length : 10,
            allow_dues: !!setting.values.allow_dues,
            max_dues_limit: typeof setting.values.max_dues_limit === 'number' ? setting.values.max_dues_limit : 1000,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load customer settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async (values: any) => {
    try {
      const payload = {
        phone_validation_enabled: !!values.phone_validation_enabled,
        min_phone_length: Number(values.min_phone_length),
        max_phone_length: Number(values.max_phone_length),
        allow_dues: !!values.allow_dues,
        max_dues_limit: Number(values.max_dues_limit),
      };

      if (settingsId) {
        await db.merge(settingsId, {
          values: payload
        });
      } else {
        await db.create(Tables.settings, {
          key: "customer_settings",
          is_global: true,
          values: payload,
        });
      }
      toast.success("Customer settings saved successfully!");
      loadSettings();
    } catch (error) {
      console.error("Failed to save customer settings:", error);
      toast.error("Failed to save settings");
    }
  };

  if (loading) {
    return <div className="p-5">Loading settings...</div>;
  }

  return (
    <div className="shadow p-6 rounded-lg bg-white border border-neutral-100">
      <h2 className="text-xl font-bold mb-1 text-neutral-800">Customer Configuration</h2>
      <p className="text-sm text-neutral-500 mb-6 font-medium">Configure customer phone validation, limits, and customer credit rules.</p>

      <form onSubmit={protectFormSubmit((handleSubmit(saveSettings)), {
        module: 'Settings',
        description: 'Save Customer settings'
      })}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Phone Validation Section */}
          <div className="p-5 rounded-xl border border-neutral-200 bg-neutral-50/50">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">Phone Validation</h3>
            
            <div className="flex flex-col gap-4">
              <Controller
                name="phone_validation_enabled"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Enable Customer Phone Validation"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                name="min_phone_length"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Minimum Digits"
                    type="number"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                name="max_phone_length"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Maximum Digits"
                    type="number"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          {/* Dues / Credit Limits Section */}
          <div className="p-5 rounded-xl border border-neutral-200 bg-neutral-50/50">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">Customer Dues & Credit</h3>
            
            <div className="flex flex-col gap-4">
              <Controller
                name="allow_dues"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Allow Customer Dues (Credit Billing)"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                name="max_dues_limit"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Maximum Dues Limit per Customer"
                    type="number"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
          <button className="btn btn-primary" type="submit">Save Changes</button>
        </div>
      </form>
    </div>
  );
};
