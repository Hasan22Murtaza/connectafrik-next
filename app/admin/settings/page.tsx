"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Settings } from "@/shared/icons";
import toast from "react-hot-toast";
import { AdminLoading } from "@/features/admin/components/AdminLoading";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminEmptyState } from "@/features/admin/components/AdminEmptyState";
import { AdminSystemHealthCard } from "@/features/admin/components/AdminMonitoringSections";
import {
  AdminTableBody,
  AdminTableCard,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { AdminTableSkeleton } from "@/features/admin/components/skeletons/AdminShimmerLoaders";
import { useAdminAuth } from "@/features/admin/hooks/useAdminAuth";
import { AP } from "@/features/admin/constants/adminLayout";
import {
  getAdminSettings,
  updateAdminSetting,
  type AdminPlatformSettingRow,
} from "@/features/admin/services/contentAdminService";
import { formatSettingLabel } from "@/features/admin/utils/format";
import type { MonitoringServiceHealth } from "@/features/admin/services/monitoringService";

export default function AdminSettingsPage() {
  const { isReady, authLoading } = useAdminAuth("/admin/settings");
  const [settings, setSettings] = useState<AdminPlatformSettingRow[]>([]);
  const [services, setServices] = useState<MonitoringServiceHealth[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAdminSettings();
      setSettings(result.settings);
      setServices(result.services as MonitoringServiceHealth[]);
      const nextDrafts: Record<string, string> = {};
      for (const row of result.settings) {
        nextDrafts[row.key] = String(row.value);
      }
      setDrafts(nextDrafts);
    } catch {
      toast.error("Unable to load settings");
      setSettings([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    load();
  }, [isReady, load]);

  const handleSave = async (key: string) => {
    const parsed = Number(drafts[key]);
    if (!Number.isFinite(parsed)) {
      toast.error("Enter a valid number");
      return;
    }
    try {
      setSavingKey(key);
      const result = await updateAdminSetting(key, parsed);
      setSettings((prev) =>
        prev.map((row) => (row.key === key ? result.setting : row))
      );
      toast.success("Setting saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSavingKey(null);
    }
  };

  if (authLoading || !isReady) return <AdminLoading variant="table" />;

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Settings"
        description="Platform configuration and service health for CribsTalk."
        icon={Settings}
        action={
          <button type="button" onClick={load} className={AP.btnSecondary}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="mb-6">
        <AdminSystemHealthCard services={services} />
      </div>

      <AdminTableCard title="Platform settings">
        {loading ? (
          <AdminTableSkeleton rows={8} cols={4} />
        ) : settings.length === 0 ? (
          <AdminEmptyState
            icon={Settings}
            title="No settings available"
            description="Platform settings will appear here when configured."
          />
        ) : (
          <div className={AP.tableWrap}>
            <table className={AP.table}>
              <AdminTableHead>
                <AdminTableHeadCell>Setting</AdminTableHeadCell>
                <AdminTableHeadCell>Value</AdminTableHeadCell>
                <AdminTableHeadCell>Source</AdminTableHeadCell>
                <AdminTableHeadCell>Action</AdminTableHeadCell>
              </AdminTableHead>
              <AdminTableBody>
                {settings.map((row) => {
                  const dirty = String(row.value) !== (drafts[row.key] ?? "");
                  return (
                    <AdminTableRow key={row.key}>
                      <AdminTableCell>
                        <span className="font-medium text-gray-900">
                          {formatSettingLabel(row.key)}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-gray-400">
                          {row.key}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <input
                          type="number"
                          step="any"
                          value={drafts[row.key] ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.key]: e.target.value,
                            }))
                          }
                          className="w-32 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
                        />
                      </AdminTableCell>
                      <AdminTableCell className="capitalize text-gray-600">
                        {row.source}
                      </AdminTableCell>
                      <AdminTableCell>
                        <button
                          type="button"
                          disabled={!dirty || savingKey === row.key}
                          onClick={() => handleSave(row.key)}
                          className={AP.btnPrimary}
                        >
                          {savingKey === row.key ? "Saving…" : "Save"}
                        </button>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </table>
          </div>
        )}
      </AdminTableCard>
    </div>
  );
}
